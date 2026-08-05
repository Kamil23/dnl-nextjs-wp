// Data layer over Postgres — the only place pages read content from.
// Mappers return the legacy WPGraphQL-ish shapes so existing components
// (MoreStories, PostHeader, Breadcrumbs…) keep working unchanged.
import { and, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { db, dbSchema } from "./db";

const { recipes, ingredientGroups, ingredients, steps, categories, recipeCategories, tags, recipeTags, pages, ratings, imports } = dbSchema;

import { AUTHOR_AVATAR_URL } from "./constants";

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

  // Rating detox: once a recipe has collected enough REAL approved votes, the
  // aggregate (and the JSON-LD downstream) uses only them and the imported
  // legacy numbers silently retire. Below the threshold: legacy + real combined.
  const REAL_VOTES_THRESHOLD = 15;
  const realCount = ratingAgg[0]?.count ?? 0;
  const realSum = ratingAgg[0]?.sum ?? 0;
  const useRealOnly = realCount >= REAL_VOTES_THRESHOLD;
  const legacyCount = useRealOnly ? 0 : (recipe.legacyRatingCount ?? 0);
  const legacySum = legacyCount * Number(recipe.legacyRatingValue ?? 0);
  const totalCount = legacyCount + realCount;
  const totalSum = legacySum + realSum;

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
    tags: { edges: r.tags.map((t) => ({ node: { name: t.name, slug: t.slug } })) },
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

// The /przepisy/ archive — same recipe set the old site's canonical
// (/kategoria/przepisy/) points at; falls back to uri prefix if the
// category is missing.
export async function listRecipeArchive() {
  const category = await getCategoryByUri("/kategoria/przepisy/");
  if (category) return listRecipesInCategoryTree(category.id);
  return (await listPublishedRecipes()).filter((r) => r.uri.startsWith("/przepisy/"));
}

export async function listTopRatedRecipes(limit = 4) {
  return db
    .select()
    .from(recipes)
    .where(and(eq(recipes.status, "published"), sql`${recipes.legacyRatingCount} > 0`))
    .orderBy(
      desc(recipes.legacyRatingValue),
      desc(recipes.legacyRatingCount)
    )
    .limit(limit);
}

// "Kalendarz smaków": recipes for a seasonal theme. Recipes carrying the
// theme's own sezon-* tag (curated in the admin) always come first; the
// category/keyword heuristics only fill the remaining slots. Best-rated
// first within each group. The caller falls back to another section when
// fewer than `limit` match.
export async function listThemedRecipes(
  theme: { tagSlug?: string; tagSlugs: string[]; categorySlugs: string[]; keywords: string[] },
  limit = 4
) {
  const byRating = [
    sql`${recipes.legacyRatingValue} desc nulls last`,
    desc(recipes.legacyRatingCount),
    desc(recipes.publishedAt),
  ];

  const curated = theme.tagSlug
    ? await db
        .select()
        .from(recipes)
        .where(
          and(
            eq(recipes.status, "published"),
            inArray(
              recipes.id,
              db
                .select({ id: recipeTags.recipeId })
                .from(recipeTags)
                .innerJoin(tags, eq(tags.id, recipeTags.tagId))
                .where(eq(tags.slug, theme.tagSlug))
            )
          )
        )
        .orderBy(...byRating)
        .limit(limit)
    : [];
  if (curated.length >= limit) return curated;

  const matchers = [];
  if (theme.tagSlugs.length) {
    matchers.push(
      inArray(
        recipes.id,
        db
          .select({ id: recipeTags.recipeId })
          .from(recipeTags)
          .innerJoin(tags, eq(tags.id, recipeTags.tagId))
          .where(inArray(tags.slug, theme.tagSlugs))
      )
    );
  }
  if (theme.categorySlugs.length) {
    matchers.push(
      inArray(
        recipes.id,
        db
          .select({ id: recipeCategories.recipeId })
          .from(recipeCategories)
          .innerJoin(categories, eq(categories.id, recipeCategories.categoryId))
          .where(inArray(categories.slug, theme.categorySlugs))
      )
    );
  }
  for (const kw of theme.keywords) {
    matchers.push(ilike(recipes.title, `%${kw}%`));
  }
  if (matchers.length === 0) return curated;

  const curatedIds = curated.map((r) => r.id);
  const fill = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.status, "published"),
        or(...matchers),
        curatedIds.length ? notInArray(recipes.id, curatedIds) : undefined
      )
    )
    .orderBy(...byRating)
    .limit(limit - curated.length);
  return [...curated, ...fill];
}

// Homepage TikTok strip: recipes that came from (or link to) a TikTok
// video. Thumbnails are our own hero images — TikTok CDN thumbnail URLs
// are signed and expire, and their embed script is ~0.5 MB of JS.
// COALESCE covers older imports approved before videoUrl was copied over.
export async function listTikTokVideos(limit = 8) {
  const rows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      uri: recipes.uri,
      heroImage: recipes.heroImage,
      videoUrl: sql<string>`coalesce(${recipes.videoUrl}, ${imports.tiktokUrl})`,
      videoViews: recipes.videoViews,
    })
    .from(recipes)
    .leftJoin(imports, and(eq(imports.recipeId, recipes.id), eq(imports.status, "approved")))
    // No status filter: the cards link to TikTok (public regardless of the
    // recipe's publication state), and every source here was admin-approved
    .where(
      and(
        sql`${recipes.heroImage} is not null`,
        sql`coalesce(${recipes.videoUrl}, ${imports.tiktokUrl}) is not null`
      )
    )
    .orderBy(desc(recipes.publishedAt));
  // A recipe with several approved imports would repeat — keep the first
  const seen = new Set<number>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, limit);
}

