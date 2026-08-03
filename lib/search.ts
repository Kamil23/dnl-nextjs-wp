// Meilisearch layer: typo-tolerant search over published recipes.
// Server-side only (master key) — the /szukaj page and /api/szukaj proxy
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
  totalTimeMin: number | null;
  ratingValue: number | null;
  ratingCount: number | null;
  tags: string[];
  keywords: string | null;
  ingredients: string[];
  // slugs of the recipe's categories INCLUDING ancestors (tree filtering)
  categories: string[];
  publishedAt: number | null;
};

export async function configureIndex() {
  const index = meili().index(INDEX);
  await index.updateSettings({
    searchableAttributes: ["title", "tags", "keywords", "ingredients", "lead"],
    filterableAttributes: ["categories", "totalTimeMin", "kcal"],
    sortableAttributes: ["publishedAt", "ratingValue", "totalTimeMin"],
    displayedAttributes: [
      "id", "title", "lead", "uri", "heroImage", "kcal",
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
  sort?: "oceny" | "najszybsze" | "najnowsze" | string;
  limit?: number;
};

export async function searchMeili({ q, maxTime, categorySlug, sort, limit = 60 }: MeiliParams) {
  const filter: string[] = [];
  if (maxTime) filter.push(`totalTimeMin <= ${maxTime}`);
  if (categorySlug) filter.push(`categories = "${categorySlug}"`);

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
