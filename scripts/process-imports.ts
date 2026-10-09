/**
 * TikTok -> recipe draft worker.
 *
 * Picks `pending` rows from the `imports` table and for each one:
 *   1. downloads the video + caption (yt-dlp)
 *   2. extracts frames (ffmpeg 1 fps -> dedupe + sharpness, lib/server/video-frames)
 *   3. transcribes the audio (Whisper, with timestamps)
 *   4. drafts the recipe with the "draft" model (vision: a sample of frames
 *      + timestamped transcript + caption) - steps carry a time window
 *   5. assigns frames to steps with a separate vision call (all unique frames,
 *      lib/server/assign-frames) and closes it deterministically (lib/frame-assign)
 *   6. audits completeness (lib/import-review); when confidence != high or
 *      something is missing, the "refine" model fills the gaps and every
 *      inferred value is recorded in aiDraft.aiFilled
 *   7. computes nutrition from an explicit ingredient breakdown
 *      (lib/server/nutrition-ai + lib/nutrition-calc) with the "nutrition" model
 *   8. saves the draft -> status `ready`; the operator reviews it in /admin/tiktok
 *
 * Models per stage come from app_settings (ai_models, editable in the admin)
 * with env fallbacks (OPENAI_MODEL / OPENAI_STRONG_MODEL). Providers other than
 * OpenAI (Gemini / Claude / OpenAI-compatible) still work for the draft stage;
 * stages 5-7 need OPENAI_API_KEY and are skipped without it (the draft is then
 * flagged as unverified).
 *
 * Requirements: yt-dlp and ffmpeg on PATH, one AI key in the environment.
 * Run: npm run imports:process   (cron-friendly; exits when the queue is empty)
 *      npm run imports:watch     (long-running: polls the queue every 10 s -
 *                                 this is how the `worker` compose service runs)
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { and, desc, eq, isNotNull, like, ne, or, sql as dsql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as schema from "../lib/db/schema";
import { runTiktokBacklog } from "../lib/server/tiktok-backlog-run";
import { runSubstitutionsGenerate } from "../lib/server/substitutions-run";
import { enhanceHeroToFile } from "../lib/server/enhance-hero";
import { chatJson, type ChatPart } from "../lib/server/ai-chat";
import { getAiModels, type AiModels } from "../lib/server/ai-models";
import { extractFrames, sampleFrames, type ExtractedFrame } from "../lib/server/video-frames";
import { assignFramesWithAi } from "../lib/server/assign-frames";
import { refineDraft } from "../lib/server/refine-draft";
import { buildBreakdown } from "../lib/server/nutrition-ai";
import { reviewDraft } from "../lib/import-review";
import { frameInfos, ingredientLines, type ImportDraft, type TranscriptSegment } from "../lib/import-draft";

const run = promisify(execFile);
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });
const { imports, jobs, appSettings } = schema;

// Modele bywają niesforne wobec schematu: pomijają nullable pola,
// zwracają liczby jako stringi itd. - walidacja jest więc liberalna
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
      startSec: optNum.describe("Sekunda rolki, w której ten krok się zaczyna (z transkrypcji); null gdy nie wiadomo"),
      endSec: optNum.describe("Sekunda rolki, w której ten krok się kończy; null gdy nie wiadomo"),
      // Tylko providery bez osobnego etapu przypisania klatek (Gemini/Claude bez klucza OpenAI)
      frameIndex: optNum.describe("Numer klatki (1-N) ilustrującej krok; null gdy żadna nie pasuje"),
    })
  ),
  heroFrameIndex: optNum.describe(
    "Numer klatki (1-N) najlepszej na zdjęcie główne: gotowe danie, apetyczny kadr; null gdy brak dobrej"
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
  // Modele czasem zwracają tablicę mimo instrukcji - normalizujemy do stringa
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
    videoId: info.id ? String(info.id) : null,
  };
}

// The submit endpoint already blocks obvious duplicates, but short links it
// failed to resolve (and legacy rows without video_id) only reveal the real
// video id here, after the download. Returns what the video duplicates, or null.
async function findDuplicate(impId: number, videoId: string) {
  const { recipes } = schema;
  const others = await db
    .select()
    .from(imports)
    .where(
      and(
        ne(imports.id, impId),
        or(eq(imports.videoId, videoId), like(imports.tiktokUrl, `%/video/${videoId}%`))
      )
    );
  const dup = others.find(
    (o) =>
      ["processing", "ready", "approved"].includes(o.status) ||
      (o.status === "pending" && o.id < impId)
  );
  if (dup) return { importId: dup.id, recipeId: dup.recipeId ?? null };
  const [rec] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(like(recipes.videoUrl, `%${videoId}%`));
  return rec ? { importId: null, recipeId: rec.id } : null;
}

// Frames double as hero-image candidates - publish them under /uploads.
// In production the worker (tools container) and the web server are separate
// containers, so frames must land on the shared media volume (UPLOADS_DIR),
// not the ephemeral public/ dir. Caddy serves /uploads/* from that volume.
function publishFile(importId: number, file: string): string {
  const baseDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
  const outDir = path.join(baseDir, "imports", String(importId));
  fs.mkdirSync(outDir, { recursive: true });
  const name = path.basename(file);
  fs.copyFileSync(file, path.join(outDir, name));
  return `/uploads/imports/${importId}/${name}`;
}

function publishFrames(importId: number, frames: string[]): string[] {
  return frames.map((f) => publishFile(importId, f));
}

// /uploads/imports/<id>/x.jpg -> absolute path on the media volume
function urlToPath(url: string): string {
  const baseDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
  return path.join(baseDir, url.replace(/^\/uploads\//, ""));
}

// Hero-image cleanup moved to lib/server/enhance-hero.ts and is now on-demand:
// the operator triggers it per import with the "Generuj AI hero" button in
// /admin/tiktok (which sets aiDraft.enhanceRequest); processEnhanceRequests()
// below picks it up. The batch worker no longer auto-generates - it would burn
// image credits on every import, including the ones you reject.

async function extractAudio(videoPath: string, dir: string): Promise<string> {
  const audioPath = path.join(dir, "audio.mp3");
  await run("ffmpeg", ["-i", videoPath, "-vn", "-ac", "1", "-b:a", "64k", audioPath], {
    timeout: 120_000,
  });
  return audioPath;
}

type Transcript = { text: string; segments: TranscriptSegment[] };

async function transcribe(videoPath: string, dir: string): Promise<Transcript | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const audioPath = await extractAudio(videoPath, dir);
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(audioPath)]), "audio.mp3");
  form.append("model", "whisper-1");
  form.append("language", "pl");
  // verbose_json = segmenty z czasem; z nich model wyznacza okna czasowe kroków
  form.append("response_format", "verbose_json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const segments: TranscriptSegment[] = Array.isArray(json.segments)
    ? json.segments
        .map((sg: any) => ({ start: Number(sg.start) || 0, end: Number(sg.end) || 0, text: String(sg.text ?? "").trim() }))
        .filter((sg: TranscriptSegment) => sg.text)
    : [];
  const text = (json.text || segments.map((sg) => sg.text).join(" ") || "").trim();
  return text ? { text, segments } : null;
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

// Transkrypcja z czasami do promptu: "[0:04] Dziś robimy..."
function transcriptForPrompt(t: Transcript | null): string {
  if (!t) return "(brak transkrypcji)";
  if (!t.segments.length) return t.text;
  return t.segments.map((sg) => `[${mmss(sg.start)}] ${sg.text}`).join("\n");
}

const SYSTEM_PROMPT =
  "Jesteś asystentem food blogerki Roksany (blog dietanaluzie.pl - zdrowe, fit przepisy po polsku). " +
  "Z materiałów z TikToka (klatki wideo, ścieżka audio lub transkrypcja, opis posta) odtwarzasz kompletny przepis. " +
  "OPIS POSTA to najbardziej wiarygodne źródło: autorka zwykle wypisuje tam pełną listę składników z ilościami - " +
  "przenieś je wiernie, co do jednostki. Transkrypcja i klatki służą głównie do odtworzenia kroków i technik. " +
  "Pisz naturalnym, ciepłym stylem bloga. Ilości składników podawaj po polsku ('pół szklanki', '2 łyżki'). " +
  "ZAWSZE oszacuj wartości odżywcze NA PORCJĘ ze składników (kcal, protein, fat, carbs) - " +
  "to jawny szacunek dietetyczny, więc nie zostawiaj tych pól pustych, gdy znasz składniki i liczbę porcji. " +
  "Jeśli czegoś nie widać ani nie słychać - nie zmyślaj; odnotuj wątpliwość w polu notes i obniż confidence. " +
  "Treści reklamowych (marka, kod rabatowy, współpraca) NIE mieszaj ze składnikami ani krokami - " +
  "wyciągnij je do pola sponsor, żeby można je było uczciwie oznaczyć na stronie. " +
  "KATEGORIE: przypisz przepis do 1-2 kategorii z listy dozwolonych (pole categorySlugs) - " +
  "to warunek publikacji, przepis bez kategorii nie trafia do archiwum. " +
  "TAGI: pole tags[] to 2-5 slugów wybranych WYŁĄCZNIE z listy dozwolonych tagów; nie wymyślaj " +
  "własnych. Najwyżej jeden tag z grupy 'sezon' i tylko wtedy, gdy przepis naprawdę pasuje " +
  "do okresu (np. sernik na zimno -> sezon-lato). " +
  "CZAS KROKÓW: transkrypcja ma znaczniki czasu [m:ss], a klatki podany czas w sekundach. Dla każdego kroku " +
  "podaj startSec i endSec (sekundy od początku rolki), w których ta czynność się dzieje; null gdy nie wiadomo. " +
  "Kroki muszą iść chronologicznie. " +
  "Pole 'about' to sekcja 'Kilka słów o tym przepisie' pod przepisem - pisz ją tak, jakby Roksana " +
  "opowiadała czytelniczce przy kawie: pierwsza osoba, konkrety o smaku, konsystencji i okazji " +
  "('robię go, gdy...'), naturalnie wplecione frazy, których ludzie szukają w Google. " +
  "Tekst MA brzmieć jak od człowieka: bez słów-wytrychów ('odkryj', 'idealny na każdą okazję', " +
  "'kulinarna podróż', 'rozpieść podniebienie'), bez wyliczanek po trzy przymiotniki, bez " +
  "podsumowania na końcu, bez zwrotów typu 'warto podkreślić', maksymalnie jeden wykrzyknik. " +
  "Krótkie i długie zdania na zmianę, jak w mowie. " +
  "ZAKAZ ABSOLUTNY: nigdy nie używaj długiego myślnika (-) ani półpauzy (–) w tekstach opisowych " +
  "(about, lead, seoDescription, kroki) - to najbardziej rozpoznawalny znak tekstu od AI; " +
  "zamiast tego stawiaj przecinek, dwukropek albo kropkę.";

// Dla providerów bez osobnego etapu przypisania klatek (brak klucza OpenAI)
const FRAMES_HINT =
  " KLATKI: klatki wideo są ponumerowane chronologicznie (Klatka 1..N). Do każdego kroku przypisz " +
  "w polu frameIndex numer klatki, która najlepiej ten krok ilustruje (moment czynności, nie planszę " +
  "tytułową); jeśli żadna klatka nie pasuje, zostaw null zamiast naciągać. Ta sama klatka może " +
  "ilustrować najwyżej jeden krok. W polu heroFrameIndex wskaż klatkę najlepszą na zdjęcie główne: " +
  "gotowe, wyeksponowane danie, ostry i apetyczny kadr; przy porównywalnych kadrach wybierz ten " +
  "z jak najmniejszą ilością nałożonych napisów i grafik.";

type PromptFrame = { thumbPath: string; t: number };
const frameLabel = (f: PromptFrame, i: number) => `Klatka ${i + 1} (t=${Math.round(f.t)} s):`;

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
          startSec: { type: "NUMBER", nullable: true },
          endSec: { type: "NUMBER", nullable: true },
          frameIndex: { type: "NUMBER", nullable: true },
        },
        required: ["body"],
      },
    },
    heroFrameIndex: { type: "NUMBER", nullable: true },
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
  frames: PromptFrame[],
  audioPath: string | null,
  caption: string,
  categoryOptions: string,
  tagOptions: string,
  withFramesHint: boolean
) {
  // Numbered labels before each frame so frameIndex/heroFrameIndex in the
  // draft can point back at a concrete image
  const parts: any[] = frames.flatMap((f, i) => [
    { text: frameLabel(f, i) },
    {
      inline_data: {
        mime_type: "image/jpeg",
        data: fs.readFileSync(f.thumbPath).toString("base64"),
      },
    },
  ]);
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
      `Dozwolone kategorie (slug - nazwa):\n${categoryOptions}\n\n` +
      `Dozwolone tagi (slug - nazwa, wg grup):\n${tagOptions}\n\n` +
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
        system_instruction: { parts: [{ text: SYSTEM_PROMPT + (withFramesHint ? FRAMES_HINT : "") }] },
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
  frames: PromptFrame[],
  transcript: string,
  caption: string,
  categoryOptions: string,
  tagOptions: string,
  withFramesHint: boolean
) {
  const content: ChatPart[] = frames.flatMap((f, i): ChatPart[] => [
    { type: "text", text: frameLabel(f, i) },
    {
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(f.thumbPath).toString("base64")}` },
    },
  ]);
  content.push({
    type: "text",
    text:
      `Opis posta z TikToka:\n${caption || "(brak)"}\n\n` +
      `Transkrypcja audio (z czasem):\n${transcript}\n\n` +
      `Dozwolone kategorie (slug - nazwa):\n${categoryOptions}\n\n` +
      `Dozwolone tagi (slug - nazwa, wg grup):\n${tagOptions}\n\n` +
      "Odtwórz z tego kompletny przepis do publikacji na blogu. " +
      "Odpowiedz WYŁĄCZNIE poprawnym JSON-em o polach: title, lead, about (sekcja 'Kilka słów " +
      "o tym przepisie', 2-3 akapity rozdzielone pustą linią), categorySlugs[] (1-2 slugi z listy " +
      "dozwolonych), difficulty ('latwy'|'sredni'|'trudny'|null), ingredientGroups " +
      "[{title|null, items[]}], steps " +
      "[{title|null, body, tip|null, startSec|null, endSec|null" +
      (withFramesHint ? ", frameIndex|null (numer klatki 1-N ilustrującej krok)" : "") +
      "}], " +
      (withFramesHint ? "heroFrameIndex|null (numer klatki najlepszej na zdjęcie główne), " : "") +
      "prepTimeMin|null, " +
      "totalTimeMin|null, servings|null, kcal|null, protein|null, fat|null, carbs|null, " +
      "seoTitle, seoDescription, keywords, tags[] (slugi z listy dozwolonych), " +
      "confidence ('high'|'medium'|'low'), notes|null, " +
      "sponsor|null ({brand, code|null, note|null} - współpraca reklamowa, jeśli występuje).",
  });

  const { data } = await chatJson({
    model: cfg.model,
    system: SYSTEM_PROMPT + (withFramesHint ? FRAMES_HINT : ""),
    user: content,
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    maxTokens: 12000,
  });
  return RecipeDraft.parse(data);
}

// ---------- Claude path ----------

async function draftRecipe(
  client: Anthropic,
  frames: PromptFrame[],
  transcript: string,
  caption: string,
  categoryOptions: string,
  tagOptions: string,
  withFramesHint: boolean
) {
  const imageBlocks = frames.flatMap((f, i) => [
    { type: "text" as const, text: frameLabel(f, i) },
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: fs.readFileSync(f.thumbPath).toString("base64"),
      },
    },
  ]);

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: SYSTEM_PROMPT + (withFramesHint ? FRAMES_HINT : ""),
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text:
              `Opis posta z TikToka:\n${caption || "(brak)"}\n\n` +
              `Transkrypcja audio (z czasem):\n${transcript}\n\n` +
              `Dozwolone kategorie (slug - nazwa):\n${categoryOptions}\n\n` +
              `Dozwolone tagi (slug - nazwa, wg grup):\n${tagOptions}\n\n` +
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

function pickProvider(models: AiModels): Provider | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      kind: "openai",
      cfg: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        model: models.draft,
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

// Category tree lives in the DB - the model must pick from real slugs
async function loadCategoryOptions() {
  const { categories } = schema;
  const [parent] = await db.select().from(categories).where(eq(categories.slug, "przepisy"));
  if (!parent) return { options: "(brak)", allowed: new Set<string>() };
  const children = await db.select().from(categories).where(eq(categories.parentId, parent.id));
  return {
    options: children.map((c) => `${c.slug} - ${c.name}`).join("\n"),
    allowed: new Set(children.map((c) => c.slug)),
  };
}

// Curated tag vocabulary (tags.group != null) - the model may only pick
// from these; anything else is dropped before the draft is saved
async function loadTagOptions() {
  const { tags } = schema;
  const rows = await db.select().from(tags).where(isNotNull(tags.group));
  const byGroup = new Map<string, string[]>();
  for (const t of rows) {
    const list = byGroup.get(t.group!) ?? [];
    list.push(`${t.slug} - ${t.name}`);
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

const TOTAL_STEPS = 8;

// Progress lands in the DB (live view in /admin/tiktok) and in the terminal
async function setProgress(impId: number, step: number, label: string) {
  const bar = "▓".repeat(step) + "░".repeat(TOTAL_STEPS - step);
  console.log(`[${impId}] ${bar} ${step}/${TOTAL_STEPS} ${label}`);
  await db
    .update(imports)
    .set({ progress: { step, total: TOTAL_STEPS, label } })
    .where(eq(imports.id, impId));
}

const hasOpenAI = () => !!process.env.OPENAI_API_KEY;

async function processOne(
  provider: Provider,
  models: AiModels,
  imp: typeof imports.$inferSelect,
  cats: { options: string; allowed: Set<string> },
  tagVocab: { options: string; allowed: Set<string> }
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dnl-import-"));
  try {
    await db.update(imports).set({ status: "processing" }).where(eq(imports.id, imp.id));

    await setProgress(imp.id, 1, "Pobieranie wideo z TikToka...");
    const { videoPath, caption, durationSec, viewCount, videoId } =
      await downloadVideo(imp.tiktokUrl, dir);
    await db
      .update(imports)
      .set({ caption: caption || null, videoId: videoId ?? imp.videoId })
      .where(eq(imports.id, imp.id));

    if (videoId && !imp.force) {
      const dup = await findDuplicate(imp.id, videoId);
      if (dup) {
        await db
          .update(imports)
          .set({
            status: "duplicate",
            recipeId: dup.recipeId,
            operatorNotes: dup.recipeId
              ? "Ten film jest już w opublikowanym przepisie"
              : `Ten film czeka już w kolejce jako import #${dup.importId}`,
            progress: null,
          })
          .where(eq(imports.id, imp.id));
        console.log(`[${imp.id}] ⏭ Duplikat wideo ${videoId} - pomijam przetwarzanie`);
        return;
      }
    }

    await setProgress(imp.id, 2, "Wyciąganie i odsiewanie klatek z wideo...");
    const frames: ExtractedFrame[] = await extractFrames(videoPath, dir);
    console.log(`[${imp.id}] ${frames.length} unikalnych klatek`);
    // Etap przypisania klatek jest osobny (OpenAI). Bez klucza OpenAI model
    // draftu dostaje wszystkie klatki i sam wskazuje frameIndex (stara ścieżka).
    const separateAssign = hasOpenAI();
    const promptFrames: PromptFrame[] = separateAssign ? sampleFrames(frames, 12) : frames;

    let draft: z.infer<typeof RecipeDraft>;
    let transcript: Transcript | null = null;
    if (provider.kind === "gemini") {
      await setProgress(imp.id, 3, "Przygotowanie ścieżki audio...");
      const audioPath = await extractAudio(videoPath, dir).catch(() => null);
      await setProgress(imp.id, 4, "Gemini ogląda i słucha rolki...");
      draft = await draftRecipeGemini(promptFrames, audioPath, caption, cats.options, tagVocab.options, !separateAssign);
    } else {
      await setProgress(imp.id, 3, "Transkrypcja audio (Whisper)...");
      transcript = await transcribe(videoPath, dir).catch((e) => {
        console.warn(`[${imp.id}] Transkrypcja nieudana: ${e.message}`);
        return null;
      });
      const modelName = provider.kind === "claude" ? "Claude" : provider.cfg.model;
      await setProgress(imp.id, 4, `${modelName} analizuje ${promptFrames.length} klatek i transkrypcję...`);
      const tx = transcriptForPrompt(transcript);
      if (provider.kind === "claude") {
        draft = await draftRecipe(provider.client, promptFrames, tx, caption, cats.options, tagVocab.options, !separateAssign);
      } else {
        draft = await draftRecipeOpenAICompat(provider.cfg, promptFrames, tx, caption, cats.options, tagVocab.options, !separateAssign);
      }
    }

    // Hard guarantee, independent of the prompt: only real slugs survive
    draft.categorySlugs = (draft.categorySlugs ?? []).filter((c: string) => cats.allowed.has(c));
    draft.tags = (draft.tags ?? []).filter((t: string) => tagVocab.allowed.has(t));

    // Published URLs for frames (the admin and accept endpoint deal in URLs)
    const frameUrlList = publishFrames(imp.id, frames.map((f) => f.path));
    const urlAt = (i: number | null) => (i != null && i >= 0 && i < frameUrlList.length ? frameUrlList[i] : null);
    const usedModels: NonNullable<ImportDraft["models"]> = { draft: provider.kind === "claude" ? "claude-opus-4-8" : provider.kind === "gemini" ? process.env.GEMINI_MODEL || "gemini-2.5-flash" : provider.cfg.model };

    // ---- 5. frames -> steps
    let stepImages: (string | null)[] = draft.steps.map(() => null);
    let stepCandidates: string[][] = draft.steps.map(() => []);
    let heroFrame: string | null = null;
    let heroCandidates: string[] = [];
    if (separateAssign) {
      await setProgress(imp.id, 5, `Dobieranie klatek do ${draft.steps.length} kroków (${frames.length} klatek)...`);
      try {
        const res = await assignFramesWithAi({
          title: draft.title,
          steps: draft.steps.map((st) => ({ body: st.body, title: st.title, startSec: st.startSec, endSec: st.endSec })),
          frames: frames.map((f, i) => ({ url: frameUrlList[i], t: f.t, sharpness: f.sharpness, thumbPath: f.thumbPath })),
          model: models.draft,
        });
        stepImages = res.stepImages.map(urlAt);
        stepCandidates = res.stepCandidates.map((ids) => ids.map(urlAt).filter((u): u is string => !!u));
        heroFrame = urlAt(res.heroIndex);
        heroCandidates = res.heroCandidates.map(urlAt).filter((u): u is string => !!u);
        usedModels.assign = models.draft;
      } catch (e: any) {
        console.warn(`[${imp.id}] przypisanie klatek nieudane: ${e.message?.slice(0, 160)}`);
      }
    } else {
      const frameAt = (n: number | null) => {
        const i = n == null ? NaN : Math.round(n) - 1;
        return urlAt(Number.isInteger(i) ? i : null);
      };
      stepImages = draft.steps.map((st) => frameAt(st.frameIndex));
      heroFrame = frameAt(draft.heroFrameIndex);
      heroCandidates = heroFrame ? [heroFrame] : [];
    }

    // Draft w docelowym kształcie (bez pól roboczych frameIndex/heroFrameIndex)
    let full: ImportDraft = {
      ...draft,
      ingredientGroups: (draft.ingredientGroups ?? []).map((g) => ({ title: g.title ?? null, items: g.items ?? [] })),
      keywords: draft.keywords ?? "",
      difficulty: draft.difficulty ?? null,
      notes: draft.notes ?? null,
      sponsor: draft.sponsor
        ? { brand: draft.sponsor.brand, code: draft.sponsor.code ?? null, note: draft.sponsor.note ?? null }
        : null,
      prepTimeMin: draft.prepTimeMin ?? null,
      totalTimeMin: draft.totalTimeMin ?? null,
      servings: draft.servings ?? null,
      kcal: draft.kcal ?? null,
      protein: draft.protein ?? null,
      fat: draft.fat ?? null,
      carbs: draft.carbs ?? null,
      steps: draft.steps.map((st, i) => ({
        title: st.title ?? null,
        body: st.body,
        tip: st.tip ?? null,
        startSec: st.startSec ?? null,
        endSec: st.endSec ?? null,
        image: stepImages[i],
        frameCandidates: stepCandidates[i],
      })),
      heroFrame,
      heroEnhanced: null,
      heroCandidates,
      frames: frames.map((f, i) => ({ url: frameUrlList[i], t: f.t, sharpness: f.sharpness })),
      videoDurationSec: durationSec,
      videoViews: viewCount,
      transcriptSegments: transcript?.segments ?? null,
      aiFilled: [],
      models: usedModels,
    };
    delete (full as any).frameIndex;
    delete (full as any).heroFrameIndex;

    // ---- 6. audyt + dopełnienie
    const review1 = reviewDraft(full);
    const gapCodes = new Set(["ingredients-no-amount", "few-steps", "servings-missing", "time-missing", "no-ingredients"]);
    const needsRefine = full.confidence !== "high" || review1.issues.some((i) => gapCodes.has(i.code));
    if (needsRefine && hasOpenAI()) {
      await setProgress(imp.id, 6, `Dopełnianie braków (${models.refine})...`);
      try {
        const r = await refineDraft({
          draft: full,
          caption,
          transcript: transcript?.text ?? null,
          issues: review1.issues.filter((i) => i.code !== "kcal-missing"),
          model: models.refine,
        });
        full = { ...r.draft, aiFilled: r.filled, refinedWith: r.model };
        usedModels.refine = r.model;
        console.log(`[${imp.id}] dopełniono ${r.filled.length} pól (${r.filled.filter((f) => f.basis === "inferred").length} wywnioskowanych)`);
      } catch (e: any) {
        console.warn(`[${imp.id}] dopełnianie nieudane: ${e.message?.slice(0, 160)}`);
      }
    } else {
      await setProgress(imp.id, 6, needsRefine ? "Dopełnianie pominięte (brak OPENAI_API_KEY)" : "Draft kompletny, dopełnianie zbędne");
    }

    // ---- 7. wartości odżywcze z rozbicia składników
    const lines = ingredientLines(full);
    if (hasOpenAI() && lines.length) {
      await setProgress(imp.id, 7, `Liczenie wartości odżywczych ze składników (${models.nutrition})...`);
      try {
        const servingsFilled = (full.aiFilled ?? []).find((f) => f.field === "servings");
        const nutrition = await buildBreakdown({
          title: full.title,
          lines,
          servings: full.servings ?? null,
          servingsSource: servingsFilled ? (servingsFilled.basis === "inferred" ? "ai-estimate" : servingsFilled.basis === "caption" ? "caption" : "transcript") : "draft",
          context: caption?.slice(0, 600) || null,
          model: models.nutrition,
          draftPerServing: { kcal: full.kcal ?? undefined, protein: full.protein ?? undefined, fat: full.fat ?? undefined, carbs: full.carbs ?? undefined },
        });
        full.nutrition = nutrition;
        usedModels.nutrition = nutrition.model;
        if (nutrition.perServing) {
          full.kcal = nutrition.perServing.kcal;
          full.protein = nutrition.perServing.protein;
          full.fat = nutrition.perServing.fat;
          full.carbs = nutrition.perServing.carbs;
        }
        if (full.servings == null && nutrition.servings) full.servings = nutrition.servings;
        console.log(`[${imp.id}] odżywcze: ${nutrition.perServing?.kcal ?? "?"} kcal/porcję przy ${nutrition.servings ?? "?"} porcjach (${nutrition.issues.length} uwag)`);
      } catch (e: any) {
        console.warn(`[${imp.id}] wartości odżywcze nieudane: ${e.message?.slice(0, 160)}`);
        full.nutrition = null;
      }
    } else if (!hasOpenAI()) {
      await setProgress(imp.id, 7, "Wartości odżywcze niezweryfikowane (brak OPENAI_API_KEY)");
    }
    full.review = reviewDraft(full);
    if (!hasOpenAI()) {
      full.review.issues.unshift({
        severity: "warning",
        code: "unverified",
        message: "Brak OPENAI_API_KEY: wartości odżywcze pochodzą z modelu wideo i nie zostały przeliczone ze składników.",
      });
    }

    await setProgress(imp.id, 8, "Zapisywanie draftu...");
    await db
      .update(imports)
      .set({
        status: "ready",
        aiDraft: full,
        transcript: transcript?.text ?? null,
        videoPath: null,
        progress: null,
      })
      .where(eq(imports.id, imp.id));
    console.log(
      `[${imp.id}] ✓ Draft gotowy: "${full.title}" (pewność: ${full.confidence}, ${full.review.issues.length} uwag, ${full.review.blocking ? "BLOKADA" : "do akceptacji"})`
    );
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
  "  OPENAI_API_KEY        (vision + transkrypcja Whisper jednym kluczem; modele przez OPENAI_MODEL / OPENAI_STRONG_MODEL lub panel)\n" +
  "  GEMINI_API_KEY        (darmowy tier, rozumie audio; klucz z aistudio.google.com)\n" +
  "  ANTHROPIC_API_KEY     (Claude)\n" +
  "  AI_COMPAT_BASE_URL + AI_COMPAT_API_KEY + AI_COMPAT_MODEL (Kimi/Moonshot, OpenRouter itp. - model musi mieć vision)";

// One pass over the queue. Returns the number of imports processed,
// or -1 when items are waiting but no AI key is configured.
async function processQueue(): Promise<number> {
  const pending = await db.select().from(imports).where(eq(imports.status, "pending"));
  if (pending.length === 0) return 0;

  const models = await getAiModels(db);
  const provider = pickProvider(models);
  if (!provider) {
    console.error(`W kolejce czeka ${pending.length} importów, ale brak klucza AI w środowisku.\n${NO_AI_KEY_HELP}`);
    return -1;
  }

  console.log(`Silnik AI: ${provider.kind} (draft ${models.draft}, dopełnianie ${models.refine}, odżywcze ${models.nutrition})`);
  const [cats, tagVocab] = await Promise.all([loadCategoryOptions(), loadTagOptions()]);
  for (const imp of pending) {
    await processOne(provider, models, imp, cats, tagVocab);
  }
  return pending.length;
}

// On-demand hero generation queued from /admin/tiktok. Each `ready` import may
// carry aiDraft.enhanceRequest = { frame }; we clean that frame up, write the
// result next to it (unique name so Caddy's immutable cache can't serve stale)
// and store heroEnhanced. Errors land in aiDraft.enhanceError for the admin.
async function processEnhanceRequests(): Promise<number> {
  const rows = await db.select().from(imports).where(eq(imports.status, "ready"));
  let done = 0;
  for (const imp of rows) {
    const draft = imp.aiDraft as any;
    const frame: string | undefined = draft?.enhanceRequest?.frame;
    if (!frame) continue;
    const frames: string[] = frameInfos(draft).map((f) => f.url);
    if (!frames.includes(frame)) {
      await db
        .update(imports)
        .set({ aiDraft: { ...draft, enhanceRequest: null, enhanceError: "Nieznana klatka" } })
        .where(eq(imports.id, imp.id));
      continue;
    }
    const outUrl = `${frame.slice(0, frame.lastIndexOf("/"))}/hero-ai-${Date.now()}.jpg`;
    try {
      const ok = await enhanceHeroToFile(urlToPath(frame), urlToPath(outUrl));
      if (!ok) throw new Error("Brak klucza modelu obrazu (GEMINI_API_KEY/OPENAI_API_KEY)");
      await db
        .update(imports)
        .set({ aiDraft: { ...draft, heroEnhanced: outUrl, enhanceRequest: null, enhanceError: null } })
        .where(eq(imports.id, imp.id));
      console.log(`[${imp.id}] ✨ Hero wygenerowany na żądanie: ${outUrl}`);
    } catch (e: any) {
      console.error(`[${imp.id}] Generacja hero nieudana: ${e.message}`);
      await db
        .update(imports)
        .set({ aiDraft: { ...draft, enhanceRequest: null, enhanceError: String(e.message).slice(0, 300) } })
        .where(eq(imports.id, imp.id));
    }
    done++;
  }
  return done;
}

// "Dobierz klatki ponownie" z panelu: aiDraft.reassignRequest = true. Miniatury
// dla modelu odtwarzamy z opublikowanych pełnych klatek do katalogu tymczasowego.
async function processReassignRequests(): Promise<number> {
  const rows = await db
    .select()
    .from(imports)
    .where(and(eq(imports.status, "ready"), dsql`${imports.aiDraft}->>'reassignRequest' = 'true'`));
  let done = 0;
  for (const imp of rows) {
    const draft = imp.aiDraft as ImportDraft;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dnl-reassign-"));
    try {
      if (!hasOpenAI()) throw new Error("Brak OPENAI_API_KEY");
      const models = await getAiModels(db);
      const infos = frameInfos(draft);
      const frames = [] as { url: string; t: number | null; sharpness?: number | null; thumbPath: string }[];
      for (let i = 0; i < infos.length; i++) {
        const src = urlToPath(infos[i].url);
        if (!fs.existsSync(src)) continue;
        const thumb = path.join(tmp, `t-${i}.jpg`);
        await sharp(src).resize(512, null, { fit: "inside" }).jpeg({ quality: 80 }).toFile(thumb);
        frames.push({ ...infos[i], thumbPath: thumb });
      }
      if (!frames.length) throw new Error("Brak plików klatek na dysku");
      const res = await assignFramesWithAi({
        title: draft.title,
        steps: draft.steps.map((st) => ({ body: st.body, title: st.title, startSec: st.startSec, endSec: st.endSec })),
        frames,
        model: models.draft,
      });
      const urlAt = (i: number | null) => (i != null && frames[i] ? frames[i].url : null);
      const next: ImportDraft = {
        ...draft,
        steps: draft.steps.map((st, i) => ({
          ...st,
          image: urlAt(res.stepImages[i]),
          frameCandidates: res.stepCandidates[i].map(urlAt).filter((u): u is string => !!u),
        })),
        heroFrame: urlAt(res.heroIndex) ?? draft.heroFrame,
        heroCandidates: res.heroCandidates.map(urlAt).filter((u): u is string => !!u),
        models: { ...(draft.models ?? {}), assign: models.draft },
        reassignRequest: null,
        reassignError: null,
      };
      await db.update(imports).set({ aiDraft: next }).where(eq(imports.id, imp.id));
      console.log(`[${imp.id}] 🖼 Klatki dobrane ponownie`);
    } catch (e: any) {
      console.error(`[${imp.id}] Ponowne dobranie klatek nieudane: ${e.message}`);
      await db
        .update(imports)
        .set({ aiDraft: { ...draft, reassignRequest: null, reassignError: String(e.message).slice(0, 300) } })
        .where(eq(imports.id, imp.id));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    done++;
  }
  return done;
}

// Sprzątanie plików po decyzji operatora (web ma media tylko do odczytu):
// aiDraft.cleanupRequest = { keep: [url...] }. Pusta lista keep = cały katalog
// importu znika; gdy wiersz ma status rejected i deleteRow, kasujemy też wiersz.
async function processCleanupRequests(): Promise<number> {
  const rows = await db
    .select()
    .from(imports)
    .where(dsql`${imports.aiDraft}->'cleanupRequest' is not null`);
  let done = 0;
  for (const imp of rows) {
    const draft = imp.aiDraft as any;
    const req = draft?.cleanupRequest as { keep?: string[]; deleteRow?: boolean } | null;
    if (!req) continue;
    const keep = new Set((req.keep ?? []).map((u: string) => path.basename(u)));
    const dir = path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads"), "imports", String(imp.id));
    let removed = 0;
    try {
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir)) {
          if (keep.has(f)) continue;
          fs.rmSync(path.join(dir, f), { force: true });
          removed++;
        }
        if (keep.size === 0) fs.rmSync(dir, { recursive: true, force: true });
      }
      if (req.deleteRow) {
        await db.delete(imports).where(eq(imports.id, imp.id));
      } else {
        await db
          .update(imports)
          .set({ aiDraft: { ...draft, cleanupRequest: null, cleanedAt: new Date().toISOString() } })
          .where(eq(imports.id, imp.id));
      }
      console.log(`[${imp.id}] 🧹 Usunięto ${removed} plików${req.deleteRow ? " i wiersz importu" : ""}`);
    } catch (e: any) {
      console.error(`[${imp.id}] Sprzątanie nieudane: ${e.message}`);
      await db
        .update(imports)
        .set({ aiDraft: { ...draft, cleanupRequest: null, cleanupError: String(e.message).slice(0, 300) } })
        .where(eq(imports.id, imp.id));
    }
    done++;
  }
  return done;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Zlecenia z admina (jobs) + odświeżanie backlogu wg interwału -----------
// Przycisk w panelu nie może odpalić yt-dlp w kontenerze web, więc zostawia
// wiersz w `jobs`; my go wykonujemy tutaj. Dodatkowo, gdy w app_settings
// ustawiono tiktok_backlog_interval_days > 0, sami dokładamy zlecenie
// po upływie interwału od ostatniego udanego odświeżenia.

async function enqueueIntervalBacklog() {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "tiktok_backlog_interval_days"));
  const days = Number(setting?.value ?? 0);
  if (!days || days <= 0) return;

  const active = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.kind, "tiktok_backlog"), or(eq(jobs.status, "pending"), eq(jobs.status, "running"))));
  if (active.length > 0) return;

  const [last] = await db
    .select({ finishedAt: jobs.finishedAt })
    .from(jobs)
    .where(and(eq(jobs.kind, "tiktok_backlog"), eq(jobs.status, "done")))
    .orderBy(desc(jobs.finishedAt))
    .limit(1);
  const due = !last?.finishedAt || Date.now() - new Date(last.finishedAt).getTime() > days * 24 * 3600 * 1000;
  if (due) {
    await db.insert(jobs).values({ kind: "tiktok_backlog", status: "pending" });
    console.log(`Interwał ${days} dni minął: dodaję zlecenie odświeżenia backlogu TikTok.`);
  }
}

async function processJobs(): Promise<number> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "pending"))
    .orderBy(jobs.createdAt)
    .limit(1);
  if (!job) return 0;

  await db.update(jobs).set({ status: "running", startedAt: new Date() }).where(eq(jobs.id, job.id));
  const lines: string[] = [];
  const log = (s: string) => {
    lines.push(s);
    console.log(`[job ${job.kind}#${job.id}] ${s}`);
  };

  try {
    if (job.kind === "tiktok_backlog") {
      await runTiktokBacklog(db, log);
    } else if (job.kind === "substitutions") {
      const payload = (job.payload ?? {}) as { limit?: number };
      await runSubstitutionsGenerate(db, log, { limit: payload.limit ?? 10 });
    } else {
      throw new Error(`Nieznany rodzaj zlecenia: ${job.kind}`);
    }
    await db
      .update(jobs)
      .set({ status: "done", finishedAt: new Date(), log: lines.slice(-25).join("\n") })
      .where(eq(jobs.id, job.id));
  } catch (e: any) {
    lines.push(`BŁĄD: ${e?.message?.slice(0, 300)}`);
    await db
      .update(jobs)
      .set({ status: "error", finishedAt: new Date(), log: lines.slice(-25).join("\n") })
      .where(eq(jobs.id, job.id));
  }
  return 1;
}

async function main() {
  if (!process.argv.includes("--watch")) {
    const n = await processQueue();
    await processEnhanceRequests();
    await processReassignRequests();
    await processCleanupRequests();
    await processJobs();
    if (n === 0) console.log("Kolejka pusta.");
    await sql.end();
    if (n === -1) process.exit(1);
    return;
  }

  // Watch mode (the `worker` compose service). Single worker by design, so any
  // `processing` row at boot is an orphan of a previous run killed mid-import -
  // requeue them instead of leaving them stuck forever.
  const orphans = await db
    .update(imports)
    .set({ status: "pending", progress: null })
    .where(eq(imports.status, "processing"))
    .returning({ id: imports.id });
  if (orphans.length > 0) {
    console.log(`Przywrócono do kolejki ${orphans.length} importów przerwanych w trakcie przetwarzania.`);
  }

  // Analogicznie: zlecenia `running` po ubitym workerze wracają do pending
  const orphanJobs = await db
    .update(jobs)
    .set({ status: "pending", startedAt: null })
    .where(eq(jobs.status, "running"))
    .returning({ id: jobs.id });
  if (orphanJobs.length > 0) {
    console.log(`Przywrócono do kolejki ${orphanJobs.length} zleceń przerwanych w trakcie.`);
  }

  console.log("Worker w trybie ciągłym: sprawdzam kolejkę co 10 s...");
  let lastIntervalCheck = 0;
  while (true) {
    let n = 0;
    try {
      n = await processQueue();
    } catch (e) {
      console.error(e);
    }
    try {
      await processEnhanceRequests();
      await processReassignRequests();
      await processCleanupRequests();
    } catch (e) {
      console.error(e);
    }
    try {
      // Interwał sprawdzamy co ~10 min (tania para zapytań, ale bez spamu)
      if (Date.now() - lastIntervalCheck > 10 * 60 * 1000) {
        lastIntervalCheck = Date.now();
        await enqueueIntervalBacklog();
      }
      await processJobs();
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
