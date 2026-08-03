import type { NextApiRequest, NextApiResponse } from "next";
import { searchEnabled, searchMeili } from "../../lib/search";

// Live-suggestion endpoint for the homepage hero (proxies Meilisearch so
// no key reaches the browser). Returns a small, cacheable payload.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 9, 24);
  if (!q.trim() || !searchEnabled()) return res.json({ hits: [] });

  try {
    const hits = await searchMeili({ q, limit });
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate");
    return res.json({
      hits: hits.map((h) => ({
        title: h.title,
        uri: h.uri,
        heroImage: h.heroImage,
        lead: h.lead,
        kcal: h.kcal,
        totalTimeMin: h.totalTimeMin,
        ratingValue: h.ratingValue,
      })),
    });
  } catch {
    return res.json({ hits: [] });
  }
}
