import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import { slugify } from "../../../../lib/slugify";

const { imports, recipes, ingredientGroups, ingredients, steps, tags, recipeTags } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const id = parseInt(req.query.id as string, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });

  const [imp] = await db.select().from(imports).where(eq(imports.id, id));
  if (!imp) return res.status(404).json({ error: "Not found" });

  if (req.method === "DELETE") {
    await db.delete(imports).where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const action = req.body?.action;

  if (action === "reject") {
    await db.update(imports).set({ status: "rejected" }).where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  if (action === "retry") {
    await db.update(imports).set({ status: "pending", operatorNotes: null }).where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  if (action === "accept") {
    if (imp.status !== "ready" || !imp.aiDraft) {
      return res.status(400).json({ error: "Draft nie jest gotowy" });
    }
    const d = imp.aiDraft as any;
    const slug = slugify(d.title || `tiktok-${id}`);
    const heroImage =
      (typeof req.body?.heroImage === "string" && req.body.heroImage) ||
      d.frames?.[0] ||
      null;

    const recipeId = await db.transaction(async (tx) => {
      const [recipe] = await tx
        .insert(recipes)
        .values({
          title: d.title,
          slug,
          uri: `/przepisy/${slug}/`,
          status: "draft",
          source: "tiktok",
          heroImage,
          sponsor: d.sponsor ?? null,
          lead: d.lead ?? null,
          videoUrl: imp.tiktokUrl,
          authorName: "Roksana",
          prepTimeMin: d.prepTimeMin ?? null,
          totalTimeMin: d.totalTimeMin ?? null,
          servings: d.servings ?? null,
          kcal: d.kcal ?? null,
          protein: d.protein?.toString() ?? null,
          fat: d.fat?.toString() ?? null,
          carbs: d.carbs?.toString() ?? null,
          keywords: d.keywords ?? null,
          seoTitle: d.seoTitle ?? null,
          seoDescription: d.seoDescription ?? null,
          publishedAt: new Date(),
        })
        .returning({ id: recipes.id });

      let gPos = 0;
      for (const g of d.ingredientGroups ?? []) {
        const items = (g.items ?? []).filter(Boolean);
        if (!items.length) continue;
        const [group] = await tx
          .insert(ingredientGroups)
          .values({ recipeId: recipe.id, title: g.title ?? null, position: gPos++ })
          .returning({ id: ingredientGroups.id });
        await tx.insert(ingredients).values(
          items.map((rawText: string, i: number) => ({ groupId: group.id, rawText, position: i }))
        );
      }

      const stepRows = (d.steps ?? []).filter((s: any) => s.body);
      if (stepRows.length) {
        await tx.insert(steps).values(
          stepRows.map((s: any, i: number) => ({
            recipeId: recipe.id,
            position: i,
            title: s.title ?? null,
            body: s.body,
            tip: s.tip ?? null,
          }))
        );
      }

      for (const rawTag of d.tags ?? []) {
        const name = (rawTag || "").trim();
        if (!name) continue;
        const [tag] = await tx
          .insert(tags)
          .values({ slug: slugify(name), name })
          .onConflictDoUpdate({ target: tags.slug, set: { name } })
          .returning({ id: tags.id });
        await tx.insert(recipeTags).values({ recipeId: recipe.id, tagId: tag.id });
      }

      await tx
        .update(imports)
        .set({ status: "approved", recipeId: recipe.id })
        .where(eq(imports.id, id));

      return recipe.id;
    });

    return res.json({ ok: true, recipeId });
  }

  return res.status(400).json({ error: "Unknown action" });
}
