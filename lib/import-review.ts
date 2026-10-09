// Audyt kompletności draftu z importu TikTok: czysta funkcja, bez I/O.
// Worker woła ją po drafcie (żeby wiedzieć, czy odpalić dopełnianie) i po
// wartościach odżywczych (wynik zapisany w aiDraft.review); API accept liczy
// ją ponownie na świeżych danych, więc blokada nie zależy od UI.
import { ingredientLines, type ImportDraft } from "./import-draft";
import { parseShoppingLine } from "./quantity";
import { nutritionIssues, type QcIssue } from "./recipe-qc";

export type DraftReview = { issues: QcIssue[]; blocking: boolean };

export function reviewDraft(draft: Partial<ImportDraft>): DraftReview {
  const issues: QcIssue[] = [];
  const add = (severity: "error" | "warning", code: string, message: string, field?: string) =>
    issues.push({ severity, code, message, field });

  const lines = ingredientLines(draft as ImportDraft);
  const steps = (draft.steps ?? []).filter((s) => s?.body?.trim());

  if (lines.length === 0) add("error", "no-ingredients", "Draft nie ma składników.", "ingredients");
  if (steps.length < 2) add("error", "few-steps", `Za mało kroków (${steps.length}); przepis musi mieć co najmniej 2.`, "steps");
  if (!(draft.categorySlugs ?? []).length) add("error", "no-categories", "Brak kategorii; bez niej przepis nie trafi do archiwum.", "categories");
  if (!draft.title?.trim()) add("error", "no-title", "Brak tytułu.", "title");

  // Składniki bez ilości ("jabłko", "mąka") - nie da się z nich policzyć kcal
  const noAmount = lines.filter((l) => parseShoppingLine(l).kind === "none");
  if (noAmount.length) {
    const ratio = noAmount.length / lines.length;
    add(
      ratio > 0.3 ? "error" : "warning",
      "ingredients-no-amount",
      `Składniki bez ilości (${noAmount.length} z ${lines.length}): ${noAmount.join("; ")}.`,
      "ingredients"
    );
  }

  if (draft.confidence && draft.confidence !== "high") {
    add("warning", "confidence", `Model ocenił pewność odczytu jako „${draft.confidence}”.`, "confidence");
  }
  if (draft.notes?.trim()) add("warning", "notes", `Uwagi modelu: ${draft.notes.trim()}`, "notes");
  if (draft.prepTimeMin == null && draft.totalTimeMin == null) {
    add("warning", "time-missing", "Brak czasu przygotowania.", "totalTimeMin");
  }

  // Porcje i wartości na porcję: te same reguły co QC opublikowanych
  if (draft.servings == null || draft.servings <= 0) {
    add("error", "servings-missing", "Brak liczby porcji. Bez niej nie ma kcal na porcję ani skalowania.", "servings");
  }
  if (draft.kcal == null) {
    add("error", "kcal-missing", "Brak kaloryczności na porcję.", "kcal");
  }
  const nutri = nutritionIssues({
    kcal: draft.kcal ?? null,
    protein: draft.protein ?? null,
    fat: draft.fat ?? null,
    carbs: draft.carbs ?? null,
    servings: draft.servings ?? null,
    ingredientCount: lines.length,
  }).filter((i) => i.code !== "servings-missing" && i.code !== "kcal-missing");
  issues.push(...nutri);

  // Ostrzeżenia z samego rozbicia (gramy szacowane, porcje z AI, delta vs draft)
  for (const i of draft.nutrition?.issues ?? []) {
    if (!issues.some((x) => x.code === i.code && x.field === i.field)) issues.push(i);
  }

  return { issues, blocking: issues.some((i) => i.severity === "error") };
}
