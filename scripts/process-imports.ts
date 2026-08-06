/**
 * TikTok -> recipe draft worker.
 *
 * Picks `pending` rows from the `imports` table and for each one:
 *   1. downloads the video + caption (yt-dlp)
 *   2. extracts up to 8 frames (ffmpeg) and the audio track
 *   3. builds a structured recipe draft with an AI model:
 *      - GEMINI_API_KEY    -> Gemini (frames + audio natively; free tier, no Whisper needed)
 *      - ANTHROPIC_API_KEY -> Claude (frames + Whisper transcript if OPENAI_API_KEY is set)
 *   4. saves the draft -> status `ready`; the operator reviews it in /admin/tiktok
 *
 * Requirements: yt-dlp and ffmpeg on PATH, one AI key in the environment.
 * Run: npm run imports:process   (cron-friendly; exits when the queue is empty)
 *      npm run imports:watch     (long-running: polls the queue every 10 s —
 *                                 this is how the `worker` compose service runs)
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { estimateMacros } from "../lib/server/estimate-macros";
import { eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as schema from "../lib/db/schema";

const run = promisify(execFile);
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });
const { imports } = schema;

// Modele bywają niesforne wobec schematu: pomijają nullable pola,
// zwracają liczby jako stringi itd. — walidacja jest więc liberalna
// w tym, co przyjmuje, i ścisła w tym, co zwraca.
const optStr = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const optNum = z.preprocess(
  (v) => (typeof v === "string" ? parseFloat(v.replace(",", ".")) || null : v),
  z.number().nullish().transform((v) => v ?? null)
);

const RecipeDraft = z.object({
  title: z.string(),
  lead: z.string().describe("Krótki, apetyczny opis przepisu (2-3 zdania), po polsku"),
  about: z
    .string()
    .describe("Sekcja 'Kilka słów o tym przepisie': 2-3 akapity rozdzielone pustą linią"),
  categorySlugs: z
    .array(z.string())
    .describe("1-2 slugi kategorii z listy dozwolonych"),
  difficulty: optStr.describe("'latwy' | 'sredni' | 'trudny' | null"),
  ingredientGroups: z.array(
    z.object({
      title: optStr.describe("Nazwa sekcji np. 'Ciasto'; null gdy jedna sekcja"),
      items: z.array(z.string()).describe("Składnik z ilością, np. 'pół szklanki płatków owsianych'"),
    })
  ),
  steps: z.array(
    z.object({
      title: optStr,
      body: z.string(),
      tip: optStr,
    })
  ),
  prepTimeMin: optNum,
  totalTimeMin: optNum,
  servings: optNum,
  kcal: optNum.describe("Szacunkowe kcal na porcję ze składników"),
  protein: optNum,
  fat: optNum,
  carbs: optNum,
  seoTitle: z.string().describe("Tytuł SEO do 60 znaków, kończy się na ' - Dieta na luzie'"),
  seoDescription: z.string().describe("Opis SEO 140-160 znaków, po polsku, zachęcający"),
  // Modele czasem zwracają tablicę mimo instrukcji — normalizujemy do stringa
  keywords: z.preprocess(
    (v) => (Array.isArray(v) ? v.join(", ") : v),
    z.string()
  ),
  tags: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]).describe("Pewność odczytu przepisu z materiału"),
  notes: optStr.describe("Wątpliwości dla operatora, np. niepewne ilości"),
  sponsor: z
    .object({
      brand: z.string().describe("Nazwa marki, np. 'Kol-Pol'"),
      code: optStr.describe("Kod rabatowy, np. 'ROKSANA15'"),
      note: optStr.describe("Krótka informacja, czego dotyczy współpraca/kod"),
    })
    .nullish()
    .transform((v) => v ?? null)
    .describe("Współpraca reklamowa z materiału; null gdy brak"),
});

async function downloadVideo(url: string, dir: string) {
  await run("yt-dlp", [
    "-o", path.join(dir, "video.%(ext)s"),
    "--write-info-json",
    "--no-playlist",
    "-f", "mp4/bv*+ba/b",
    url,
  ], { timeout: 120_000 });

  const files = fs.readdirSync(dir);
  const video = files.find((f) => f.startsWith("video.") && !f.endsWith(".json"));
  const infoFile = files.find((f) => f.endsWith(".info.json"));
  const info = infoFile ? JSON.parse(fs.readFileSync(path.join(dir, infoFile), "utf8")) : {};
  if (!video) throw new Error("yt-dlp nie pobrał wideo");
  return {
    videoPath: path.join(dir, video),
    caption: info.description || info.title || "",
    durationSec: Math.round(info.duration) || null,
    viewCount: Number.isFinite(info.view_count) ? info.view_count : null,
  };
}

async function extractFrames(videoPath: string, dir: string, maxFrames = 8) {
  const framesDir = path.join(dir, "frames");
  fs.mkdirSync(framesDir, { recursive: true });
  // Even sampling across the whole clip regardless of its length
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath,
  ]);
  const duration = Math.max(1, parseFloat(stdout.trim()) || 30);
  const fps = maxFrames / duration;
  // 1080px wide: good enough for the model AND as hero-image candidates
  await run("ffmpeg", [
    "-i", videoPath, "-vf", `fps=${fps},scale=1080:-2`, "-frames:v", String(maxFrames),
    "-q:v", "3", path.join(framesDir, "frame-%02d.jpg"),
  ], { timeout: 120_000 });
  return fs.readdirSync(framesDir).sort().map((f) => path.join(framesDir, f));
}

// Frames double as hero-image candidates — publish them under /uploads.
// In production the worker (tools container) and the web server are separate
// containers, so frames must land on the shared media volume (UPLOADS_DIR),
// not the ephemeral public/ dir. Caddy serves /uploads/* from that volume.
function publishFrames(importId: number, frames: string[]): string[] {
  const baseDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
  const outDir = path.join(baseDir, "imports", String(importId));
  fs.mkdirSync(outDir, { recursive: true });
  return frames.map((f) => {
    const name = path.basename(f);
    fs.copyFileSync(f, path.join(outDir, name));
    return `/uploads/imports/${importId}/${name}`;
  });
}

async function extractAudio(videoPath: string, dir: string): Promise<string> {
  const audioPath = path.join(dir, "audio.mp3");
  await run("ffmpeg", ["-i", videoPath, "-vn", "-ac", "1", "-b:a", "64k", audioPath], {
    timeout: 120_000,
  });
  return audioPath;
}

async function transcribe(videoPath: string, dir: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const audioPath = await extractAudio(videoPath, dir);
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(audioPath)]), "audio.mp3");
  form.append("model", "whisper-1");
  form.append("language", "pl");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.text || null;
}

const SYSTEM_PROMPT =
  "Jesteś asystentem food blogerki Roksany (blog dietanaluzie.pl — zdrowe, fit przepisy po polsku). " +
  "Z materiałów z TikToka (klatki wideo, ścieżka audio lub transkrypcja, opis posta) odtwarzasz kompletny przepis. " +
  "OPIS POSTA to najbardziej wiarygodne źródło: autorka zwykle wypisuje tam pełną listę składników z ilościami — " +
  "przenieś je wiernie, co do jednostki. Transkrypcja i klatki służą głównie do odtworzenia kroków i technik. " +
  "Pisz naturalnym, ciepłym stylem bloga. Ilości składników podawaj po polsku ('pół szklanki', '2 łyżki'). " +
  "ZAWSZE oszacuj wartości odżywcze NA PORCJĘ ze składników (kcal, protein, fat, carbs) — " +
  "to jawny szacunek dietetyczny, więc nie zostawiaj tych pól pustych, gdy znasz składniki i liczbę porcji. " +
  "Jeśli czegoś nie widać ani nie słychać — nie zmyślaj; odnotuj wątpliwość w polu notes i obniż confidence. " +
  "Treści reklamowych (marka, kod rabatowy, współpraca) NIE mieszaj ze składnikami ani krokami — " +
  "wyciągnij je do pola sponsor, żeby można je było uczciwie oznaczyć na stronie. " +
  "KATEGORIE: przypisz przepis do 1-2 kategorii z listy dozwolonych (pole categorySlugs) — " +
  "to warunek publikacji, przepis bez kategorii nie trafia do archiwum. " +
  "TAGI: pole tags[] to 2-5 slugów wybranych WYŁĄCZNIE z listy dozwolonych tagów; nie wymyślaj " +
  "własnych. Najwyżej jeden tag z grupy 'sezon' i tylko wtedy, gdy przepis naprawdę pasuje " +
  "do okresu (np. sernik na zimno -> sezon-lato). " +
  "Pole 'about' to sekcja 'Kilka słów o tym przepisie' pod przepisem — pisz ją tak, jakby Roksana " +
  "opowiadała czytelniczce przy kawie: pierwsza osoba, konkrety o smaku, konsystencji i okazji " +
  "('robię go, gdy...'), naturalnie wplecione frazy, których ludzie szukają w Google. " +
  "Tekst MA brzmieć jak od człowieka: bez słów-wytrychów ('odkryj', 'idealny na każdą okazję', " +
  "'kulinarna podróż', 'rozpieść podniebienie'), bez wyliczanek po trzy przymiotniki, bez " +
  "podsumowania na końcu, bez zwrotów typu 'warto podkreślić', maksymalnie jeden wykrzyknik. " +
  "Krótkie i długie zdania na zmianę, jak w mowie. " +
  "ZAKAZ ABSOLUTNY: nigdy nie używaj długiego myślnika (—) ani półpauzy (–) w tekstach opisowych " +
  "(about, lead, seoDescription, kroki) — to najbardziej rozpoznawalny znak tekstu od AI; " +
  "zamiast tego stawiaj przecinek, dwukropek albo kropkę.";

// ---------- Gemini path (free tier; understands the audio track natively) ----------

// zod -> Gemini responseSchema (OpenAPI subset), kept in sync with RecipeDraft
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    lead: { type: "STRING" },
    about: { type: "STRING" },
    categorySlugs: { type: "ARRAY", items: { type: "STRING" } },
    difficulty: { type: "STRING", nullable: true },
    ingredientGroups: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", nullable: true },
          items: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["items"],
      },
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", nullable: true },
          body: { type: "STRING" },
          tip: { type: "STRING", nullable: true },
        },
        required: ["body"],
      },
    },
    prepTimeMin: { type: "NUMBER", nullable: true },
    totalTimeMin: { type: "NUMBER", nullable: true },
    servings: { type: "NUMBER", nullable: true },
    kcal: { type: "NUMBER", nullable: true },
    protein: { type: "NUMBER", nullable: true },
    fat: { type: "NUMBER", nullable: true },
    carbs: { type: "NUMBER", nullable: true },
    seoTitle: { type: "STRING" },
    seoDescription: { type: "STRING" },
    keywords: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    notes: { type: "STRING", nullable: true },
    sponsor: {
      type: "OBJECT",
      nullable: true,
      properties: {
        brand: { type: "STRING" },
        code: { type: "STRING", nullable: true },
        note: { type: "STRING", nullable: true },
      },
      required: ["brand"],
    },
  },
  required: ["title", "lead", "about", "categorySlugs", "ingredientGroups", "steps", "seoTitle", "seoDescription", "keywords", "tags", "confidence"],
};

async function draftRecipeGemini(
  frames: string[],
  audioPath: string | null,
  caption: string,
  categoryOptions: string,
  tagOptions: string
) {
  const parts: any[] = frames.map((f) => ({
    inline_data: {
      mime_type: "image/jpeg",
      data: fs.readFileSync(f).toString("base64"),
    },
  }));
  if (audioPath && fs.existsSync(audioPath)) {
    parts.push({
      inline_data: {
        mime_type: "audio/mp3",
        data: fs.readFileSync(audioPath).toString("base64"),
      },
    });
  }
  parts.push({
    text:
      `Opis posta z TikToka:\n${caption || "(brak)"}\n\n` +
      `Dozwolone kategorie (slug — nazwa):\n${categoryOptions}\n\n` +
      `Dozwolone tagi (slug — nazwa, wg grup):\n${tagOptions}\n\n` +
      "Klatki pochodzą z rolki wideo (kolejność chronologiczna); dołączona jest też ścieżka audio. " +
      "Odtwórz z tego kompletny przepis do publikacji na blogu.",
  });

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  return RecipeDraft.parse(JSON.parse(text));
}

// ---------- OpenAI / OpenAI-compatible path ----------
// OpenAI: OPENAI_API_KEY wystarczy (vision + Whisper jednym kluczem);
// model przez OPENAI_MODEL (domyślnie gpt-4o).
// Inni zgodni z OpenAI API (Kimi/Moonshot, OpenRouter, vLLM...):
//   AI_COMPAT_BASE_URL + AI_COMPAT_API_KEY + AI_COMPAT_MODEL (model musi mieć vision)

type CompatConfig = { baseUrl: string; apiKey: string; model: string };

async function draftRecipeOpenAICompat(
  cfg: CompatConfig,
  frames: string[],
  transcript: string | null,
  caption: string,
  categoryOptions: string,
  tagOptions: string
) {
  const content: any[] = frames.map((f) => ({
    type: "image_url",
    image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(f).toString("base64")}` },
  }));
  content.push({
    type: "text",
    text:
      `Opis posta z TikToka:\n${caption || "(brak)"}\n\n` +
      `Transkrypcja audio:\n${transcript || "(brak transkrypcji)"}\n\n` +
      `Dozwolone kategorie (slug — nazwa):\n${categoryOptions}\n\n` +
      `Dozwolone tagi (slug — nazwa, wg grup):\n${tagOptions}\n\n` +
      "Odtwórz z tego kompletny przepis do publikacji na blogu. " +
      "Odpowiedz WYŁĄCZNIE poprawnym JSON-em o polach: title, lead, about (sekcja 'Kilka słów " +
      "o tym przepisie', 2-3 akapity rozdzielone pustą linią), categorySlugs[] (1-2 slugi z listy " +
      "dozwolonych), difficulty ('latwy'|'sredni'|'trudny'|null), ingredientGroups " +
      "[{title|null, items[]}], steps [{title|null, body, tip|null}], prepTimeMin|null, " +
      "totalTimeMin|null, servings|null, kcal|null, protein|null, fat|null, carbs|null, " +
      "seoTitle, seoDescription, keywords, tags[] (slugi z listy dozwolonych), " +
      "confidence ('high'|'medium'|'low'), notes|null, " +
      "sponsor|null ({brand, code|null, note|null} — współpraca reklamowa, jeśli występuje).",
  });

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI compat: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  return RecipeDraft.parse(JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "")));
}

// ---------- Claude path ----------

async function draftRecipe(
  client: Anthropic,
  frames: string[],
  transcript: string | null,
  caption: string,
  categoryOptions: string,
  tagOptions: string
) {
  const imageBlocks = frames.map((f) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: fs.readFileSync(f).toString("base64"),
    },
  }));

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text:
              `Opis posta z TikToka:\n${caption || "(brak)"}\n\n` +
              `Transkrypcja audio:\n${transcript || "(brak transkrypcji)"}\n\n` +
              `Dozwolone kategorie (slug — nazwa):\n${categoryOptions}\n\n` +
              `Dozwolone tagi (slug — nazwa, wg grup):\n${tagOptions}\n\n` +
              "Odtwórz z tego kompletny przepis do publikacji na blogu.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(RecipeDraft) },
  });

  if (!response.parsed_output) throw new Error("Claude nie zwrócił poprawnego draftu");
  return response.parsed_output;
}

type Provider =
  | { kind: "openai"; cfg: CompatConfig }
  | { kind: "gemini" }
  | { kind: "claude"; client: Anthropic }
  | { kind: "openai-compat"; cfg: CompatConfig };

function pickProvider(): Provider | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      kind: "openai",
      cfg: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-4o",
      },
    };
  }
  if (process.env.GEMINI_API_KEY) return { kind: "gemini" };
  if (process.env.ANTHROPIC_API_KEY) return { kind: "claude", client: new Anthropic() };
  if (process.env.AI_COMPAT_BASE_URL && process.env.AI_COMPAT_API_KEY && process.env.AI_COMPAT_MODEL) {
    return {
      kind: "openai-compat",
      cfg: {
        baseUrl: process.env.AI_COMPAT_BASE_URL,
        apiKey: process.env.AI_COMPAT_API_KEY,
        model: process.env.AI_COMPAT_MODEL,
      },
    };
  }
  return null;
}

// Category tree lives in the DB — the model must pick from real slugs
async function loadCategoryOptions() {
  const { categories } = schema;
  const [parent] = await db.select().from(categories).where(eq(categories.slug, "przepisy"));
  if (!parent) return { options: "(brak)", allowed: new Set<string>() };
  const children = await db.select().from(categories).where(eq(categories.parentId, parent.id));
  return {
    options: children.map((c) => `${c.slug} — ${c.name}`).join("\n"),
    allowed: new Set(children.map((c) => c.slug)),
  };
}

// Curated tag vocabulary (tags.group != null) — the model may only pick
// from these; anything else is dropped before the draft is saved
async function loadTagOptions() {
  const { tags } = schema;
  const rows = await db.select().from(tags).where(isNotNull(tags.group));
  const byGroup = new Map<string, string[]>();
  for (const t of rows) {
    const list = byGroup.get(t.group!) ?? [];
    list.push(`${t.slug} — ${t.name}`);
    byGroup.set(t.group!, list);
  }
  const options = [...byGroup.entries()]
    .map(([g, list]) => `[${g}]\n${list.join("\n")}`)
    .join("\n");
  return {
    options: options || "(brak)",
    allowed: new Set(rows.map((t) => t.slug)),
  };
}

const TOTAL_STEPS = 5;

// Progress lands in the DB (live view in /admin/tiktok) and in the terminal
async function setProgress(impId: number, step: number, label: string) {
  const bar = "▓".repeat(step) + "░".repeat(TOTAL_STEPS - step);
  console.log(`[${impId}] ${bar} ${step}/${TOTAL_STEPS} ${label}`);
  await db
    .update(imports)
    .set({ progress: { step, total: TOTAL_STEPS, label } })
    .where(eq(imports.id, impId));
}

async function processOne(
  provider: Provider,
  imp: typeof imports.$inferSelect,
  cats: { options: string; allowed: Set<string> },
  tagVocab: { options: string; allowed: Set<string> }
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dnl-import-"));
  try {
    await db.update(imports).set({ status: "processing" }).where(eq(imports.id, imp.id));

    await setProgress(imp.id, 1, "Pobieranie wideo z TikToka...");
    const { videoPath, caption, durationSec, viewCount } = await downloadVideo(imp.tiktokUrl, dir);
    await db.update(imports).set({ caption: caption || null }).where(eq(imports.id, imp.id));

    await setProgress(imp.id, 2, "Wyciąganie klatek z wideo...");
    const frames = await extractFrames(videoPath, dir);

    let draft;
    let transcript: string | null = null;
    if (provider.kind === "gemini") {
      await setProgress(imp.id, 3, "Przygotowanie ścieżki audio...");
      const audioPath = await extractAudio(videoPath, dir).catch(() => null);
      await setProgress(imp.id, 4, "Gemini ogląda i słucha rolki...");
      draft = await draftRecipeGemini(frames, audioPath, caption, cats.options, tagVocab.options);
    } else {
      await setProgress(imp.id, 3, "Transkrypcja audio (Whisper)...");
      transcript = await transcribe(videoPath, dir).catch((e) => {
        console.warn(`[${imp.id}] Transkrypcja nieudana: ${e.message}`);
        return null;
      });
      const modelName = provider.kind === "claude" ? "Claude" : provider.cfg.model;
      await setProgress(imp.id, 4, `${modelName} analizuje ${frames.length} klatek i transkrypcję...`);
      if (provider.kind === "claude") {
        draft = await draftRecipe(provider.client, frames, transcript, caption, cats.options, tagVocab.options);
      } else {
        draft = await draftRecipeOpenAICompat(provider.cfg, frames, transcript, caption, cats.options, tagVocab.options);
      }
    }

    // Hard guarantee, independent of the prompt: only real slugs survive
    draft.categorySlugs = (draft.categorySlugs ?? []).filter((c: string) => cats.allowed.has(c));
    draft.tags = (draft.tags ?? []).filter((t: string) => tagVocab.allowed.has(t));

    // Fallback: the model is told to always estimate macros, but if it still
    // left kcal empty, estimate from the ingredients so no imported recipe ships
    // without nutrition. Non-fatal — a failure just leaves kcal null.
    if (draft.kcal == null) {
      const macroItems = (draft.ingredientGroups ?? [])
        .flatMap((g: any) => g.items ?? [])
        .map((s: any) => String(s).trim())
        .filter(Boolean);
      if (macroItems.length) {
        try {
          const m = await estimateMacros(draft.title ?? "przepis", draft.servings ?? null, macroItems);
          draft.kcal = m.kcal;
          draft.protein ??= m.protein;
          draft.fat ??= m.fat;
          draft.carbs ??= m.carbs;
          if (draft.servings == null && m.assumedServings) draft.servings = m.assumedServings;
          console.log(`[${imp.id}] makra doszacowane fallbackiem: ${m.kcal} kcal/porcję`);
        } catch (e: any) {
          console.warn(`[${imp.id}] fallback makr nieudany: ${e.message?.slice(0, 100)}`);
        }
      }
    }

    await setProgress(imp.id, 5, "Zapisywanie draftu...");
    const frameUrls = publishFrames(imp.id, frames);
    await db
      .update(imports)
      .set({
        status: "ready",
        aiDraft: { ...draft, frames: frameUrls, videoDurationSec: durationSec, videoViews: viewCount },
        transcript,
        videoPath: null,
        progress: null,
      })
      .where(eq(imports.id, imp.id));
    console.log(`[${imp.id}] ✓ Draft gotowy: "${draft.title}" (confidence: ${draft.confidence})`);
  } catch (e: any) {
    console.error(`[${imp.id}] ✗ ${e.message}`);
    await db
      .update(imports)
      .set({ status: "failed", operatorNotes: String(e.message).slice(0, 500), progress: null })
      .where(eq(imports.id, imp.id));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const NO_AI_KEY_HELP =
  "Ustaw jeden z:\n" +
  "  OPENAI_API_KEY        (vision + transkrypcja Whisper jednym kluczem; model przez OPENAI_MODEL, domyślnie gpt-4o)\n" +
  "  GEMINI_API_KEY        (darmowy tier, rozumie audio; klucz z aistudio.google.com)\n" +
  "  ANTHROPIC_API_KEY     (Claude)\n" +
  "  AI_COMPAT_BASE_URL + AI_COMPAT_API_KEY + AI_COMPAT_MODEL (Kimi/Moonshot, OpenRouter itp. — model musi mieć vision)";

// One pass over the queue. Returns the number of imports processed,
// or -1 when items are waiting but no AI key is configured.
async function processQueue(): Promise<number> {
  const pending = await db.select().from(imports).where(eq(imports.status, "pending"));
  if (pending.length === 0) return 0;

  const provider = pickProvider();
  if (!provider) {
    console.error(`W kolejce czeka ${pending.length} importów, ale brak klucza AI w środowisku.\n${NO_AI_KEY_HELP}`);
    return -1;
  }

  console.log(`Silnik AI: ${provider.kind}`);
  const [cats, tagVocab] = await Promise.all([loadCategoryOptions(), loadTagOptions()]);
  for (const imp of pending) {
    await processOne(provider, imp, cats, tagVocab);
  }
  return pending.length;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.argv.includes("--watch")) {
    const n = await processQueue();
    if (n === 0) console.log("Kolejka pusta.");
    await sql.end();
    if (n === -1) process.exit(1);
    return;
  }

  // Watch mode (the `worker` compose service). Single worker by design, so any
  // `processing` row at boot is an orphan of a previous run killed mid-import —
  // requeue them instead of leaving them stuck forever.
  const orphans = await db
    .update(imports)
    .set({ status: "pending", progress: null })
    .where(eq(imports.status, "processing"))
    .returning({ id: imports.id });
  if (orphans.length > 0) {
    console.log(`Przywrócono do kolejki ${orphans.length} importów przerwanych w trakcie przetwarzania.`);
  }

  console.log("Worker w trybie ciągłym: sprawdzam kolejkę co 10 s...");
  while (true) {
    let n = 0;
    try {
      n = await processQueue();
    } catch (e) {
      console.error(e);
    }
    // Missing AI key: no point hammering the queue (and the log) every 10 s
    await sleep(n === -1 ? 60_000 : 10_000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
