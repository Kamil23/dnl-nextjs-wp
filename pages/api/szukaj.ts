import type { NextApiRequest, NextApiResponse } from "next";
import {
  searchEnabled,
  searchMeili,
  searchMeiliFull,
  type RecipeDoc,
} from "../../lib/search";
import { logSearch } from "../../lib/server/search-log";

// Search proxy for the browser (keeps the Meili key server-side).
//   • hero:          /api/szukaj?q=…&limit=12          → { hits }
//   • results page:  /api/szukaj?facets=1&q=…&kcal=…   → { hits, counts, total }
// The `facets=1` branch powers the instant, faceted /szukaj experience.

function hitFields(h: RecipeDoc) {
  return {
    title: h.title,
    uri: h.uri,
    heroImage: h.heroImage,
    lead: h.lead,
    kcal: h.kcal,
    protein: h.protein,
    totalTimeMin: h.totalTimeMin,
    ratingValue: h.ratingValue,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!searchEnabled()) return res.json({ hits: [] });

  const num = (v: unknown) => (typeof v === "string" && parseInt(v, 10)) || undefined;
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

  // Faceted results-page request
  if (req.query.facets === "1") {
    try {
      const result = await searchMeiliFull(
        q,
        {
          categorySlug: str(req.query.kategoria),
          maxKcal: num(req.query.kcal),
          maxTime: num(req.query.czas),
          minProtein: req.query.bialko === "1" ? 25 : undefined,
          diet: str(req.query.dieta),
        },
        str(req.query.sort)
      );
      await logSearch(q, result.total, "szukaj", req);
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate");
      return res.json({
        hits: result.hits.map(hitFields),
        counts: result.counts,
        total: result.total,
      });
    } catch {
      return res.status(200).json({ hits: [], counts: null, total: 0 });
    }
  }

  // Hero live-suggestion request (unchanged shape)
  if (!q.trim()) return res.json({ hits: [] });
  const limit = Math.min(num(req.query.limit) || 9, 24);
  try {
    const hits = await searchMeili({ q, limit });
    await logSearch(q, hits.length, "hero", req);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate");
    return res.json({ hits: hits.map(hitFields) });
  } catch {
    return res.json({ hits: [] });
  }
}
