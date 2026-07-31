import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { getRecipeById } from "../../../../lib/queries";
import { db, dbSchema } from "../../../../lib/db";
import { slugify } from "../../../../lib/slugify";

const {
  recipes,
  ingredientGroups,
  ingredients,
  steps,
  recipeCategories,
  tags,
  recipeTags,
} = dbSchema;

const num = (v: any) => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return Number.isFinite(n) ? n : null;
};
const int = (v: any) => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};
const str = (v: any) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const id = parseInt(req.query.id as string, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });

  if (req.method === "GET") {
    const recipe = await getRecipeById(id);
    if (!recipe) return res.status(404).json({ error: "Not found" });
    return res.json(JSON.parse(JSON.stringify(recipe)));
  }

  if (req.method === "DELETE") {
    const recipe = await getRecipeById(id);
    if (!recipe) return res.status(404).json({ error: "Not found" });
    await db.delete(recipes).where(eq(recipes.id, id));
    await revalidatePaths(res, [recipe.uri, "/", ...recipe.categories.map((c) => c.uri)]);
    return res.json({ ok: true });
  }

  if (req.method === "PUT") {
    const existing = await getRecipeById(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const b = req.body ?? {};

    const title = str(b.title);
    if (!title) return res.status(400).json({ error: "Tytuł jest wymagany" });
    const slug = str(b.slug) ? slugify(b.slug) : existing.slug;
    const uri = str(b.uri) || existing.uri;
    const status = ["draft", "review", "published"].includes(b.status)
      ? b.status
      : existing.status;

    if (
      status === "published" &&
      !(b.ingredientGroups ?? []).some((g: any) => (g.items ?? []).some((i: string) => i?.trim()))
    ) {
      const isArticle = uri.startsWith("/artykuly/");
      if (!isArticle) {
        return res
          .status(400)
          .json({ error: "Opublikowany przepis musi mieć składniki" });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(recipes)
        .set({
          title,
          slug,
          uri,
          status,
          lead: str(b.lead),
          contentHtml: str(b.contentHtml),
          heroImage: str(b.heroImage),
          videoUrl: str(b.videoUrl),
          prepTimeMin: int(b.prepTimeMin),
          cookTimeMin: int(b.cookTimeMin),
          totalTimeMin: int(b.totalTimeMin),
          servings: int(b.servings),
          servingsText: str(b.servingsText),
          difficulty: ["latwy", "sredni", "trudny"].includes(b.difficulty)
            ? b.difficulty
            : null,
          kcal: int(b.kcal),
          protein: num(b.protein)?.toString() ?? null,
          fat: num(b.fat)?.toString() ?? null,
          carbs: num(b.carbs)?.toString() ?? null,
          keywords: str(b.keywords),
          seoTitle: str(b.seoTitle),
          seoDescription: str(b.seoDescription),
          publishedAt: b.publishedAt ? new Date(b.publishedAt) : existing.publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, id));

      // Children: replace wholesale — simplest correct strategy for an editor save
      await tx.delete(ingredientGroups).where(eq(ingredientGroups.recipeId, id));
      await tx.delete(steps).where(eq(steps.recipeId, id));
      await tx.delete(recipeCategories).where(eq(recipeCategories.recipeId, id));
      await tx.delete(recipeTags).where(eq(recipeTags.recipeId, id));

      let gPos = 0;
      for (const g of b.ingredientGroups ?? []) {
        const items = (g.items ?? []).map((i: string) => i?.trim()).filter(Boolean);
        if (items.length === 0) continue;
        const [group] = await tx
          .insert(ingredientGroups)
          .values({ recipeId: id, title: str(g.title), position: gPos++ })
          .returning({ id: ingredientGroups.id });
        await tx.insert(ingredients).values(
          items.map((rawText: string, i: number) => ({
            groupId: group.id,
            rawText,
            position: i,
          }))
        );
      }

      const stepRows = (b.steps ?? [])
        .map((s: any) => ({
          title: str(s.title),
          body: str(s.body),
          tip: str(s.tip),
          image: str(s.image),
        }))
        .filter((s: any) => s.body);
      if (stepRows.length) {
        await tx.insert(steps).values(
          stepRows.map((s: any, i: number) => ({ recipeId: id, position: i, ...s }))
        );
      }

      const categoryIds = (b.categoryIds ?? []).filter((c: any) => Number.isInteger(c));
      if (categoryIds.length) {
        await tx.insert(recipeCategories).values(
          categoryIds.map((categoryId: number) => ({ recipeId: id, categoryId }))
        );
      }

      for (const rawTag of b.tags ?? []) {
        const name = (rawTag || "").trim();
        if (!name) continue;
        const tagSlug = slugify(name);
        const [tag] = await tx
          .insert(tags)
          .values({ slug: tagSlug, name })
          .onConflictDoUpdate({ target: tags.slug, set: { name } })
          .returning({ id: tags.id });
        await tx.insert(recipeTags).values({ recipeId: id, tagId: tag.id });
      }
    });

    const updated = await getRecipeById(id);
    await revalidatePaths(res, [
      existing.uri,
      updated!.uri,
      "/",
      ...existing.categories.map((c) => c.uri),
      ...updated!.categories.map((c) => c.uri),
    ]);
    return res.json(JSON.parse(JSON.stringify(updated)));
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function revalidatePaths(res: NextApiResponse, paths: string[]) {
  for (const path of Array.from(new Set(paths))) {
    try {
      await res.revalidate(path);
    } catch {
      // ISR revalidation is best-effort; the page regenerates on TTL anyway
    }
  }
}
