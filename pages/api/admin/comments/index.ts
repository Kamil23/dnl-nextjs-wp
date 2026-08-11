import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

const { comments, recipes } = dbSchema;

// POST: reply to a reader's comment as the blog author. Replies skip
// moderation (they ARE the moderator's words) and publish immediately.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const parentId = parseInt(req.body?.parentId, 10);
  const body = String(req.body?.body ?? "").trim();
  if (!Number.isInteger(parentId) || body.length < 1 || body.length > 2000) {
    return res.status(400).json({ error: "Bad request" });
  }

  const [parent] = await db.select().from(comments).where(eq(comments.id, parentId));
  if (!parent) return res.status(404).json({ error: "Not found" });
  if (parent.parentId) return res.status(400).json({ error: "Odpowiadać można tylko na komentarz czytelnika" });

  const [reply] = await db
    .insert(comments)
    .values({
      recipeId: parent.recipeId,
      parentId,
      authorName: "Roksana",
      body,
      isAuthor: true,
      fingerprint: "admin",
      status: "approved",
    })
    .returning();

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, parent.recipeId));
  if (recipe) {
    try {
      await res.revalidate(recipe.uri);
    } catch {}
  }

  return res.json({ ok: true, reply });
}
