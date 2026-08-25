import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

const { ratings, recipes } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const id = parseInt(req.query.id as string, 10);
  const status = req.body?.status;
  if (!Number.isInteger(id) || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Bad request" });
  }

  const [rating] = await db.select().from(ratings).where(eq(ratings.id, id));
  if (!rating) return res.status(404).json({ error: "Not found" });

  await db.update(ratings).set({ status }).where(eq(ratings.id, id));

  // Approved/rejected votes change the public aggregate - refresh the page
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, rating.recipeId));
  if (recipe) {
    try {
      await res.revalidate(recipe.uri);
    } catch {}
  }

  return res.json({ ok: true });
}
