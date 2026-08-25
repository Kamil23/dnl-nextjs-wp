import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { and, desc, eq, sql as dsql } from "drizzle-orm";
import { db, dbSchema } from "../../lib/db";

const { comments, recipes } = dbSchema;

// Same anonymous fingerprint as ratings - not for dedup here (many comments
// per reader are fine), but for the flood guard and abuse tracking.
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

  // Honeypot: the form ships a hidden "website" field humans never fill
  if (typeof req.body?.website === "string" && req.body.website.trim() !== "") {
    return res.json({ ok: true, pending: true });
  }

  const recipeId = parseInt(req.body?.recipeId, 10);
  const name = String(req.body?.name ?? "").trim();
  const body = String(req.body?.body ?? "").trim();
  if (!Number.isInteger(recipeId) || !name || name.length > 80 || body.length < 2 || body.length > 2000) {
    return res.status(400).json({ error: "Podpis i treść komentarza są wymagane" });
  }

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!recipe || recipe.status !== "published") {
    return res.status(404).json({ error: "Not found" });
  }

  const fp = fingerprint(req, recipeId);

  // Double-submit guard: an identical repeat from the same reader is a no-op
  const [last] = await db
    .select({ body: comments.body })
    .from(comments)
    .where(and(eq(comments.recipeId, recipeId), eq(comments.fingerprint, fp)))
    .orderBy(desc(comments.createdAt))
    .limit(1);
  if (last?.body === body) {
    return res.json({ ok: true, pending: true });
  }

  // Flood guard: moderation catches spam content, this caps its volume
  const [{ waiting }] = await db
    .select({ waiting: dsql<number>`count(*)::int` })
    .from(comments)
    .where(
      and(
        eq(comments.recipeId, recipeId),
        eq(comments.fingerprint, fp),
        eq(comments.status, "pending")
      )
    );
  if (waiting >= 5) {
    return res.status(429).json({ error: "Masz już kilka komentarzy czekających na akceptację" });
  }

  await db.insert(comments).values({ recipeId, authorName: name, body, fingerprint: fp });

  return res.json({ ok: true, pending: true });
}
