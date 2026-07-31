// Data layer over Postgres — the only place pages read content from.
// Mappers return the legacy WPGraphQL-ish shapes so existing components
// (MoreStories, PostHeader, Breadcrumbs…) keep working unchanged.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, dbSchema } from "./db";

const { recipes, ingredientGroups, ingredients, steps, categories, recipeCategories, tags, recipeTags, pages, ratings } = dbSchema;

// Roksana's avatar from the old site — Avatar component requires a URL
export const AUTHOR_AVATAR_URL =
  "https://secure.gravatar.com/avatar/b29dfe79402ff90e5d9443eac21c3613?s=96&d=mm&r=g";

export type RecipeRow = typeof recipes.$inferSelect;

function authorNode(name: string | null) {
  return {
    node: {
      name: name || "Roksana",
      firstName: null,
      lastName: null,
      avatar: { url: AUTHOR_AVATAR_URL },
    },
  };
}

// Listing card in the legacy `edges` shape
export function toListingEdge(r: RecipeRow) {
  return {
    node: {
      title: r.title,
      excerpt: r.excerpt || (r.lead ? `<p>${r.lead}</p>` : ""),
      uri: r.uri,
      slug: r.slug,
      date: r.publishedAt?.toISOString() ?? null,
      featuredImage: r.heroImage ? { node: { sourceUrl: r.heroImage } } : null,
      author: authorNode(r.authorName),
    },
  };
}

export async function listPublishedRecipes() {
  return db
    .select()
    .from(recipes)
    .where(eq(recipes.status, "published"))
    .orderBy(desc(recipes.publishedAt));
}

export async function getAllRecipeUris() {
  return db
    .select({ uri: recipes.uri, updatedAt: recipes.updatedAt })
    .from(recipes)
    .where(eq(recipes.status, "published"));
}

export async function getRecipeByUri(uri: string) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.uri, uri));
  if (!recipe || recipe.status !== "published") return null;
  return loadRecipeRelations(recipe);
}

// Admin variant: any status, by id
export async function getRecipeById(id: number) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!recipe) return null;
  return loadRecipeRelations(recipe);
}

export async function listRecipesAdmin() {
  return db
    .select({
      id: recipes.id,
      title: recipes.title,
      uri: recipes.uri,
      status: recipes.status,
      source: recipes.source,
      publishedAt: recipes.publishedAt,
      legacyRatingValue: recipes.legacyRatingValue,
      legacyRatingCount: recipes.legacyRatingCount,
    })
    .from(recipes)
    .orderBy(desc(recipes.publishedAt));
}

export async function listAllCategories() {
  return db.select().from(categories).orderBy(categories.name);
}

