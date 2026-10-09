// AI estimation of per-serving nutrition from an ingredient list. Server-only
// (uses the OpenAI key). Shared by the admin "estimate" button, the one-shot
// backfill script (scripts/estimate-macros.ts), QC "Porcje z AI" and the
// TikTok import. Od 2026-10 liczy przez jawne rozbicie składników na gramy
// i tabelę per 100 g (lib/server/nutrition-ai + lib/nutrition-calc), a nie
// jedną liczbą "na oko"; kontrakt MacroEstimate zostaje, dochodzi breakdown.
import { buildBreakdown } from "./nutrition-ai";
import { perServing, type NutritionBreakdown } from "../nutrition-calc";

export type MacroEstimate = {
  // NA PORCJĘ, licząc przez efektywną liczbę porcji (podaną albo - gdy brak -
  // assumedServings). Zachowuje kontrakt dla dotychczasowych wywołań.
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  // Niezależna, realistyczna ocena liczby porcji przez AI (może różnić się od
  // podanej - edytor/QC to wykorzystują, żeby wychwycić np. "1 porcja = 1394 kcal").
  assumedServings: number;
  // Sumy dla CAŁEGO przepisu - pozwalają przeliczyć makra pod dowolną liczbę porcji.
  totalKcal: number;
  totalProtein: number | null;
  totalFat: number | null;
  totalCarbs: number | null;
  // Pełne rozbicie (składnik → gramy → per 100 g), do zapisu w recipes.nutrition_breakdown
  breakdown: NutritionBreakdown;
};

export async function estimateMacros(
  title: string,
  servings: number | null,
  items: string[],
  opts: { model?: string; context?: string | null } = {}
): Promise<MacroEstimate> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Brak OPENAI_API_KEY");
  const breakdown = await buildBreakdown({
    title,
    lines: items,
    servings: servings && servings > 0 ? servings : null,
    servingsSource: "operator",
    context: opts.context ?? null,
    model: opts.model,
  });
  const totalKcal = breakdown.totals.kcal;
  if (!totalKcal || totalKcal < 20 || totalKcal > 20000) {
    throw new Error(`podejrzane kcal całości: ${totalKcal} (sprawdź gramatury składników)`);
  }
  const assumed = breakdown.servingsEstimate && breakdown.servingsEstimate > 0 ? breakdown.servingsEstimate : 1;
  const eff = servings && servings > 0 ? servings : assumed;
  const per = perServing(breakdown.totals, eff)!;
  return {
    kcal: per.kcal,
    protein: per.protein,
    fat: per.fat,
    carbs: per.carbs,
    assumedServings: assumed,
    totalKcal,
    totalProtein: breakdown.totals.protein,
    totalFat: breakdown.totals.fat,
    totalCarbs: breakdown.totals.carbs,
    breakdown,
  };
}
