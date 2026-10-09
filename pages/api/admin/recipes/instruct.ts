import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import { getAiModels, isValidModelId } from "../../../../lib/server/ai-models";
import { instructRecipe } from "../../../../lib/server/instruct-recipe";
import type { RecipeText } from "../../../../lib/recipe-ops";

// "Popraw wg instrukcji": bezstanowy podgląd zmian dla podglądu importu
// i edytora. Body: { recipe: RecipeText, instruction, model?, importId? }.
// Zwraca listę operacji z powodami; zapis robi odpowiednio
// PUT imports/[id] {action:"apply-ops"} albo formularz edytora.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body ?? {};
  const r = b.recipe ?? {};
  const recipe: RecipeText = {
    title: String(r.title ?? ""),
    lead: String(r.lead ?? ""),
    about: typeof r.about === "string" ? r.about : null,
    ingredientGroups: (Array.isArray(r.ingredientGroups) ? r.ingredientGroups : []).map((g: any) => ({
      title: g?.title ? String(g.title) : null,
      items: (Array.isArray(g?.items) ? g.items : []).map((x: any) => String(x ?? "")),
    })),
    steps: (Array.isArray(r.steps) ? r.steps : []).map((s: any) => ({
      title: s?.title ? String(s.title) : null,
      body: String(s?.body ?? ""),
      tip: s?.tip ? String(s.tip) : null,
    })),
    servings: r.servings != null && r.servings !== "" ? Number(r.servings) : null,
    prepTimeMin: r.prepTimeMin != null && r.prepTimeMin !== "" ? Number(r.prepTimeMin) : null,
    totalTimeMin: r.totalTimeMin != null && r.totalTimeMin !== "" ? Number(r.totalTimeMin) : null,
    difficulty: r.difficulty ? String(r.difficulty) : null,
  };
  const instruction = String(b.instruction ?? "").trim();
  if (!instruction) return res.status(400).json({ error: "Napisz, co poprawić" });
  if (!recipe.title && !recipe.ingredientGroups.length) return res.status(400).json({ error: "Brak przepisu" });

  let sourceContext: { caption?: string | null; transcript?: string | null } | null = null;
  const importId = Number(b.importId);
  if (Number.isInteger(importId)) {
    const [imp] = await db
      .select({ caption: dbSchema.imports.caption, transcript: dbSchema.imports.transcript })
      .from(dbSchema.imports)
      .where(eq(dbSchema.imports.id, importId));
    if (imp) sourceContext = imp;
  }

  try {
    const models = await getAiModels(db);
    const model = isValidModelId(b.model) ? b.model : models.refine;
    const result = await instructRecipe({ recipe, instruction, sourceContext, model });
    return res.json(result);
  } catch (e: any) {
    return res.status(502).json({ error: e.message?.slice(0, 300) || "Błąd modelu" });
  }
}