async function loadRecipeRelations(recipe: RecipeRow) {
  const [groups, stepRows, catRows, tagRows, ratingAgg] = await Promise.all([
    db
      .select({
        groupId: ingredientGroups.id,
        groupTitle: ingredientGroups.title,
        groupPosition: ingredientGroups.position,
        rawText: ingredients.rawText,
        position: ingredients.position,
      })
      .from(ingredientGroups)
      .leftJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
      .where(eq(ingredientGroups.recipeId, recipe.id))
      .orderBy(ingredientGroups.position, ingredients.position),
    db
      .select()
      .from(steps)
      .where(eq(steps.recipeId, recipe.id))
      .orderBy(steps.position),
    db
      .select({
        id: categories.id,
        name: categories.name,
        uri: categories.uri,
        slug: categories.slug,
        parentId: categories.parentId,
      })
      .from(recipeCategories)
      .innerJoin(categories, eq(categories.id, recipeCategories.categoryId))
      .where(eq(recipeCategories.recipeId, recipe.id)),
    db
      .select({ name: tags.name, slug: tags.slug })
      .from(recipeTags)
      .innerJoin(tags, eq(tags.id, recipeTags.tagId))
      .where(eq(recipeTags.recipeId, recipe.id)),
    db
      .select({
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${ratings.value}), 0)::int`,
      })
      .from(ratings)
      .where(and(eq(ratings.recipeId, recipe.id), eq(ratings.status, "approved"))),
  ]);

  // Combined aggregate: legacy WP votes + new native votes
  const legacyCount = recipe.legacyRatingCount ?? 0;
  const legacySum = legacyCount * Number(recipe.legacyRatingValue ?? 0);
  const totalCount = legacyCount + (ratingAgg[0]?.count ?? 0);
  const totalSum = legacySum + (ratingAgg[0]?.sum ?? 0);

  return {
    ...recipe,
    ingredientGroups: groupIngredients(groups),
    steps: stepRows,
    categories: catRows,
    tags: tagRows,
    rating:
      totalCount > 0
        ? { value: Math.round((totalSum / totalCount) * 10) / 10, count: totalCount }
        : null,
  };
}

function groupIngredients(
  rows: { groupId: number; groupTitle: string | null; groupPosition: number; rawText: string | null; position: number | null }[]
) {
  const byGroup = new Map<number, { title: string | null; items: string[] }>();
  for (const row of rows) {
    if (!byGroup.has(row.groupId)) {
      byGroup.set(row.groupId, { title: row.groupTitle, items: [] });
    }
    if (row.rawText) byGroup.get(row.groupId)!.items.push(row.rawText);
  }
  return Array.from(byGroup.values());
}

export type FullRecipe = NonNullable<Awaited<ReturnType<typeof getRecipeByUri>>>;

// Legacy `post` shape for PostHeader/Breadcrumbs/ShareBtns/MoreStories
export function toLegacyPost(r: FullRecipe, siteUrl: string) {
  return {
    __typename: "Post",
    title: r.title,
    excerpt: r.excerpt,
    content: r.contentHtml,
    slug: r.slug,
    uri: r.uri,
    date: r.publishedAt?.toISOString() ?? null,
    modified: r.updatedAt?.toISOString() ?? null,
    link: `${siteUrl}${r.uri}`,
    featuredImage: r.heroImage ? { node: { sourceUrl: r.heroImage } } : null,
    author: authorNode(r.authorName),
    categories: {
      edges: r.categories.map((c) => ({
        node: { name: c.name, uri: c.uri, id: c.id, parentId: c.parentId, link: c.uri },
      })),
    },
    tags: { edges: r.tags.map((t) => ({ node: { name: t.name } })) },
  };
}

export async function getPageByUri(uri: string) {
  const [page] = await db.select().from(pages).where(eq(pages.uri, uri));
  return page ?? null;
}

export async function getAllPageUris() {
  return db.select({ uri: pages.uri }).from(pages);
}

export async function getCategoryByUri(uri: string) {
  const [category] = await db.select().from(categories).where(eq(categories.uri, uri));
  return category ?? null;
}

// Category archive includes posts from the category and all its descendants
export async function listRecipesInCategoryTree(categoryId: number) {
  const allCats = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories);
  const ids = [categoryId];
  let frontier = [categoryId];
  while (frontier.length) {
    const children = allCats.filter((c) => frontier.includes(c.parentId!)).map((c) => c.id);
    frontier = children.filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }

  const rows = await db
    .selectDistinct({ recipe: recipes })
    .from(recipes)
    .innerJoin(recipeCategories, eq(recipeCategories.recipeId, recipes.id))
    .where(inArray(recipeCategories.categoryId, ids))
    .orderBy(desc(recipes.publishedAt));

  return rows
    .map((r) => r.recipe)
    .filter((r) => r.status === "published");
}

export async function getCategoriesWithCounts() {
  return db
    .select({
      uri: categories.uri,
      slug: categories.slug,
      name: categories.name,
      count: sql<number>`count(${recipeCategories.recipeId})::int`,
    })
    .from(categories)
    .leftJoin(recipeCategories, eq(recipeCategories.categoryId, categories.id))
    .groupBy(categories.id);
}

export async function listFeedRecipes(limit = 10) {
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.status, "published"))
    .orderBy(desc(recipes.publishedAt))
    .limit(limit);

  return Promise.all(
    rows.map(async (r) => {
      const cats = await db
        .select({ name: categories.name })
        .from(recipeCategories)
        .innerJoin(categories, eq(categories.id, recipeCategories.categoryId))
        .where(eq(recipeCategories.recipeId, r.id));
      return { ...r, categoryNames: cats.map((c) => c.name) };
    })
  );
}
