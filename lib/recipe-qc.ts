// Recipe data quality checks. Pure functions, no I/O — the admin QC page and
// the `qc:recipes` CLI both feed recipes through checkRecipe() and render the
// issues it returns. The trigger for this was a recipe showing 2700 kcal per
// serving (kcal entered for the whole cake, not per portion); these rules catch
// that class of mistake before it reaches users and structured data.

export type QcInput = {
  id: number;
  title: string;
  uri: string;
  status: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  servings: number | null;
  totalTimeMin: number | null;
  heroImage: string | null;
  ingredientCount: number;
  stepCount: number;
  // legacy WP recipes render instructions from HTML instead of the structured
  // steps/ingredients tables — missing structure is then a warning, not an error
  hasContentHtml: boolean;
};

export type QcSeverity = "error" | "warning";
export type QcIssue = { severity: QcSeverity; code: string; message: string };

// Plausible per-serving bounds. Deliberately wide — we only want to catch clear
// data-entry mistakes, not police unusual-but-real recipes.
const KCAL_MIN = 30;
const KCAL_HARD_MAX = 1500; // above this per serving is almost always a mistake
const KCAL_SOFT_MAX = 1000; // possible for a big main, but worth a glance
const PROTEIN_MAX = 120;
const FAT_MAX = 150;
const CARBS_MAX = 250;
// How far the Atwater estimate may drift from the stated kcal before we flag it.
const MACRO_TOLERANCE = 0.3;

function n(v: number | null): number | null {
  return v == null || Number.isNaN(Number(v)) ? null : Number(v);
}

export function checkRecipe(r: QcInput): QcIssue[] {
  const issues: QcIssue[] = [];
  const add = (severity: QcSeverity, code: string, message: string) =>
    issues.push({ severity, code, message });

  const kcal = n(r.kcal);
  const protein = n(r.protein);
  const fat = n(r.fat);
  const carbs = n(r.carbs);

  // --- Kalorie na porcję ---
  if (kcal == null) {
    add("warning", "kcal-missing", "Brak kaloryczności.");
  } else if (kcal <= 0) {
    add("error", "kcal-invalid", `Kaloryczność ≤ 0 (${kcal}).`);
  } else if (kcal > KCAL_HARD_MAX) {
    add(
      "error",
      "kcal-too-high",
      `Nieprawdopodobna kaloryczność na porcję: ${kcal} kcal. Sprawdź, czy to nie wartość dla całości (podziel przez liczbę porcji).`
    );
  } else if (kcal > KCAL_SOFT_MAX) {
    // Wysokie kcal + 1 porcja + dużo składników = to prawie na pewno cały
    // przepis policzony jako jedna porcja. Osobny, akcyjny komunikat (auto-fix z AI).
    if ((r.servings == null || r.servings <= 1) && r.ingredientCount >= 5) {
      add(
        "warning",
        "servings-suspicious",
        `Podejrzana liczba porcji: ${kcal} kcal przy ${r.servings ?? "—"} porcji i ${r.ingredientCount} składnikach — to prawdopodobnie kilka porcji. Użyj „Porcje z AI”.`
      );
    } else {
      add("warning", "kcal-high", `Wysoka kaloryczność na porcję: ${kcal} kcal — do weryfikacji.`);
    }
  } else if (kcal < KCAL_MIN) {
    add("warning", "kcal-low", `Bardzo niska kaloryczność na porcję: ${kcal} kcal — do weryfikacji.`);
  }

  // --- Makra: wartości skrajne / ujemne ---
  const macroChecks: [number | null, string, number, string][] = [
    [protein, "białka", PROTEIN_MAX, "protein"],
    [fat, "tłuszczu", FAT_MAX, "fat"],
    [carbs, "węglowodanów", CARBS_MAX, "carbs"],
  ];
  for (const [val, label, max, code] of macroChecks) {
    if (val == null) continue;
    if (val < 0) add("error", `${code}-negative`, `Ujemna wartość ${label}: ${val} g.`);
    else if (val > max) add("warning", `${code}-too-high`, `Nieprawdopodobna ilość ${label} na porcję: ${val} g.`);
  }
  if (protein == null && fat == null && carbs == null) {
    add("warning", "macros-missing", "Brak makroskładników (białko/tłuszcze/węgle).");
  }

  // --- Spójność makr z kcal (Atwater: 4/9/4 kcal/g) ---
  if (kcal != null && kcal > 0 && protein != null && fat != null && carbs != null) {
    const fromMacros = Math.round(protein * 4 + fat * 9 + carbs * 4);
    const drift = Math.abs(fromMacros - kcal) / kcal;
    if (drift > MACRO_TOLERANCE) {
      add(
        "warning",
        "macro-mismatch",
        `Makra nie zgadzają się z kaloriami: z białka/tłuszczu/węgli wychodzi ~${fromMacros} kcal, a podano ${kcal} kcal (różnica ${Math.round(drift * 100)}%).`
      );
    }
  }

  // --- Porcje ---
  if (r.servings == null || r.servings <= 0) {
    add("warning", "servings-missing", "Brak liczby porcji — bez niej nie da się przeliczyć makr ani skalować przepisu.");
  }

  // --- Kompletność treści ---
  // Bez struktury, ale z treścią HTML (stary WP) = renderuje się, lecz traci
  // dane strukturalne (schema, tryb gotowania, skalowanie) → ostrzeżenie.
  if (r.ingredientCount === 0) {
    if (r.hasContentHtml)
      add("warning", "no-ingredients-structured", "Brak składników w strukturze (są w starej treści HTML) — brak listy do schema i skalowania.");
    else add("error", "no-ingredients", "Przepis bez składników.");
  }
  if (r.stepCount === 0) {
    if (r.hasContentHtml)
      add("warning", "no-steps-structured", "Brak kroków w strukturze (renderowane ze starej treści HTML) — brak HowToStep i trybu gotowania.");
    else add("error", "no-steps", "Przepis bez kroków przygotowania.");
  }
  if (!r.heroImage) add("warning", "image-missing", "Brak zdjęcia — wymagane dla wyniku Recipe w Google.");
  if (r.totalTimeMin == null) add("warning", "time-missing", "Brak czasu przygotowania.");

  return issues;
}

export function hasError(issues: QcIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
