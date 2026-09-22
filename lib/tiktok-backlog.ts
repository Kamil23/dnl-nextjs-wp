// Backlog TikTok: pełny katalog profilu (tiktok_catalog) z oznaczeniem, które
// filmy mają już przepis na stronie / czekają w kolejce importu. Zasila
// /admin/tiktok-backlog i podstronę szczegółów /admin/tiktok-backlog/[videoId].
import { eq, sql } from "drizzle-orm";
import { db, dbSchema } from "./db";

const { tiktokCatalog, tiktokViewSnapshots, imports, recipes } = dbSchema;

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
  // Film ma już przepis na stronie / czeka w kolejce importu - taki wiersz
  // jest w tabeli widoczny, ale bez przycisku "Do kolejki".
  hasRecipe: boolean;
  inQueue: boolean;
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
        // Korelacja zapisana dosłownie - patrz komentarz przy prevSnapshots.
        hasRecipe: sql<boolean>`exists (
          select 1 from recipes r
          where r.video_url like '%' || "tiktok_catalog"."video_id" || '%')`,
        inQueue: sql<boolean>`exists (
          select 1 from imports i
          where i.video_id = "tiktok_catalog"."video_id"
             or i.tiktok_url like '%/' || "tiktok_catalog"."video_id" || '%')`,
      })
      .from(tiktokCatalog)
      .orderBy(sql`${UPLOADED_TS} desc nulls last, ${tiktokCatalog.viewCount} desc nulls last`),
    prevSnapshots(),
  ]);
  return rows.map((r) => ({ ...r, prev: prev.get(r.videoId) ?? null }));
}

export type VideoDetail = {
  video: SnapshotStats & {
    id: number;
    videoId: string;
    url: string;
    caption: string | null;
    durationSec: number | null;
    kind: "przepis" | "inne" | "niejasne" | null;
    uploadedTs: number | null;
    classifiedAt: string | null;
    refreshedAt: string | null;
  };
  // Pełna historia snapshotów, rosnąco po dacie - do wykresu i tabeli przyrostów.
  history: (SnapshotStats & { capturedOn: string })[];
  // Mediana wyświetleń całego katalogu - punkt odniesienia "ile to jest dużo".
  medianViews: number | null;
  // transcript: z pipeline'u importu (Whisper) - jest tylko dla importowanych.
  importRow: { id: number; status: string; transcript: string | null } | null;
  recipe: { id: number; slug: string | null; title: string | null } | null;
};

export async function getVideoDetail(videoId: string): Promise<VideoDetail | null> {
  const [video] = await db
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
      classifiedAt: sql<string | null>`classified_at::text`,
      refreshedAt: sql<string | null>`refreshed_at::text`,
    })
    .from(tiktokCatalog)
    .where(eq(tiktokCatalog.videoId, videoId));
  if (!video) return null;

  const [history, medianRows, importRows, recipeRows] = await Promise.all([
    db
      .select({
        viewCount: tiktokViewSnapshots.viewCount,
        likeCount: tiktokViewSnapshots.likeCount,
        commentCount: tiktokViewSnapshots.commentCount,
        saveCount: tiktokViewSnapshots.saveCount,
        repostCount: tiktokViewSnapshots.repostCount,
        capturedOn: sql<string>`captured_on::text`,
      })
      .from(tiktokViewSnapshots)
      .where(eq(tiktokViewSnapshots.videoId, videoId))
      .orderBy(tiktokViewSnapshots.capturedOn),
    db
      .select({
        median: sql<number | null>`
          percentile_cont(0.5) within group (order by view_count)::double precision`,
      })
      .from(tiktokCatalog)
      .where(sql`view_count is not null`),
    db
      .select({ id: imports.id, status: imports.status, transcript: imports.transcript })
      .from(imports)
      .where(
        sql`${imports.videoId} = ${videoId} or ${imports.tiktokUrl} like ${"%/" + videoId + "%"}`
      )
      .limit(1),
    db
      .select({ id: recipes.id, slug: recipes.slug, title: recipes.title })
      .from(recipes)
      .where(sql`${recipes.videoUrl} like ${"%" + videoId + "%"}`)
      .limit(1),
  ]);

  return {
    video,
    history,
    medianViews: medianRows[0]?.median ?? null,
    importRow: importRows[0] ?? null,
    recipe: recipeRows[0] ?? null,
  };
}

export type CatalogStatsRow = SnapshotStats & {
  videoId: string;
  caption: string | null;
  kind: "przepis" | "inne" | "niejasne" | null;
  durationSec: number | null;
  uploadedTs: number | null;
};

// Cały katalog (też filmy z przepisami) do zbiorczych statystyk profilu:
// najlepsze dni/godziny publikacji, hashtagi. /admin/tiktok-statystyki.
export async function listCatalogForStats(): Promise<CatalogStatsRow[]> {
  return db
    .select({
      videoId: tiktokCatalog.videoId,
      caption: tiktokCatalog.caption,
      kind: tiktokCatalog.kind,
      durationSec: tiktokCatalog.durationSec,
      viewCount: tiktokCatalog.viewCount,
      likeCount: tiktokCatalog.likeCount,
      commentCount: tiktokCatalog.commentCount,
      saveCount: tiktokCatalog.saveCount,
      repostCount: tiktokCatalog.repostCount,
      uploadedTs: UPLOADED_TS,
    })
    .from(tiktokCatalog)
    .where(sql`view_count is not null`);
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
