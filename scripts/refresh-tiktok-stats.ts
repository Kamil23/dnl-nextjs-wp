// Refreshes TikTok view counts for every recipe with a video_url, using
// yt-dlp metadata (no video download). Run manually or from cron, e.g.
// weekly; TikTok sometimes blocks datacenter IPs, so failures skip the
// recipe and keep the previous number.
//   npx tsx scripts/refresh-tiktok-stats.ts
import "dotenv/config";
import { execFile } from "child_process";
import { promisify } from "util";
import { eq, isNotNull } from "drizzle-orm";
import { db, dbSchema } from "../lib/db";

const run = promisify(execFile);
const { recipes } = dbSchema;

async function fetchViews(url: string): Promise<number | null> {
  const { stdout } = await run(
    "yt-dlp",
    ["--no-download", "--no-playlist", "--print", "%(view_count)s", url],
    { timeout: 60_000 }
  );
  const n = parseInt(stdout.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const rows = await db
    .select({ id: recipes.id, title: recipes.title, videoUrl: recipes.videoUrl })
    .from(recipes)
    .where(isNotNull(recipes.videoUrl));
  console.log(`Przepisów z wideo: ${rows.length}`);

  let updated = 0;
  for (const r of rows) {
    try {
      const views = await fetchViews(r.videoUrl!);
      if (views == null) {
        console.log(`- [${r.id}] ${r.title}: brak liczby wyświetleń`);
        continue;
      }
      await db.update(recipes).set({ videoViews: views }).where(eq(recipes.id, r.id));
      updated++;
      console.log(`✓ [${r.id}] ${r.title}: ${views.toLocaleString("pl-PL")}`);
    } catch (e: any) {
      console.log(`✗ [${r.id}] ${r.title}: ${String(e.message).slice(0, 120)}`);
    }
    // Be polite; TikTok rate-limits aggressive clients
    await new Promise((res) => setTimeout(res, 2000));
  }
  console.log(`Zaktualizowano: ${updated}/${rows.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
