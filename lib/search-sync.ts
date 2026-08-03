// Builds a Meilisearch document for one recipe and keeps the index in sync
// after admin saves / deletes / import accepts. Sync is best-effort: a down
// search engine must never break the admin.
import { eq } from "drizzle-orm";
import * as schema from "./db/schema";
import { searchEnabled, upsertDocs, deleteDoc, type RecipeDoc } from "./search";

const { recipes, ingredientGroups, ingredients, categories, recipeCategories, tags, recipeTags } = schema;

export async function buildRecipeDoc(db: any, recipeId: number): Promise<RecipeDoc | null> {
  const [r] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!r || r.status !== "published") return null;

  const [ing, cats, tagRows, allCats] = await Promise.all([
    db
      .select({ rawText: ingredients.rawText })
      .from(ingredientGroups)
      .innerJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
      .where(eq(ingredientGroups.recipeId, r.id)),
    db
      .select({ id: categories.id, slug: categories.slug, parentId: categories.parentId })
      .from(recipeCategories)
      .innerJoin(categories, eq(categories.id, recipeCategories.categoryId))
      .where(eq(recipeCategories.recipeId, r.id)),
    db
      .select({ name: tags.name })
      .from(recipeTags)
      .innerJoin(tags, eq(tags.id, recipeTags.tagId))
      .where(eq(recipeTags.recipeId, r.id)),
    db.select({ id: categories.id, slug: categories.slug, parentId: categories.parentId }).from(categories),
  ]);

  // category slugs including ancestors, so filtering by "przepisy" matches subtrees
  const byId = new Map(allCats.map((c: any) => [c.id, c]));
  const catSlugs = new Set<string>();
  for (const c of cats) {
    let cur: any = c;
    while (cur) {
      catSlugs.add(cur.slug);
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
  }

  const legacyCount = r.legacyRatingCount ?? 0;
  return {
    id: r.id,
    title: r.title,
    lead: r.lead,
    uri: r.uri,
    heroImage: r.heroImage,
    kcal: r.kcal,
    totalTimeMin: r.totalTimeMin,
    ratingValue: r.legacyRatingValue ? Number(r.legacyRatingValue) : null,
    ratingCount: legacyCount || null,
    tags: tagRows.map((t: any) => t.name),
    keywords: r.keywords,
    ingredients: ing.map((i: any) => i.rawText),
    categories: Array.from(catSlugs),
    publishedAt: r.publishedAt ? new Date(r.publishedAt).getTime() : null,
  };
}

// Called from admin APIs after a write; published -> upsert, else remove
export async function syncRecipeToSearch(db: any, recipeId: number) {
  if (!searchEnabled()) return;
  try {
    const doc = await buildRecipeDoc(db, recipeId);
    if (doc) await upsertDocs([doc]);
    else await deleteDoc(recipeId);
  } catch (e) {
    console.error("Meili sync failed:", (e as Error).message);
  }
}

export async function removeRecipeFromSearch(recipeId: number) {
  if (!searchEnabled()) return;
  try {
    await deleteDoc(recipeId);
  } catch (e) {
    console.error("Meili delete failed:", (e as Error).message);
  }
}