// All-time TikTok hits: videos with a captured view count, biggest first
export async function listTikTokHits(limit = 8) {
  return db
    .select({
      id: recipes.id,
      title: recipes.title,
      uri: recipes.uri,
      heroImage: recipes.heroImage,
      videoUrl: recipes.videoUrl,
      videoViews: recipes.videoViews,
    })
    .from(recipes)
    .where(
      and(
        sql`${recipes.heroImage} is not null`,
        sql`${recipes.videoUrl} is not null`,
        sql`${recipes.videoViews} is not null`
      )
    )
    .orderBy(desc(recipes.videoViews))
    .limit(limit);
}

// Homepage category tiles: children of "przepisy" with a cover photo
// taken from the freshest recipe in each subtree
export async function getCategoryTiles() {
  const [parent] = await db.select().from(categories).where(eq(categories.slug, "przepisy"));
  if (!parent) return [];
  const children = await db
    .select()
    .from(categories)
    .where(eq(categories.parentId, parent.id))
    .orderBy(categories.name);

  // Recipes live in several categories, so two tiles could pick the same
  // hero — track used covers and take each category's first unused one
  // (falling back to a duplicate only when every candidate is taken)
  const usedCovers = new Set<string>();
  const tiles = [];
  for (const c of children) {
    const inTree = await listRecipesInCategoryTree(c.id);
    if (inTree.length === 0) continue;
    const withImage =
      inTree.find((r) => r.heroImage && !usedCovers.has(r.heroImage)) ??
      inTree.find((r) => r.heroImage);
    if (withImage?.heroImage) usedCovers.add(withImage.heroImage);
    tiles.push({
      name: c.name,
      uri: c.uri,
      count: inTree.length,
      image: withImage?.heroImage ?? null,
    });
  }

  // The tile grid is 2/4 columns — keep the tile count a multiple of 4 so
  // every breakpoint fills its rows. Biggest categories stay, the closing
  // tile links to the full /przepisy/ archive.
  tiles.sort((a, b) => b.count - a.count);
  const all = await listRecipeArchive();
  const used = new Set(tiles.map((t) => t.image));
  const allTile = {
    name: "Wszystkie przepisy",
    uri: "/przepisy/",
    count: all.length,
    image:
      all.find((r) => r.heroImage && !used.has(r.heroImage))?.heroImage ??
      all.find((r) => r.heroImage)?.heroImage ??
      null,
  };
  const target = Math.max(4, Math.floor((tiles.length + 1) / 4) * 4);
  return [...tiles.slice(0, target - 1), allTile];
}

export type SearchParams = {
  q?: string;
  maxTime?: number;
  categorySlug?: string;
  sort?: "najnowsze" | "oceny" | "najszybsze";
};

export async function searchRecipes({ q, maxTime, categorySlug, sort }: SearchParams) {
  const conditions = [eq(recipes.status, "published")];

  if (q?.trim()) {
    const like = `%${q.trim()}%`;
    conditions.push(
      sql`(${recipes.title} ILIKE ${like} OR ${recipes.keywords} ILIKE ${like} OR ${recipes.lead} ILIKE ${like}
        OR EXISTS (SELECT 1 FROM ${recipeTags} rt JOIN ${tags} t ON t.id = rt.tag_id
                   WHERE rt.recipe_id = ${recipes.id} AND t.name ILIKE ${like}))` as any
    );
  }
  if (maxTime) {
    conditions.push(sql`${recipes.totalTimeMin} <= ${maxTime}` as any);
  }
  if (categorySlug) {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, categorySlug));
    if (cat) {
      const inTree = await listRecipesInCategoryTree(cat.id);
      const ids = inTree.map((r) => r.id);
      if (ids.length === 0) return [];
      conditions.push(inArray(recipes.id, ids));
    }
  }

  const order =
    sort === "oceny"
      ? [sql`${recipes.legacyRatingValue} DESC NULLS LAST` as any, desc(recipes.legacyRatingCount)]
      : sort === "najszybsze"
        ? [sql`${recipes.totalTimeMin} ASC NULLS LAST` as any]
        : [desc(recipes.publishedAt)];

  return db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(60);
}

export async function getTagBySlug(slug: string) {
  const [tag] = await db.select().from(tags).where(eq(tags.slug, slug));
  return tag ?? null;
}

export async function listRecipesByTagSlug(slug: string) {
  const rows = await db
    .selectDistinct({ recipe: recipes })
    .from(recipes)
    .innerJoin(recipeTags, eq(recipeTags.recipeId, recipes.id))
    .innerJoin(tags, eq(tags.id, recipeTags.tagId))
    .where(eq(tags.slug, slug))
    .orderBy(desc(recipes.publishedAt));
  return rows.map((r) => r.recipe).filter((r) => r.status === "published");
}

export async function listRecipesByTagSlugs(slugs: string[], limit = 4) {
  if (slugs.length === 0) return [];
  const rows = await db
    .selectDistinct({ recipe: recipes })
    .from(recipes)
    .innerJoin(recipeTags, eq(recipeTags.recipeId, recipes.id))
    .innerJoin(tags, eq(tags.id, recipeTags.tagId))
    .where(inArray(tags.slug, slugs))
    .orderBy(desc(recipes.publishedAt))
    .limit(limit);
  return rows.map((r) => r.recipe).filter((r) => r.status === "published");
}

export async function getAllTagsWithCounts() {
  return db
    .select({
      slug: tags.slug,
      name: tags.name,
      count: sql<number>`count(${recipeTags.recipeId})::int`,
    })
    .from(tags)
    .leftJoin(recipeTags, eq(recipeTags.tagId, tags.id))
    .groupBy(tags.id);
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
