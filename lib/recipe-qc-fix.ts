// Turns QC findings into concrete, deterministic auto-fixes. Shared by the admin
// QC page (to describe what a fix would do) and the /api/admin/qc-fix endpoint
// (to apply it), so both always agree. Only unambiguous fixes live here - things
// like "which serving count is right" or "write an image" are left to a human.
import { extractStructured, type ExtractedStep } from "./recipe-html-extract";

export type QcFixInput = {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  totalTimeMin: number | null;
  ingredientCount: number;
  stepCount: number;
  contentHtml: string | null;
};

export type RecipeUpdates = Partial<{
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  totalTimeMin: number;
}>;

export type FixPlan = {
  updates: RecipeUpdates;
  addIngredients: string[];
  addSteps: ExtractedStep[];
  descriptions: string[];
};

const round1 = (v: number) => Math.round(v * 10) / 10;

export function planRecipeFixes(r: QcFixInput): FixPlan {
  const updates: RecipeUpdates = {};
  const descriptions: string[] = [];
  let addIngredients: string[] = [];
  let addSteps: ExtractedStep[] = [];

  const kcal = r.kcal;
  const servings = r.servings ?? 0;

  // 1. Wartości "dla całości" zamiast na porcję → podziel przez liczbę porcji.
  //    Trigger tylko gdy kcal jest nieprawdopodobne per porcja, a po podziale
  //    wpada w sensowny zakres - i dzielimy makra spójnie z kcal.
  if (kcal != null && servings > 1 && kcal > 1500) {
    const perKcal = kcal / servings;
    if (perKcal >= 30 && perKcal <= 1000) {
      updates.kcal = Math.round(perKcal);
      if (r.protein != null) updates.protein = round1(r.protein / servings);
      if (r.fat != null) updates.fat = round1(r.fat / servings);
      if (r.carbs != null) updates.carbs = round1(r.carbs / servings);
      descriptions.push(`Przelicz kcal i makra na porcję (÷${servings}): ${kcal}→${updates.kcal} kcal`);
    }
  }

  // 2. Brak kcal, ale makra są → policz z makr (Atwater 4/9/4).
  if (updates.kcal == null && kcal == null && r.protein != null && r.fat != null && r.carbs != null) {
    const computed = Math.round(r.protein * 4 + r.fat * 9 + r.carbs * 4);
    if (computed >= 30 && computed <= 1500) {
      updates.kcal = computed;
      descriptions.push(`Policz kaloryczność z makr: ${computed} kcal`);
    }
  }

  // 3. Brak czasu całkowitego, ale są części → suma prep + cook.
  if (r.totalTimeMin == null && (r.prepTimeMin != null || r.cookTimeMin != null)) {
    const t = (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0);
    if (t > 0) {
      updates.totalTimeMin = t;
      descriptions.push(`Uzupełnij czas całkowity: ${t} min`);
    }
  }

  // 4. Brak struktury (kroki/składniki), ale są w starej treści HTML → wyciągnij.
  if (r.stepCount === 0 || r.ingredientCount === 0) {
    const ex = extractStructured(r.contentHtml);
    if (r.stepCount === 0 && ex.steps.length > 0) {
      addSteps = ex.steps;
      descriptions.push(`Wyciągnij ${ex.steps.length} kroków z treści HTML`);
    }
    if (r.ingredientCount === 0 && ex.ingredients.length > 0) {
      addIngredients = ex.ingredients;
      descriptions.push(`Wyciągnij ${ex.ingredients.length} składników z treści HTML`);
    }
  }

  return { updates, addIngredients, addSteps, descriptions };
}

export function hasFixes(plan: FixPlan): boolean {
  return plan.descriptions.length > 0;
}
