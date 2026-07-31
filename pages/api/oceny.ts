import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { and, eq, sql as dsql } from "drizzle-orm";
import { db, dbSchema } from "../../lib/db";

const { ratings, recipes } = dbSchema;

// Anonymous dedup: one vote per (ip, user-agent) pair per recipe.
// Re-voting updates the previous value instead of adding a new one.
function fingerprint(req: NextApiRequest, recipeId: number) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "";
  const ua = req.headers["user-agent"] || "";
  const salt = process.env.ADMIN_SECRET || "dnl";
  return createHash("sha256").update(`${ip}|${ua}|${recipeId}|${salt}`).digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const recipeId = parseInt(req.body?.recipeId, 10);
  const value = parseInt(req.body?.value, 10);
  if (!Number.isInteger(recipeId) || !Number.isInteger(value) || value < 1 || value > 5) {
    return res.status(400).json({ error: "Bad request" });
  }

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!recipe || recipe.status !== "published") {
    return res.status(404).json({ error: "Not found" });
  }

  // New and re-submitted votes go back to moderation before counting publicly
  await db
    .insert(ratings)
    .values({ recipeId, value, fingerprint: fingerprint(req, recipeId) })
    .onConflictDoUpdate({
      target: [ratings.recipeId, ratings.fingerprint],
      set: { value, status: "pending" },
    });

  const [agg] = await db
    .select({
      count: dsql<number>`count(*)::int`,
      sum: dsql<number>`coalesce(sum(${ratings.value}), 0)::int`,
    })
    .from(ratings)
    .where(and(eq(ratings.recipeId, recipeId), eq(ratings.status, "approved")));

  const legacyCount = recipe.legacyRatingCount ?? 0;
  const legacySum = legacyCount * Number(recipe.legacyRatingValue ?? 0);
  const totalCount = legacyCount + agg.count;
  const totalSum = legacySum + agg.sum;

  return res.json({
    value: totalCount ? Math.round((totalSum / totalCount) * 10) / 10 : 0,
    count: totalCount,
    pending: true,
  });
}
