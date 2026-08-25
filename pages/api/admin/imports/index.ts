import type { NextApiRequest, NextApiResponse } from "next";
import { desc, eq, like, or } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

const { imports, recipes } = dbSchema;

// Statuses that mean "this video is already in the system" - a rejected,
// failed or duplicate row does not block re-adding the link on purpose
const ACTIVE_STATUSES = new Set(["pending", "processing", "ready", "approved"]);

function videoIdFromUrl(url: string): string | null {
  const m = url.match(/\/(?:video|photo)\/(\d+)/);
  return m ? m[1] : null;
}

// Short vm./vt. links redirect to the canonical /@user/video/<id> URL.
// Best-effort: on any failure the worker still catches the duplicate after
// yt-dlp downloads the clip (the info.json carries the real id).
async function resolveVideoId(url: string): Promise<string | null> {
  const direct = videoIdFromUrl(url);
  if (direct) return direct;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    return videoIdFromUrl(res.url);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    const rows = await db.select().from(imports).orderBy(desc(imports.createdAt)).limit(200);
    return res.json(JSON.parse(JSON.stringify(rows)));
  }

  if (req.method === "POST") {
    const url = (req.body?.url || "").trim();
    if (!/^https:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/.+/.test(url)) {
      return res.status(400).json({ error: "Podaj poprawny link do TikToka" });
    }

    const videoId = await resolveVideoId(url);
    const sameVideo = videoId
      ? or(eq(imports.videoId, videoId), like(imports.tiktokUrl, `%/video/${videoId}%`))
      : eq(imports.tiktokUrl, url);
    const candidates = await db.select().from(imports).where(sameVideo);
    const dup = candidates.find((r) => ACTIVE_STATUSES.has(r.status));
    if (dup) {
      const title = (dup.aiDraft as any)?.title ?? null;
      return res.status(409).json({
        error: `Ten TikTok był już zaimportowany${title ? ` („${title}")` : ""}`,
        duplicate: { importId: dup.id, status: dup.status, recipeId: dup.recipeId },
      });
    }
    // Legacy recipes (WP import / manual) carry the TikTok link in videoUrl
    if (videoId) {
      const [rec] = await db
        .select({ id: recipes.id, title: recipes.title })
        .from(recipes)
        .where(like(recipes.videoUrl, `%${videoId}%`));
      if (rec) {
        return res.status(409).json({
          error: `Ten film jest już w przepisie „${rec.title}"`,
          duplicate: { importId: null, status: "recipe", recipeId: rec.id },
        });
      }
    }

    const [row] = await db
      .insert(imports)
      .values({ tiktokUrl: url, videoId, status: "pending" })
      .returning({ id: imports.id });
    return res.status(201).json({ id: row.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
