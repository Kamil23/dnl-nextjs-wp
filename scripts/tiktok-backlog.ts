/**
 * Katalog filmów z profilu TikTok autorki + tania klasyfikacja "przepis czy nie".
 *
 * 1. yt-dlp listuje CAŁY profil (flat playlist, bez pobierania wideo).
 * 2. Upsert do tabeli tiktok_catalog (video_id, url, caption, views, duration).
 * 3. Nieklasyfikowane opisy lecą paczkami po 40 do najtańszego modelu
 *    (OPENAI_CHEAP_MODEL, domyślnie gpt-4o-mini): przepis / inne / niejasne.
 *    Klasyfikujemy po SAMYM opisie, zero pobierania wideo, koszt groszowy.
 *
 * Uruchomienie: npm run tiktok:backlog          (pełny przebieg)
 *               npm run tiktok:backlog -- --skip-fetch   (tylko klasyfikacja)
 * Wymaga: yt-dlp na PATH, OPENAI_API_KEY w .env.
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { execFile } from "child_process";
import { promisify } from "util";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNull, sql } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { SOCIAL_TIKTOK_URL } from "../lib/constants";

const run = promisify(execFile);
const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema });
const { tiktokCatalog } = schema;

const CHEAP_MODEL = process.env.OPENAI_CHEAP_MODEL || "gpt-4o-mini";
const BATCH = 40;

type FlatEntry = {
  id?: string;
  url?: string;
  title?: string;
  description?: string;
  duration?: number;
  view_count?: number;
};

async function fetchProfile(): Promise<FlatEntry[]> {
  console.log(`Pobieram listę filmów z ${SOCIAL_TIKTOK_URL} (yt-dlp, bez wideo)...`);
  const { stdout } = await run(
    "yt-dlp",
    ["--flat-playlist", "-J", "--no-warnings", SOCIAL_TIKTOK_URL],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const json = JSON.parse(stdout);
  const entries: FlatEntry[] = json.entries ?? [];
  return entries.filter((e) => e.id);
}

async function upsertCatalog(entries: FlatEntry[]) {
  let added = 0;
  for (const e of entries) {
    const url = e.url || `${SOCIAL_TIKTOK_URL.replace(/\/$/, "")}/video/${e.id}`;
    const caption = (e.title || e.description || "").trim() || null;
    const res = await db
      .insert(tiktokCatalog)
      .values({
        videoId: String(e.id),
        url,
        caption,
        durationSec: e.duration != null ? Math.round(e.duration) : null,
        viewCount: e.view_count ?? null,
      })
      .onConflictDoUpdate({
        target: tiktokCatalog.videoId,
        set: {
          caption,
          viewCount: e.view_count ?? null,
          refreshedAt: new Date(),
        },
      })
      .returning({ classifiedAt: tiktokCatalog.classifiedAt });
    if (res[0] && res[0].classifiedAt == null) added++;
  }
  return added;
}

async function classifyBatch(items: { id: number; caption: string }[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: CHEAP_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Klasyfikujesz opisy filmów z TikToka autorki bloga kulinarnego. " +
            'Zwracasz WYŁĄCZNIE JSON: {"wyniki":[{"id":liczba,"przepis":true|false}]}. ' +
            "przepis=true, gdy film pokazuje jedzenie do przygotowania (przepis, gotowanie, wypiek). " +
            "przepis=false dla vlogów, zakupów, porad niekulinarnych, lifestyle.",
        },
        {
          role: "user",
          content: JSON.stringify(items.map((i) => ({ id: i.id, opis: i.caption.slice(0, 300) }))),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  const map = new Map<number, boolean>();
  for (const w of parsed.wyniki ?? []) {
    if (typeof w.id === "number" && typeof w.przepis === "boolean") map.set(w.id, w.przepis);
  }
  return map;
}

async function classifyAll() {
  const pending = await db
    .select({ id: tiktokCatalog.id, caption: tiktokCatalog.caption })
    .from(tiktokCatalog)
    .where(isNull(tiktokCatalog.classifiedAt));

  let przepisy = 0;
  let inne = 0;
  let niejasne = 0;

  // Pusty opis: nie ma czego klasyfikować, oznaczamy "niejasne" bez API
  const empty = pending.filter((p) => !p.caption);
  for (const p of empty) {
    await db
      .update(tiktokCatalog)
      .set({ kind: "niejasne", classifiedAt: new Date() })
      .where(eq(tiktokCatalog.id, p.id));
    niejasne++;
  }

  const withCaption = pending.filter((p) => p.caption) as { id: number; caption: string }[];
  for (let i = 0; i < withCaption.length; i += BATCH) {
    const batch = withCaption.slice(i, i + BATCH);
    try {
      const verdicts = await classifyBatch(batch);
      for (const item of batch) {
        const v = verdicts.get(item.id);
        const kind = v === true ? "przepis" : v === false ? "inne" : "niejasne";
        await db
          .update(tiktokCatalog)
          .set({ kind, classifiedAt: new Date() })
          .where(eq(tiktokCatalog.id, item.id));
        if (kind === "przepis") przepisy++;
        else if (kind === "inne") inne++;
        else niejasne++;
      }
      console.log(`  klasyfikacja: ${Math.min(i + BATCH, withCaption.length)}/${withCaption.length}`);
    } catch (e) {
      console.error(`  paczka ${i / BATCH + 1} nieudana:`, (e as Error).message);
    }
  }
  return { przepisy, inne, niejasne, pending: pending.length };
}

async function main() {
  const skipFetch = process.argv.includes("--skip-fetch");

  if (!skipFetch) {
    const entries = await fetchProfile();
    console.log(`Profil ma ${entries.length} filmów.`);
    const fresh = await upsertCatalog(entries);
    console.log(`Katalog zaktualizowany (${fresh} nowych/nieklasyfikowanych).`);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log("Brak OPENAI_API_KEY: pomijam klasyfikację (filmy zostaną jako niejasne).");
  } else {
    const c = await classifyAll();
    if (c.pending === 0) console.log("Wszystko już sklasyfikowane.");
    else
      console.log(
        `Sklasyfikowano ${c.pending}: ${c.przepisy} przepisów, ${c.inne} innych, ${c.niejasne} niejasnych (model: ${CHEAP_MODEL}).`
      );
  }

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      przepisy: sql<number>`count(*) filter (where kind = 'przepis')::int`,
      inne: sql<number>`count(*) filter (where kind = 'inne')::int`,
      niejasne: sql<number>`count(*) filter (where kind = 'niejasne')::int`,
    })
    .from(tiktokCatalog);
  console.log(
    `\nKatalog łącznie: ${stats.total} filmów (${stats.przepisy} przepisów, ${stats.inne} innych, ${stats.niejasne} niejasnych).`
  );
  console.log("Backlog do importu zobaczysz w /admin/tiktok-backlog.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
