import type { NextApiRequest, NextApiResponse } from "next";
import { eq, sql } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

const { comments, recipes } = dbSchema;

async function revalidateRecipe(res: NextApiResponse, recipeId: number) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (recipe) {
    try {
      await res.revalidate(recipe.uri);
    } catch {}
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  const id = parseInt(req.query.id as string, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });

  const [comment] = await db.select().from(comments).where(eq(comments.id, id));
  if (!comment) return res.status(404).json({ error: "Not found" });

  if (req.method === "DELETE") {
    // Replies hang off their parent (arbitrarily deep) - remove the whole subtree
    await db.execute(sql`
      WITH RECURSIVE tree AS (
        SELECT id FROM comments WHERE id = ${id}
        UNION ALL
        SELECT c.id FROM comments c JOIN tree t ON c.parent_id = t.id
      )
      DELETE FROM comments WHERE id IN (SELECT id FROM tree)
    `);
    await revalidateRecipe(res, comment.recipeId);
    return res.json({ ok: true });
  }

  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const status = req.body?.status;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Bad request" });
  }

  await db.update(comments).set({ status }).where(eq(comments.id, id));
  await revalidateRecipe(res, comment.recipeId);

  return res.json({ ok: true });
}
