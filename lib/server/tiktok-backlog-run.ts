// Rdzeń odświeżania katalogu TikTok: yt-dlp listuje profil (bez pobierania
// wideo), nowe opisy klasyfikuje najtańszy model (przepis / inne / niejasne).
// Wołane z CLI (scripts/tiktok-backlog.ts) i z workera (zlecenie z admina albo
// interwał). Przyjmuje instancję drizzle od wołającego, jak lib/search-sync.
import { execFile } from "child_process";
import { promisify } from "util";
import { eq, isNull, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { SOCIAL_TIKTOK_URL } from "../constants";

const run = promisify(execFile);
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

export type BacklogRunResult = {
  profileTotal: number;
  fresh: number;
  classified: { przepisy: number; inne: number; niejasne: number };
  catalog: { total: number; przepisy: number; inne: number; niejasne: number };
};

async function fetchProfile(log: (s: string) => void): Promise<FlatEntry[]> {
  log(`Pobieram listę filmów z ${SOCIAL_TIKTOK_URL} (yt-dlp, bez wideo)...`);
  const { stdout } = await run(
    "yt-dlp",
    ["--flat-playlist", "-J", "--no-warnings", SOCIAL_TIKTOK_URL],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const json = JSON.parse(stdout);
  const entries: FlatEntry[] = json.entries ?? [];
  return entries.filter((e) => e.id);
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

export async function runTiktokBacklog(
  db: any,
  log: (s: string) => void = () => {},
  opts: { skipFetch?: boolean } = {}
): Promise<BacklogRunResult> {
  let profileTotal = 0;
  let fresh = 0;

  if (!opts.skipFetch) {
    const entries = await fetchProfile(log);
    profileTotal = entries.length;
    log(`Profil ma ${entries.length} filmów.`);
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
          set: { caption, viewCount: e.view_count ?? null, refreshedAt: new Date() },
        })
        .returning({ classifiedAt: tiktokCatalog.classifiedAt });
      if (res[0] && res[0].classifiedAt == null) fresh++;
    }
    log(`Katalog zaktualizowany (${fresh} nowych/nieklasyfikowanych).`);
  }

  const classified = { przepisy: 0, inne: 0, niejasne: 0 };
  if (!process.env.OPENAI_API_KEY) {
    log("Brak OPENAI_API_KEY: pomijam klasyfikację (nowe filmy zostają jako niejasne).");
  } else {
    const pending = await db
      .select({ id: tiktokCatalog.id, caption: tiktokCatalog.caption })
      .from(tiktokCatalog)
      .where(isNull(tiktokCatalog.classifiedAt));

    for (const p of pending.filter((x: any) => !x.caption)) {
      await db
        .update(tiktokCatalog)
        .set({ kind: "niejasne", classifiedAt: new Date() })
        .where(eq(tiktokCatalog.id, p.id));
      classified.niejasne++;
    }

    const withCaption = pending.filter((x: any) => x.caption) as { id: number; caption: string }[];
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
          if (kind === "przepis") classified.przepisy++;
          else if (kind === "inne") classified.inne++;
          else classified.niejasne++;
        }
        log(`Klasyfikacja: ${Math.min(i + BATCH, withCaption.length)}/${withCaption.length}`);
      } catch (e) {
        log(`Paczka klasyfikacji nieudana: ${(e as Error).message}`);
      }
    }
  }

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      przepisy: sql<number>`count(*) filter (where kind = 'przepis')::int`,
      inne: sql<number>`count(*) filter (where kind = 'inne')::int`,
      niejasne: sql<number>`count(*) filter (where kind = 'niejasne')::int`,
    })
    .from(tiktokCatalog);

  log(
    `Katalog łącznie: ${stats.total} filmów (${stats.przepisy} przepisów, ${stats.inne} innych, ${stats.niejasne} niejasnych).`
  );
  return { profileTotal, fresh, classified, catalog: stats };
}
