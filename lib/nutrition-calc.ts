// Czyste funkcje liczące wartości odżywcze z jawnego rozbicia składników na
// gramy i tabelę per 100 g. Działają po stronie serwera (worker, API) i w
// przeglądarce (podgląd draftu: "Przelicz" bez wołania modelu). Model AI
// dostarcza tylko dwie rzeczy, których kod nie zna: gramaturę składników
// bez podanej wagi i wartości per 100 g produktu. Resztę liczy ten plik.
import { INGREDIENTS, MEASURES, type MeasureKey } from "./measures";
import { parseQuantity, parseShoppingLine } from "./quantity";
import { nutritionIssues, type QcIssue } from "./recipe-qc";

export type Macro = { kcal: number; protein: number; fat: number; carbs: number };

export type GramsSource = "stated" | "measure-table" | "ai-estimate" | "operator";

export type NutritionItem = {
  // oryginalna linia składnika z przepisu
  line: string;
  // nazwa produktu w mianowniku (od modelu lub z tabeli miar)
  name: string;
  grams: number | null;
  gramsSource: GramsSource;
  // np. "1 średnie jabłko ≈ 150 g", "szklanka = 250 ml"
  assumption?: string | null;
  per100: Macro | null;
  // woda, sól, pieprz, zioła - nie wchodzą do sumy
  excluded?: boolean;
};

export type ServingsSource = "caption" | "transcript" | "ai-estimate" | "operator" | "draft";

export type NutritionBreakdown = {
  items: NutritionItem[];
  servings: number | null;
  servingsSource: ServingsSource;
  servingsReason?: string | null;
  // niezależna ocena modelu, zachowana nawet gdy porcje pochodzą z materiału
  servingsEstimate?: number | null;
  totals: Macro;
  perServing: Macro | null;
  issues: QcIssue[];
  model: string;
  computedAt: string;
  // wartości z etapu draftu (do porównania w panelu), gdy były
  draftPerServing?: Partial<Macro> | null;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

export const EMPTY_MACRO: Macro = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

// --- Gramy z tabeli miar (lib/measures.ts) ------------------------------------

const MEASURE_WORDS: Record<string, MeasureKey> = {};
for (const key of Object.keys(MEASURES) as MeasureKey[]) {
  for (const form of MEASURES[key].forms) MEASURE_WORDS[form] = key;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[„”"',;:.!]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Dopasowanie składnika z tabeli po dopełniaczu ("mąki pszennej") lub
// mianowniku. Tylko pełne dopasowanie od początku frazy - "mąki" samo w sobie
// jest wieloznaczne (pszenna? żytnia?) i wtedy oddajemy pole modelowi.
function matchIngredient(namePart: string) {
  const n = normalizeName(namePart);
  if (!n) return null;
  let best: (typeof INGREDIENTS)[number] | null = null;
  for (const ing of INGREDIENTS) {
    const gen = normalizeName(ing.nameGen);
    const nom = normalizeName(ing.name);
    const hit = (cand: string) => n === cand || n.startsWith(cand + " ");
    if (hit(gen) || hit(nom)) {
      // dłuższe dopasowanie wygrywa ("mąki pszennej pełnoziarnistej" vs "mąki pszennej")
      if (!best || gen.length > normalizeName(best.nameGen).length) best = ing;
    }
  }
  return best;
}

export type MeasureGrams = {
  grams: number;
  source: "stated" | "measure-table";
  name: string;
  assumption: string | null;
};

// "pół szklanki mąki pszennej" -> 80 g (tabela miar); "200 g twarogu" -> 200 g
// (podane); "jabłko" -> null (model musi oszacować).
export function gramsFromMeasure(line: string): MeasureGrams | null {
  const t = line.trim();
  if (!t) return null;

  const shop = parseShoppingLine(t);
  if (shop.kind === "weight" && shop.qty != null) {
    return { grams: Math.round(shop.base * 10) / 10, source: "stated", name: shop.name || t, assumption: null };
  }
  if (shop.kind === "volume" && shop.qty != null) {
    // mleko, woda, jogurt ≈ 1 g/ml; olej 0,92 - różnica w granicach błędu szacunku
    return {
      grams: Math.round(shop.base * 10) / 10,
      source: "stated",
      name: shop.name || t,
      assumption: "1 ml ≈ 1 g",
    };
  }

  // "2 łyżki oleju" / "pół szklanki mąki" / "łyżka miodu" (domyślnie 1)
  let qty = 1;
  let rest = t;
  const q = parseQuantity(t);
  if (q) {
    qty = q.value;
    rest = q.rest.trim();
  }
  const m = rest.match(/^(\p{L}+)\s*(.*)$/u);
  if (!m) return null;
  const measure = MEASURE_WORDS[m[1].toLowerCase()];
  if (!measure) return null;
  const ing = matchIngredient(m[2]);
  if (!ing) return null;
  const per = ing.grams[measure];
  if (per == null) return null;
  const grams = Math.round(qty * per * 10) / 10;
  return {
    grams,
    source: "measure-table",
    name: ing.name.replace(/\s*\([^)]*\)/, ""),
    assumption: `${MEASURES[measure].label} ${ing.nameGen} = ${per} g`,
  };
}

// --- Arytmetyka -----------------------------------------------------------------

export function itemMacro(item: NutritionItem): Macro | null {
  if (item.excluded || item.grams == null || !item.per100) return null;
  const f = item.grams / 100;
  return {
    kcal: item.per100.kcal * f,
    protein: item.per100.protein * f,
    fat: item.per100.fat * f,
    carbs: item.per100.carbs * f,
  };
}

export function computeTotals(items: NutritionItem[]): Macro {
  const t = { ...EMPTY_MACRO };
  for (const it of items) {
    const m = itemMacro(it);
    if (!m) continue;
    t.kcal += m.kcal;
    t.protein += m.protein;
    t.fat += m.fat;
    t.carbs += m.carbs;
  }
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), fat: round1(t.fat), carbs: round1(t.carbs) };
}

