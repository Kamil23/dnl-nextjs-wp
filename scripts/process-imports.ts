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
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
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

const RecipeDraft = z.object({
  title: z.string(),
  lead: z.string().describe("Krótki, apetyczny opis przepisu (2-3 zdania), po polsku"),
  ingredientGroups: z.array(
    z.object({
      title: z.string().nullable().describe("Nazwa sekcji np. 'Ciasto'; null gdy jedna sekcja"),
      items: z.array(z.string()).describe("Składnik z ilością, np. 'pół szklanki płatków owsianych'"),
    })
  ),
  steps: z.array(
    z.object({
      title: z.string().nullable(),
      body: z.string(),
      tip: z.string().nullable(),
    })
  ),
  prepTimeMin: z.number().nullable(),
  totalTimeMin: z.number().nullable(),
  servings: z.number().nullable(),
  kcal: z.number().nullable().describe("Szacunkowe kcal na porcję ze składników"),
  protein: z.number().nullable(),
  fat: z.number().nullable(),
  carbs: z.number().nullable(),
  seoTitle: z.string().describe("Tytuł SEO do 60 znaków, kończy się na ' - Dieta na luzie'"),
  seoDescription: z.string().describe("Opis SEO 140-160 znaków, po polsku, zachęcający"),
  keywords: z.string(),
  tags: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]).describe("Pewność odczytu przepisu z materiału"),
  notes: z.string().nullable().describe("Wątpliwości dla operatora, np. niepewne ilości"),
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
  return { videoPath: path.join(dir, video), caption: info.description || info.title || "" };
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
  await run("ffmpeg", [
    "-i", videoPath, "-vf", `fps=${fps},scale=720:-2`, "-frames:v", String(maxFrames),
    "-q:v", "4", path.join(framesDir, "frame-%02d.jpg"),
  ], { timeout: 120_000 });
  return fs.readdirSync(framesDir).sort().map((f) => path.join(framesDir, f));
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
  "Pisz naturalnym, ciepłym stylem bloga. Ilości składników podawaj po polsku ('pół szklanki', '2 łyżki'). " +
  "Jeśli czegoś nie widać ani nie słychać — nie zmyślaj; odnotuj wątpliwość w polu notes i obniż confidence.";

// ---------- Gemini path (free tier; understands the audio track natively) ----------

// zod -> Gemini responseSchema (OpenAPI subset), kept in sync with RecipeDraft
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    lead: { type: "STRING" },
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
  },
  required: ["title", "lead", "ingredientGroups", "steps", "seoTitle", "seoDescription", "keywords", "tags", "confidence"],
};

async function draftRecipeGemini(
  frames: string[],
  audioPath: string | null,
  caption: string
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
  caption: string
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
      "Odtwórz z tego kompletny przepis do publikacji na blogu. " +
      "Odpowiedz WYŁĄCZNIE poprawnym JSON-em o polach: title, lead, ingredientGroups " +
      "[{title|null, items[]}], steps [{title|null, body, tip|null}], prepTimeMin|null, " +
      "totalTimeMin|null, servings|null, kcal|null, protein|null, fat|null, carbs|null, " +
      "seoTitle, seoDescription, keywords, tags[], confidence ('high'|'medium'|'low'), notes|null.",
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
  caption: string
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
    system:
      "Jesteś asystentem food blogerki Roksany (blog dietanaluzie.pl — zdrowe, fit przepisy po polsku). " +
      "Z materiałów z TikToka (klatki wideo, transkrypcja audio, opis posta) odtwarzasz kompletny przepis. " +
      "Pisz naturalnym, ciepłym stylem bloga. Ilości składników podawaj po polsku ('pół szklanki', '2 łyżki'). " +
      "Jeśli czegoś nie widać ani nie słychać — nie zmyślaj; odnotuj wątpliwość w polu notes i obniż confidence.",
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

async function processOne(provider: Provider, imp: typeof imports.$inferSelect) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dnl-import-"));
  try {
    await db.update(imports).set({ status: "processing" }).where(eq(imports.id, imp.id));

    console.log(`[${imp.id}] Pobieram ${imp.tiktokUrl}...`);
    const { videoPath, caption } = await downloadVideo(imp.tiktokUrl, dir);

    console.log(`[${imp.id}] Klatki + audio...`);
    const frames = await extractFrames(videoPath, dir);

    let draft;
    let transcript: string | null = null;
    if (provider.kind === "gemini") {
      const audioPath = await extractAudio(videoPath, dir).catch(() => null);
      console.log(`[${imp.id}] Gemini analizuje (${frames.length} klatek + audio)...`);
      draft = await draftRecipeGemini(frames, audioPath, caption);
    } else {
      transcript = await transcribe(videoPath, dir).catch((e) => {
        console.warn(`[${imp.id}] Transkrypcja nieudana: ${e.message}`);
        return null;
      });
      if (provider.kind === "claude") {
        console.log(`[${imp.id}] Claude analizuje (${frames.length} klatek)...`);
        draft = await draftRecipe(provider.client, frames, transcript, caption);
      } else {
        console.log(`[${imp.id}] ${provider.cfg.model} analizuje (${frames.length} klatek)...`);
        draft = await draftRecipeOpenAICompat(provider.cfg, frames, transcript, caption);
      }
    }

    await db
      .update(imports)
      .set({ status: "ready", aiDraft: draft, transcript, videoPath: null })
      .where(eq(imports.id, imp.id));
    console.log(`[${imp.id}] ✓ Draft gotowy: "${draft.title}" (confidence: ${draft.confidence})`);
  } catch (e: any) {
    console.error(`[${imp.id}] ✗ ${e.message}`);
    await db
      .update(imports)
      .set({ status: "failed", operatorNotes: String(e.message).slice(0, 500) })
      .where(eq(imports.id, imp.id));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const pending = await db.select().from(imports).where(eq(imports.status, "pending"));
  if (pending.length === 0) {
    console.log("Kolejka pusta.");
    await sql.end();
    return;
  }

  const provider = pickProvider();
  if (!provider) {
    console.error(
      `W kolejce czeka ${pending.length} importów, ale brak klucza AI w środowisku.\n` +
        "Ustaw jeden z:\n" +
        "  OPENAI_API_KEY        (vision + transkrypcja Whisper jednym kluczem; model przez OPENAI_MODEL, domyślnie gpt-4o)\n" +
        "  GEMINI_API_KEY        (darmowy tier, rozumie audio; klucz z aistudio.google.com)\n" +
        "  ANTHROPIC_API_KEY     (Claude)\n" +
        "  AI_COMPAT_BASE_URL + AI_COMPAT_API_KEY + AI_COMPAT_MODEL (Kimi/Moonshot, OpenRouter itp. — model musi mieć vision)"
    );
    await sql.end();
    process.exit(1);
  }

  console.log(`Silnik AI: ${provider.kind}`);
  for (const imp of pending) {
    await processOne(provider, imp);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
