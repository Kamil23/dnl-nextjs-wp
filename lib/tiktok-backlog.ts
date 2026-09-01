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
};

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
    })
    .from(tiktokCatalog)
    .where(NOT_IMPORTED)
    .orderBy(sql`${tiktokCatalog.viewCount} desc nulls last`);
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
