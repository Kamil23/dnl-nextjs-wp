import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, sql } from "drizzle-orm";
import { isAdminRequest } from "../../../lib/admin-auth";
import { db, dbSchema } from "../../../lib/db";
import { planRecipeFixes, hasFixes } from "../../../lib/recipe-qc-fix";
import { syncRecipeToSearch } from "../../../lib/search-sync";

// Applies the deterministic QC auto-fixes (lib/recipe-qc-fix) to one recipe
// (`{ id }`) or every fixable one (`{ all: true }`), then re-syncs Meilisearch.
// POST-only, admin-guarded.

const { recipes, ingredientGroups, ingredients, steps } = dbSchema;

async function applyToRecipe(id: number): Promise<{ id: number; title: string; applied: string[] } | null> {
  const [r] = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      kcal: recipes.kcal,
      protein: recipes.protein,
      fat: recipes.fat,
      carbs: recipes.carbs,
      servings: recipes.servings,
      prepTimeMin: recipes.prepTimeMin,
      cookTimeMin: recipes.cookTimeMin,
      totalTimeMin: recipes.totalTimeMin,
      contentHtml: recipes.contentHtml,
    })
    .from(recipes)
    .where(eq(recipes.id, id));
  if (!r) return null;

  const [ingC] = await db
    .select({ c: sql<number>`count(${ingredients.id})::int` })
    .from(ingredientGroups)
    .leftJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
    .where(eq(ingredientGroups.recipeId, id));
  const [stepC] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(steps)
    .where(eq(steps.recipeId, id));

  const plan = planRecipeFixes({
    kcal: r.kcal,
    protein: r.protein != null ? Number(r.protein) : null,
    fat: r.fat != null ? Number(r.fat) : null,
    carbs: r.carbs != null ? Number(r.carbs) : null,
    servings: r.servings,
    prepTimeMin: r.prepTimeMin,
    cookTimeMin: r.cookTimeMin,
    totalTimeMin: r.totalTimeMin,
    ingredientCount: Number(ingC?.c ?? 0),
    stepCount: Number(stepC?.c ?? 0),
    contentHtml: r.contentHtml,
  });

  if (!hasFixes(plan)) return { id, title: r.title, applied: [] };

  // Pola liczbowe (numeric -> string dla drizzle)
  const u = plan.updates;
  const set: Record<string, unknown> = {};
  if (u.kcal != null) set.kcal = u.kcal;
  if (u.protein != null) set.protein = String(u.protein);
  if (u.fat != null) set.fat = String(u.fat);
  if (u.carbs != null) set.carbs = String(u.carbs);
  if (u.totalTimeMin != null) set.totalTimeMin = u.totalTimeMin;
  if (Object.keys(set).length) {
    await db.update(recipes).set(set).where(eq(recipes.id, id));
  }

  if (plan.addSteps.length) {
    await db.insert(steps).values(
      plan.addSteps.map((s, i) => ({ recipeId: id, title: s.title, body: s.body, position: i }))
    );
  }

  if (plan.addIngredients.length) {
    const [g] = await db
      .insert(ingredientGroups)
      .values({ recipeId: id, title: null, position: 0 })
      .returning({ id: ingredientGroups.id });
    await db.insert(ingredients).values(
      plan.addIngredients.map((t, i) => ({ groupId: g.id, rawText: t, position: i }))
    );
  }

  await syncRecipeToSearch(db, id);
  return { id, title: r.title, applied: plan.descriptions };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: "unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const body = typeof req.body === "object" && req.body ? req.body : {};

  try {
    if (body.all === true) {
      const list = await db
        .select({ id: recipes.id })
        .from(recipes)
        .where(and(eq(recipes.status, "published"), sql`${recipes.uri} not like '/artykuly/%'`));
      const results: { id: number; title: string; applied: string[] }[] = [];
      for (const { id } of list) {
        const r = await applyToRecipe(id);
        if (r && r.applied.length) results.push(r);
      }
      return res.json({ fixed: results.length, results });
    }

    const id = Number(body.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id required" });
    const r = await applyToRecipe(id);
    if (!r) return res.status(404).json({ error: "not found" });
    return res.json({ fixed: r.applied.length > 0 ? 1 : 0, results: [r] });
  } catch (e) {
    console.error("qc-fix failed:", (e as Error).message);
    return res.status(500).json({ error: "fix failed" });
  }
}
