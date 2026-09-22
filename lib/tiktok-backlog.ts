// Backlog TikTok: katalog profilu (tiktok_catalog) minus filmy, które już są
// w kolejce importów albo mają przepis na stronie. Zasila /admin/tiktok-backlog.
import { sql } from "drizzle-orm";
import { db, dbSchema } from "./db";

const { tiktokCatalog, imports, recipes } = dbSchema;

export type SnapshotStats = {
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  saveCount: number | null;
  repostCount: number | null;
};

export type BacklogRow = SnapshotStats & {
  id: number;
  videoId: string;
  url: string;
  caption: string | null;
  durationSec: number | null;
  kind: "przepis" | "inne" | "niejasne" | null;
  // Uniksowy czas publikacji filmu (sekundy) wyliczony z ID.
  uploadedTs: number | null;
  // Przedostatni snapshot statystyk (ostatni = stan bieżący po odświeżeniu):
  // baza do pokazania przyrostów. Null, dopóki nie ma dwóch snapshotów.
  prev: (SnapshotStats & { capturedOn: string }) | null;
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

// Przedostatni snapshot każdego filmu (ostatni = stan bieżący po odświeżeniu),
// jednym zapytaniem okienkowym zamiast skorelowanych podzapytań per metryka.
async function prevSnapshots(): Promise<Map<string, SnapshotStats & { capturedOn: string }>> {
  const res: any = await db.execute(sql`
    select video_id, view_count, like_count, comment_count, save_count, repost_count,
           captured_on::text as captured_on
    from (select s.*, row_number() over (partition by video_id order by captured_on desc) as rn
          from tiktok_view_snapshots s) t
    where rn = 2`);
  const rows: any[] = Array.isArray(res) ? res : res.rows;
  return new Map(
    rows.map((r) => [
      String(r.video_id),
      {
        viewCount: r.view_count,
        likeCount: r.like_count,
        commentCount: r.comment_count,
        saveCount: r.save_count,
        repostCount: r.repost_count,
        capturedOn: r.captured_on,
      },
    ])
  );
}

export async function listBacklog(): Promise<BacklogRow[]> {
  const [rows, prev] = await Promise.all([
    db
      .select({
        id: tiktokCatalog.id,
        videoId: tiktokCatalog.videoId,
        url: tiktokCatalog.url,
        caption: tiktokCatalog.caption,
        durationSec: tiktokCatalog.durationSec,
        viewCount: tiktokCatalog.viewCount,
        likeCount: tiktokCatalog.likeCount,
        commentCount: tiktokCatalog.commentCount,
        saveCount: tiktokCatalog.saveCount,
        repostCount: tiktokCatalog.repostCount,
        kind: tiktokCatalog.kind,
        uploadedTs: UPLOADED_TS,
      })
      .from(tiktokCatalog)
      .where(NOT_IMPORTED)
      .orderBy(sql`${UPLOADED_TS} desc nulls last, ${tiktokCatalog.viewCount} desc nulls last`),
    prevSnapshots(),
  ]);
  return rows.map((r) => ({ ...r, prev: prev.get(r.videoId) ?? null }));
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
