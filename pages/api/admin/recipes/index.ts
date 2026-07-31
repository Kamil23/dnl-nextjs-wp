import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { listRecipesAdmin } from "../../../../lib/queries";
import { db, dbSchema } from "../../../../lib/db";
import { slugify } from "../../../../lib/slugify";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    const rows = await listRecipesAdmin();
    return res.json(JSON.parse(JSON.stringify(rows)));
  }

  if (req.method === "POST") {
    const title = (req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "Podaj tytuł" });
    const slug = slugify(title);
    if (!slug) return res.status(400).json({ error: "Tytuł nie da się zeslugować" });

    const [row] = await db
      .insert(dbSchema.recipes)
      .values({
        title,
        slug,
        uri: `/przepisy/${slug}/`,
        status: "draft",
        source: "manual",
        authorName: "Roksana",
        publishedAt: new Date(),
      })
      .returning({ id: dbSchema.recipes.id });
    return res.status(201).json({ id: row.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
