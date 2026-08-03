/**
 * One-shot WordPress -> Postgres import for dietanaluzie.pl.
 *
 * Sources:
 *  - WPGraphQL: posts (content, taxonomy), categories, static pages
 *  - WP REST:   Yoast SEO meta (yoast_head_json) for posts/pages/categories
 *  - Live site: theme Recipe JSON-LD (aggregateRating, prepTime, servings, keywords)
 *
 * Re-runnable: truncates content tables first (safe until real user ratings exist).
 * Run: npm run import:wp
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../lib/db/schema";
import {
  parseIngredients,
  parseIngredientGroups,
  parseSteps,
  parseTotalTimeMinutes,
  stripTags,
} from "../lib/recipe-parser";

const API_URL = process.env.WORDPRESS_API_URL!;
const WP_BASE = API_URL.replace(/\/graphql\/?$/, "");
const SITE_URL = "https://dietanaluzie.pl";
const EXCLUDED_PAGE_URIS = ["/koszyk/", "/moje-konto/", "/zamowienie/", "/sklep/", "/strona-glowna/"];

const sql = postgres(process.env.DATABASE_URL!, { max: 5 });
const db = drizzle(sql, { schema });

async function gql(query: string, variables: Record<string, any> = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error("GraphQL error: " + JSON.stringify(json.errors));
  }
  return json.data;
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// ---------- fetch: posts via GraphQL (cursor walk) ----------
async function fetchAllPosts() {
  const edges: any[] = [];
  let after: string | null = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const data = await gql(
      `query ImportPosts($after: String) {
        posts(first: 100, after: $after, where: { orderby: { field: DATE, order: ASC } }) {
          pageInfo { hasNextPage endCursor }
          edges { node {
            slug uri title excerpt content date modified
            featuredImage { node { sourceUrl } }
            author { node { name } }
            categories { edges { node { slug } } }
            tags { edges { node { slug name } } }
          } }
        }
      }`,
      { after }
    );
    edges.push(...data.posts.edges.map((e: any) => e.node));
    hasNextPage = data.posts.pageInfo.hasNextPage;
    after = data.posts.pageInfo.endCursor;
  }
  return edges;
}

async function fetchAllCategories() {
  const data = await gql(
    `{ categories(first: 100) { edges { node {
      slug uri name description count
      parent { node { slug } }
    } } } }`
  );
  return data.categories.edges.map((e: any) => e.node);
}

async function fetchAllPages() {
  const data = await gql(
    `{ pages(first: 100) { edges { node { slug uri title content } } } }`
  );
  return data.pages.edges
    .map((e: any) => e.node)
    .filter((p: any) => p.uri !== "/" && !EXCLUDED_PAGE_URIS.includes(p.uri));
}

// ---------- fetch: Yoast meta via REST (batched) ----------
async function fetchYoastMap(type: "posts" | "pages" | "categories") {
  const map = new Map<string, any>();
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${WP_BASE}/wp-json/wp/v2/${type}?per_page=100&page=${page}&_fields=slug,yoast_head_json`
    );
    if (!res.ok) break;
    const items = await res.json();
    for (const item of items) {
      map.set(item.slug, item.yoast_head_json ?? null);
    }
    if (items.length < 100) break;
  }
  return map;
}

// ---------- fetch: theme Recipe JSON-LD from the live page ----------
async function scrapeLiveRecipeMeta(uri: string) {
  try {
    const res = await fetch(`${SITE_URL}${uri}`, {
      headers: { "User-Agent": "dnl-import/1.0" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const blocks = Array.from(
      html.matchAll(
        /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
      )
    );
    for (const b of blocks) {
      let parsed: any;
      try {
        parsed = JSON.parse(b[1]);
      } catch {
        continue;
      }
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const recipe = arr.find((x) => x?.["@type"] === "Recipe");
      if (recipe) {
        return {
          ratingValue: recipe.aggregateRating?.ratingValue ?? null,
          ratingCount: recipe.aggregateRating?.reviewCount ?? null,
          prepTime: recipe.prepTime ?? null,
          totalTime: recipe.totalTime ?? null,
          recipeYield: recipe.recipeYield ?? null,
          keywords: recipe.keywords ?? null,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function isoDurationToMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m || (!m[1] && !m[2])) return null;
  return (m[1] ? parseInt(m[1], 10) * 60 : 0) + (m[2] ? parseInt(m[2], 10) : 0);
}

function servingsToInt(recipeYield: string | null): number | null {
  const m = recipeYield?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  console.log("== Import WP -> Postgres ==");

  console.log("Pobieram posty, kategorie, strony (GraphQL)...");
  const [posts, categories, wpPages] = await Promise.all([
    fetchAllPosts(),
    fetchAllCategories(),
    fetchAllPages(),
  ]);
  console.log(`  posty: ${posts.length}, kategorie: ${categories.length}, strony: ${wpPages.length}`);

  console.log("Pobieram meta Yoast (REST)...");
  const [yoastPosts, yoastPages, yoastCats] = await Promise.all([
    fetchYoastMap("posts"),
    fetchYoastMap("pages"),
    fetchYoastMap("categories"),
  ]);

  console.log("Scrapuję oceny i meta przepisów z żywych stron (113 requestów, powoli)...");
  let scraped = 0;
  const liveMeta = new Map<string, any>();
  await mapConcurrent(posts, 5, async (p) => {
    const meta = await scrapeLiveRecipeMeta(p.uri);
    liveMeta.set(p.uri, meta);
    scraped++;
    if (scraped % 25 === 0) console.log(`  ...${scraped}/${posts.length}`);
  });

  console.log("Zapisuję do bazy...");
  await db.transaction(async (tx) => {
    // Content tables only — safe while there are no organic ratings yet
    await tx.execute(
      `TRUNCATE recipe_tags, recipe_categories, ingredients, ingredient_groups,
       steps, ratings, tags, categories, recipes, pages RESTART IDENTITY CASCADE` as any
    );

    // Categories (two passes: insert, then wire parents)
    const catIdBySlug = new Map<string, number>();
    for (const c of categories) {
      const yoast = yoastCats.get(c.slug);
      const [row] = await tx
        .insert(schema.categories)
        .values({
          slug: c.slug,
          uri: c.uri,
          name: c.name,
          description: c.description || null,
          seoTitle: yoast?.title ?? null,
          seoDescription: yoast?.description ?? null,
        })
        .returning({ id: schema.categories.id });
      catIdBySlug.set(c.slug, row.id);
    }
    for (const c of categories) {
      const parentSlug = c.parent?.node?.slug;
      if (parentSlug && catIdBySlug.has(parentSlug)) {
        await tx.execute(
          `UPDATE categories SET parent_id = ${catIdBySlug.get(parentSlug)} WHERE slug = '${c.slug}'` as any
        );
      }
    }

    const tagIdBySlug = new Map<string, number>();

    for (const p of posts) {
      const yoast = yoastPosts.get(p.slug);
      const live = liveMeta.get(p.uri);
      const ingredientGroupsParsed = parseIngredientGroups(p.content || "");
      const stepItems = parseSteps(p.content || "");
      const totalMin =
        parseTotalTimeMinutes(p.content || "") ??
        isoDurationToMinutes(live?.totalTime);

      const [recipe] = await tx
        .insert(schema.recipes)
        .values({
          slug: p.slug,
          uri: p.uri,
          status: "published",
          title: stripTags(p.title),
          lead: stripTags(p.excerpt || "") || null,
          excerpt: p.excerpt || null,
          contentHtml: p.content || null,
          heroImage: p.featuredImage?.node?.sourceUrl ?? null,
          authorName: p.author?.node?.name ?? null,
          prepTimeMin: isoDurationToMinutes(live?.prepTime),
          totalTimeMin: totalMin,
          servings: servingsToInt(live?.recipeYield),
          servingsText: live?.recipeYield ?? null,
          keywords: live?.keywords || null,
          seoTitle: yoast?.title ?? null,
          seoDescription: yoast?.description ?? null,
          legacyRatingValue: live?.ratingValue ?? null,
          legacyRatingCount: live?.ratingCount
            ? parseInt(live.ratingCount, 10)
            : null,
          source: "wp_import",
          publishedAt: p.date ? new Date(p.date + "Z") : null,
          updatedAt: p.modified ? new Date(p.modified + "Z") : new Date(),
        })
        .returning({ id: schema.recipes.id });

      let groupPos = 0;
      for (const g of ingredientGroupsParsed) {
        const [group] = await tx
          .insert(schema.ingredientGroups)
          .values({ recipeId: recipe.id, title: g.title, position: groupPos++ })
          .returning({ id: schema.ingredientGroups.id });
        await tx.insert(schema.ingredients).values(
          g.items.map((raw, i) => ({
            groupId: group.id,
            rawText: raw,
            position: i,
          }))
        );
      }

      if (stepItems.length > 0) {
        await tx.insert(schema.steps).values(
          stepItems.map((s, i) => ({
            recipeId: recipe.id,
            position: i,
            title: s.name ?? null,
            body: s.text,
          }))
        );
      }

      for (const { node: c } of p.categories?.edges ?? []) {
        const catId = catIdBySlug.get(c.slug);
        if (catId) {
          await tx
            .insert(schema.recipeCategories)
            .values({ recipeId: recipe.id, categoryId: catId });
        }
      }

      for (const { node: t } of p.tags?.edges ?? []) {
        if (!tagIdBySlug.has(t.slug)) {
          const [tag] = await tx
            .insert(schema.tags)
            .values({ slug: t.slug, name: t.name })
            .returning({ id: schema.tags.id });
          tagIdBySlug.set(t.slug, tag.id);
        }
        await tx
          .insert(schema.recipeTags)
          .values({ recipeId: recipe.id, tagId: tagIdBySlug.get(t.slug)! });
      }
    }

    for (const pg of wpPages) {
      const yoast = yoastPages.get(pg.slug);
      await tx.insert(schema.pages).values({
        slug: pg.slug,
        uri: pg.uri,
        title: stripTags(pg.title),
        contentHtml: pg.content || null,
        seoTitle: yoast?.title ?? null,
        seoDescription: yoast?.description ?? null,
      });
    }
  });

  // ---------- data quality report ----------
  const report = {
    recipes: posts.length,
    withIngredients: 0,
    withSteps: 0,
    withRating: 0,
    withServings: 0,
    withTime: 0,
    withSeo: 0,
    needsAttention: [] as string[],
  };
  for (const p of posts) {
    const live = liveMeta.get(p.uri);
    const ing = parseIngredientGroups(p.content || "").some((g) => g.items.length > 0);
    const st = parseSteps(p.content || "").length > 0;
    if (ing) report.withIngredients++;
    if (st) report.withSteps++;
    if (live?.ratingValue) report.withRating++;
    if (servingsToInt(live?.recipeYield)) report.withServings++;
    if (parseTotalTimeMinutes(p.content || "") || isoDurationToMinutes(live?.totalTime)) report.withTime++;
    if (yoastPosts.get(p.slug)?.description) report.withSeo++;
    if (!ing || !st) report.needsAttention.push(`${p.uri} (${!ing ? "brak składników" : ""}${!ing && !st ? ", " : ""}${!st ? "brak kroków" : ""})`);
  }

  console.log("\n== RAPORT IMPORTU ==");
  console.log(`Przepisy:        ${report.recipes}`);
  console.log(`  ze składnikami: ${report.withIngredients}`);
  console.log(`  z krokami:      ${report.withSteps}`);
  console.log(`  z oceną:        ${report.withRating}`);
  console.log(`  z porcjami:     ${report.withServings}`);
  console.log(`  z czasem:       ${report.withTime}`);
  console.log(`  z meta Yoast:   ${report.withSeo}`);
  console.log(`Kategorie:       ${categories.length}`);
  console.log(`Strony:          ${wpPages.length}`);
  console.log(`\nDo ręcznego dopieszczenia w adminie (${report.needsAttention.length}):`);
  for (const line of report.needsAttention) console.log(`  - ${line}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
