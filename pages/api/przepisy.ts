import type { NextApiRequest, NextApiResponse } from "next";
import {
  getCategoryByUri,
  listRecipeArchive,
  listRecipesInCategoryTree,
  toListingEdge,
} from "../../lib/queries";
import { CATEGORY_POSTS_PER_PAGE } from "../../lib/constants";

// Feeds the infinite scroll on /przepisy/ and category archives - same data
// and page size as the statically rendered /page/N/ pages.
// ?kategoria=/kategoria/przepisy/sniadania/ scopes to a category tree.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const page = parseInt(String(req.query.page), 10);
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: "Nieprawidłowy numer strony" });
  }

  let all;
  const categoryUri = typeof req.query.kategoria === "string" ? req.query.kategoria : null;
  if (categoryUri) {
    if (!categoryUri.startsWith("/kategoria/")) {
      return res.status(400).json({ error: "Nieprawidłowa kategoria" });
    }
    const category = await getCategoryByUri(categoryUri);
    if (!category) {
      return res.status(404).json({ error: "Nie znaleziono kategorii" });
    }
    all = await listRecipesInCategoryTree(category.id);
  } else {
    all = await listRecipeArchive();
  }
  const totalPages = Math.max(1, Math.ceil(all.length / CATEGORY_POSTS_PER_PAGE));
  const posts = all
    .slice((page - 1) * CATEGORY_POSTS_PER_PAGE, page * CATEGORY_POSTS_PER_PAGE)
    .map(toListingEdge);

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({ posts, totalPages });
}
