// Backlog TikTok: katalog profilu (tiktok_catalog) minus filmy, które już są
// w kolejce importów albo mają przepis na stronie. Zasila /admin/tiktok-backlog.
import { sql } from "drizzle-orm";
import { db, dbSchema } from "./db";

const { tiktokCatalog, imports, recipes } = dbSchema;

export type BacklogRow = {
  id: number;
  videoId: string;
  url: string;
  caption: string | null;
  durationSec: number | null;
  viewCount: number | null;
  kind: "przepis" | "inne" | "niejasne" | null;
  // Uniksowy czas publikacji filmu (sekundy) wyliczony z ID.
  uploadedTs: number | null;
  // Poprzedni snapshot wyświetleń (sprzed ostatniego odświeżenia): baza do
  // pokazania przyrostu. Null, dopóki nie ma co najmniej dwóch snapshotów.
  prevViews: number | null;
  prevSnapshotOn: string | null;
};

// TikTok koduje datę publikacji w ID filmu: górne 32 bity 64-bitowego ID to
// uniksowy timestamp. Dzięki temu nie trzeba kolumny ani ponownego fetcha.
const UPLOADED_TS = sql<number | null>`
  case when ${tiktokCatalog.videoId} ~ '^[0-9]+$'
       then ((${tiktokCatalog.videoId}::bigint >> 32))::double precision
  end`;

// Nie w imports (po video_id lub URL zawierającym id) i nie w recipes.video_url.
const NOT_IMPORTED = sql`
  not exists (
    select 1 from ${imports} i
    where i.video_id = ${tiktokCatalog.videoId}
       or i.tiktok_url like '%/' || ${tiktokCatalog.videoId} || '%'
  )
  and not exists (
    select 1 from ${recipes} r
    where r.video_url like '%' || ${tiktokCatalog.videoId} || '%'
  )`;

export async function listBacklog(): Promise<BacklogRow[]> {
  return db
    .select({
      id: tiktokCatalog.id,
      videoId: tiktokCatalog.videoId,
      url: tiktokCatalog.url,
      caption: tiktokCatalog.caption,
      durationSec: tiktokCatalog.durationSec,
      viewCount: tiktokCatalog.viewCount,
      kind: tiktokCatalog.kind,
      uploadedTs: UPLOADED_TS,
      // Przedostatni snapshot (ostatni = stan bieżący po odświeżeniu).
      // Kolumna korelacji zapisana dosłownie: w liście SELECT drizzle renderuje
      // ${tiktokCatalog.videoId} bez prefiksu tabeli i podzapytanie związałoby
      // ją z własnym aliasem "s" (brak korelacji, losowy wiersz).
      prevViews: sql<number | null>`(
        select s.view_count from tiktok_view_snapshots s
        where s.video_id = "tiktok_catalog"."video_id"
        order by s.captured_on desc offset 1 limit 1)`,
      prevSnapshotOn: sql<string | null>`(
        select s.captured_on::text from tiktok_view_snapshots s
        where s.video_id = "tiktok_catalog"."video_id"
        order by s.captured_on desc offset 1 limit 1)`,
    })
    .from(tiktokCatalog)
    .where(NOT_IMPORTED)
    .orderBy(sql`${UPLOADED_TS} desc nulls last, ${tiktokCatalog.viewCount} desc nulls last`);
}

export async function backlogStats() {
  const [row] = await db
    .select({
      catalogTotal: sql<number>`count(*)::int`,
      backlog: sql<number>`count(*) filter (where ${NOT_IMPORTED})::int`,
      backlogPrzepisy: sql<number>`count(*) filter (where kind = 'przepis' and ${NOT_IMPORTED})::int`,
      lastRefresh: sql<string | null>`max(refreshed_at)`,
    })
    .from(tiktokCatalog);
  return row;
}