export function perServing(totals: Macro, servings: number | null): Macro | null {
  if (!servings || servings <= 0) return null;
  return {
    kcal: Math.round(totals.kcal / servings),
    protein: round1(totals.protein / servings),
    fat: round1(totals.fat / servings),
    carbs: round1(totals.carbs / servings),
  };
}

// Atwater 4/9/4: ile kcal wynika z makr i o ile odbiega od podanych
export function atwaterCheck(m: Macro): { fromMacros: number; drift: number } {
  const fromMacros = Math.round(m.protein * 4 + m.fat * 9 + m.carbs * 4);
  const drift = m.kcal > 0 ? Math.abs(fromMacros - m.kcal) / m.kcal : 0;
  return { fromMacros, drift };
}

// Lista problemów dla rozbicia: brakujące gramy / tabele, porcje, zakresy
// per porcję (te same reguły co QC opublikowanych przepisów).
export function breakdownIssues(b: Pick<NutritionBreakdown, "items" | "servings" | "perServing" | "servingsSource">): QcIssue[] {
  const issues: QcIssue[] = [];
  const active = b.items.filter((i) => !i.excluded);
  const noGrams = active.filter((i) => i.grams == null);
  const noTable = active.filter((i) => i.grams != null && !i.per100);
  if (active.length === 0) {
    issues.push({ severity: "error", code: "nutrition-empty", message: "Brak składników do policzenia wartości odżywczych.", field: "ingredients" });
  }
  if (noGrams.length) {
    const ratio = noGrams.length / Math.max(1, active.length);
    issues.push({
      severity: ratio > 0.3 ? "error" : "warning",
      code: "grams-missing",
      message: `Brak gramatury dla: ${noGrams.map((i) => i.line).join("; ")}. Wpisz gramy ręcznie albo przelicz z AI.`,
      field: "ingredients",
    });
  }
  if (noTable.length) {
    issues.push({
      severity: "warning",
      code: "per100-missing",
      message: `Brak wartości per 100 g dla: ${noTable.map((i) => i.name || i.line).join("; ")}.`,
      field: "ingredients",
    });
  }
  const estimated = active.filter((i) => i.gramsSource === "ai-estimate");
  if (estimated.length >= 3 && estimated.length / Math.max(1, active.length) > 0.5) {
    issues.push({
      severity: "warning",
      code: "grams-mostly-estimated",
      message: `Większość gramatur (${estimated.length} z ${active.length}) to szacunki AI, nie ilości z materiału. Sprawdź kluczowe składniki.`,
      field: "ingredients",
    });
  }
  if (b.servings == null || b.servings <= 0) {
    issues.push({ severity: "error", code: "servings-missing", message: "Brak liczby porcji. Bez niej nie ma kcal na porcję.", field: "servings" });
  } else if (b.servingsSource === "ai-estimate") {
    issues.push({ severity: "warning", code: "servings-estimated", message: `Liczba porcji (${b.servings}) to ocena AI, w materiale nie było jej podanej.`, field: "servings" });
  }
  if (b.perServing) {
    const qc = nutritionIssues({
      kcal: b.perServing.kcal,
      protein: b.perServing.protein,
      fat: b.perServing.fat,
      carbs: b.perServing.carbs,
      servings: b.servings,
      ingredientCount: active.length,
    }).filter((i) => i.code !== "servings-missing" && i.code !== "kcal-missing");
    issues.push(...qc);
  } else if (active.length > 0 && b.servings) {
    issues.push({ severity: "error", code: "kcal-missing", message: "Nie policzono kcal na porcję.", field: "kcal" });
  }
  return issues;
}

// Przelicza całe rozbicie po zmianie gramów / porcji (bez modelu).
export function recompute(
  b: NutritionBreakdown,
  patch: { items?: NutritionItem[]; servings?: number | null; servingsSource?: ServingsSource }
): NutritionBreakdown {
  const items = patch.items ?? b.items;
  const servings = patch.servings !== undefined ? patch.servings : b.servings;
  const servingsSource = patch.servingsSource ?? b.servingsSource;
  const totals = computeTotals(items);
  const ps = perServing(totals, servings);
  const next = { ...b, items, servings, servingsSource, totals, perServing: ps, computedAt: new Date().toISOString() };
  return { ...next, issues: breakdownIssues(next) };
}

export function hasBlockingIssue(issues: QcIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
