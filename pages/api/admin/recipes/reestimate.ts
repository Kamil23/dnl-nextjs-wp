import type { NextApiRequest, NextApiResponse } from "next";
import { eq, asc } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import { estimateMacros } from "../../../../lib/server/estimate-macros";
import { syncRecipeToSearch } from "../../../../lib/search-sync";

// QC auto-fix "Porcje z AI": AI niezależnie ocenia liczbę porcji z listy
// składników, a my ustawiamy servings = assumedServings i przeliczamy makra na
// porcję. Zapisuje do bazy i resynchronizuje Meili. POST { id }, tylko admin.

const { recipes, ingredientGroups, ingredients } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = Number(req.body?.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id required" });

  const [r] = await db.select({ id: recipes.id, title: recipes.title }).from(recipes).where(eq(recipes.id, id));
  if (!r) return res.status(404).json({ error: "not found" });

  const items = await db
    .select({ rawText: ingredients.rawText })
    .from(ingredientGroups)
    .innerJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
    .where(eq(ingredientGroups.recipeId, id))
    .orderBy(asc(ingredientGroups.position), asc(ingredients.position));
  const list = items.map((i) => i.rawText).filter(Boolean) as string[];
  if (list.length === 0) return res.status(400).json({ error: "przepis nie ma składników" });

  try {
    // servings=null → estymator dzieli przez własną, realistyczną ocenę porcji
    const m = await estimateMacros(r.title, null, list);
    const servings = m.assumedServings > 0 ? m.assumedServings : 1;

    await db
      .update(recipes)
      .set({
        servings,
        kcal: m.kcal,
        protein: m.protein != null ? String(m.protein) : null,
        fat: m.fat != null ? String(m.fat) : null,
        carbs: m.carbs != null ? String(m.carbs) : null,
      })
      .where(eq(recipes.id, id));

    await syncRecipeToSearch(db, id);
    return res.json({
      id,
      servings,
      kcal: m.kcal,
      protein: m.protein,
      fat: m.fat,
      carbs: m.carbs,
    });
  } catch (e: any) {
    return res.status(502).json({ error: e.message?.slice(0, 200) || "Błąd estymacji" });
  }
}
