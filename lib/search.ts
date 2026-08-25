// Meilisearch layer: typo-tolerant search over published recipes.
// Server-side only (master key) - the /szukaj page and /api/szukaj proxy
// use it; everything degrades to the Postgres path when MEILI_HOST is unset.
import { Meilisearch } from "meilisearch";

export const INDEX = "przepisy";

export function searchEnabled() {
  return Boolean(process.env.MEILI_HOST && process.env.MEILI_MASTER_KEY);
}

export function meili() {
  return new Meilisearch({
    host: process.env.MEILI_HOST!,
    apiKey: process.env.MEILI_MASTER_KEY!,
  });
}

export type RecipeDoc = {
  id: number;
  title: string;
  lead: string | null;
  uri: string;
  heroImage: string | null;
  kcal: number | null;
  protein: number | null;
  totalTimeMin: number | null;
  ratingValue: number | null;
  ratingCount: number | null;
  tags: string[];
  keywords: string | null;
  ingredients: string[];
  // slugs of the recipe's categories INCLUDING ancestors (tree filtering)
  categories: string[];
  // inferred diet facet keys (lib/diets.ts): weganskie, bezglutenowe, ...
  diets: string[];
  publishedAt: number | null;
};

export async function configureIndex() {
  const index = meili().index(INDEX);
  await index.updateSettings({
    searchableAttributes: ["title", "tags", "keywords", "ingredients", "lead"],
    filterableAttributes: ["categories", "totalTimeMin", "kcal", "protein", "diets"],
    sortableAttributes: ["publishedAt", "ratingValue", "totalTimeMin", "protein"],
    displayedAttributes: [
      "id", "title", "lead", "uri", "heroImage", "kcal", "protein",
      "totalTimeMin", "ratingValue", "ratingCount",
    ],
  });
}

export async function upsertDocs(docs: RecipeDoc[]) {
  await meili().index(INDEX).addDocuments(docs, { primaryKey: "id" });
}

export async function deleteDoc(id: number) {
  await meili().index(INDEX).deleteDocument(id);
}

export type MeiliParams = {
  q?: string;
  maxTime?: number;
  categorySlug?: string;
  maxKcal?: number;
  minProtein?: number;
  diet?: string;
  sort?: "oceny" | "najszybsze" | "najnowsze" | string;
  limit?: number;
};

export async function searchMeili({ q, maxTime, categorySlug, maxKcal, minProtein, diet, sort, limit = 60 }: MeiliParams) {
  const filter: string[] = [];
  if (maxTime) filter.push(`totalTimeMin <= ${maxTime}`);
  if (categorySlug) filter.push(`categories = "${categorySlug}"`);
  if (maxKcal) filter.push(`kcal <= ${maxKcal}`);
  if (minProtein) filter.push(`protein >= ${minProtein}`);
  if (diet) filter.push(`diets = "${diet}"`);

  const sortRule =
    sort === "oceny"
      ? ["ratingValue:desc"]
      : sort === "najszybsze"
        ? ["totalTimeMin:asc"]
        : q?.trim()
          ? undefined // z frazą: pełny ranking trafności Meili
          : ["publishedAt:desc"];

  const res = await meili().index(INDEX).search(q ?? "", {
    filter,
    sort: sortRule,
    limit,
  });
  return res.hits as RecipeDoc[];
}

// --- Faceted instant search ------------------------------------------

// Discrete bucket options for the range filters, shared by the API and the UI.
export const KCAL_BUCKETS = [300, 500, 700];
export const TIME_BUCKETS = [20, 30, 60];
export const HIGH_PROTEIN_MIN = 25;

export type FacetSelection = {
  categorySlug?: string;
  maxKcal?: number;
  maxTime?: number;
  minProtein?: number;
  diet?: string;
};

// Which facet group to leave OUT when counting that group's own options
// (disjunctive faceting: selecting "do 500 kcal" must not zero the other
// kcal buckets' counts).
type FacetGroup = "category" | "kcal" | "time" | "protein" | "diet";

function buildFilter(sel: FacetSelection, exclude?: FacetGroup): string[] {
  const f: string[] = [];
  if (sel.categorySlug && exclude !== "category") f.push(`categories = "${sel.categorySlug}"`);
  if (sel.maxKcal && exclude !== "kcal") f.push(`kcal <= ${sel.maxKcal}`);
  if (sel.maxTime && exclude !== "time") f.push(`totalTimeMin <= ${sel.maxTime}`);
  if (sel.minProtein && exclude !== "protein") f.push(`protein >= ${sel.minProtein}`);
  if (sel.diet && exclude !== "diet") f.push(`diets = "${sel.diet}"`);
  return f;
}

export type FacetCounts = {
  kcal: Record<number, number>;
  time: Record<number, number>;
  protein: number;
  diet: Record<string, number>;
};

export type FullSearchResult = { hits: RecipeDoc[]; counts: FacetCounts; total: number };

// One instant-search call: results + disjunctive facet counts, all respecting
// the current text query. Small dataset, so the handful of count queries run
// in parallel and stay fast.
export async function searchMeiliFull(
  q: string,
  sel: FacetSelection,
  sort?: string,
  limit = 60
): Promise<FullSearchResult> {
  const idx = meili().index(INDEX);
  const trimmed = q?.trim();

  const sortRule =
    sort === "oceny" ? ["ratingValue:desc"]
      : sort === "najszybsze" ? ["totalTimeMin:asc"]
        : trimmed ? undefined
          : ["publishedAt:desc"];

  const countAt = (filter: string[]) =>
    idx.search(q ?? "", { filter, limit: 0 }).then((r) => r.estimatedTotalHits ?? 0);

  const [main, dietRes, protein, ...buckets] = await Promise.all([
    idx.search(q ?? "", { filter: buildFilter(sel), sort: sortRule, limit }),
    idx.search(q ?? "", { filter: buildFilter(sel, "diet"), facets: ["diets"], limit: 0 }),
    countAt([...buildFilter(sel, "protein"), `protein >= ${HIGH_PROTEIN_MIN}`]),
    ...KCAL_BUCKETS.map((b) => countAt([...buildFilter(sel, "kcal"), `kcal <= ${b}`])),
    ...TIME_BUCKETS.map((b) => countAt([...buildFilter(sel, "time"), `totalTimeMin <= ${b}`])),
  ]);

  const kcal: Record<number, number> = {};
  KCAL_BUCKETS.forEach((b, i) => (kcal[b] = buckets[i]));
  const time: Record<number, number> = {};
  TIME_BUCKETS.forEach((b, i) => (time[b] = buckets[KCAL_BUCKETS.length + i]));

  return {
    hits: main.hits as RecipeDoc[],
    total: main.estimatedTotalHits ?? main.hits.length,
    counts: {
      kcal,
      time,
      protein,
      diet: (dietRes.facetDistribution?.diets ?? {}) as Record<string, number>,
    },
  };
}

// Diet facet keys that actually have at least one recipe - lets the UI hide
// diet filters with no matches (recipes aren't diet-tagged yet). Returns null
// on failure so callers can fall back to showing all diets.
export async function availableDietKeys(): Promise<string[] | null> {
  try {
    const res = await meili().index(INDEX).search("", { facets: ["diets"], limit: 0 });
    const dist = res.facetDistribution?.diets ?? {};
    return Object.keys(dist).filter((k) => (dist[k] ?? 0) > 0);
  } catch {
    return null;
  }
}
