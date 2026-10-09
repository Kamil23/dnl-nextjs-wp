// Rozbicie listy składników na gramy i wartości per 100 g z pomocą modelu,
// a potem arytmetyka w kodzie (lib/nutrition-calc). Dwa wywołania:
//   1. strukturyzacja: nazwa produktu, gramy (tam, gdzie tabela miar nie
//      policzyła sama), założenie w jednym zdaniu, wykluczenia (woda, sól),
//      plus niezależna ocena liczby porcji;
//   2. tabela: kcal/białko/tłuszcz/węgle na 100 g dla każdej nazwy.
// Model nie dostaje prawa nadpisania gramów policzonych z tabeli miar ani
// ilości podanych wprost w gramach.
import { chatJson } from "./ai-chat";
import { defaultAiModels } from "./ai-models";
import {
  breakdownIssues,
  computeTotals,
  gramsFromMeasure,
  perServing,
  type Macro,
  type NutritionBreakdown,
  type NutritionItem,
  type ServingsSource,
} from "../nutrition-calc";

export type BuildBreakdownOptions = {
  title: string;
  lines: string[];
  // porcje znane z materiału (opis/transkrypcja/operator); null = oceni model
  servings: number | null;
  servingsSource?: ServingsSource;
  // kontekst dla modelu (opis posta, typ dania), opcjonalnie
  context?: string | null;
  model?: string;
  // wartości z etapu draftu do zapisania obok (do porównania w panelu)
  draftPerServing?: Partial<Macro> | null;
};

const STRUCTURE_SYSTEM =
  "Jesteś dietetykiem klinicznym i technologiem żywności. Dostajesz listę składników polskiego przepisu, " +
  "każdy w osobnej linii z numerem. Dla KAŻDEJ linii zwracasz obiekt: " +
  "{i: numer, name: nazwa produktu w mianowniku po polsku (np. 'mąka pszenna', 'jajko kurze', 'pierś z kurczaka'), " +
  "grams: masa jadalna użyta w przepisie w gramach (liczba) albo null gdy naprawdę nie da się ocenić, " +
  "assumption: jedno krótkie zdanie z założeniem (np. '1 średnie jabłko ≈ 150 g', 'łyżka oleju = 14 g', 'puszka 400 g po odsączeniu 240 g'), " +
  "excluded: true tylko dla wody, soli, pieprzu, suszonych ziół i przypraw bez znaczących kalorii}. " +
  "Gdy w linii podano już grams (pole known), przepisz tę wartość bez zmian i podaj assumption 'ilość z przepisu'. " +
  "Ilości typu 'szczypta', 'do smaku', 'opcjonalnie' szacuj realistycznie (szczypta = 0,5 g). " +
  "Dla produktów gotowanych podanych na sucho (ryż, makaron, kasza) licz masę SUCHĄ, jak w przepisie. " +
  "Nie dodawaj składników, których nie ma na liście. " +
  "Oceń też liczbę porcji NIEZALEŻNIE od autora: servingsEstimate (liczba całkowita) na podstawie łącznej masy i typu " +
  "dania (obiad 350-500 g na porcję, ciasto 8-12 kawałków, deser w szklance 1-2, zupa 400 ml) oraz servingsReason (jedno zdanie). " +
  'Odpowiadasz WYŁĄCZNIE JSON-em: {"items":[...], "servingsEstimate": int, "servingsReason": string}.';

const TABLE_SYSTEM =
  "Jesteś dietetykiem z dostępem do tabel wartości odżywczych (IŻŻ, USDA). Dla każdej nazwy produktu podaj " +
  "wartości na 100 g produktu w takiej postaci, w jakiej jest w przepisie (surowy, chyba że nazwa mówi inaczej): " +
  "kcal (liczba całkowita), protein, fat, carbs (gramy, 1 miejsce po przecinku). Węglowodany jako przyswajalne (bez błonnika), " +
  "jak w polskich tabelach. Dla produktów markowych (np. serek wiejski, skyr, jogurt grecki 0%) użyj typowych wartości dla polskiego rynku. " +
  'Odpowiadasz WYŁĄCZNIE JSON-em: {"items":[{"i": numer, "kcal": int, "protein": number, "fat": number, "carbs": number}]}.';

type StructItem = { i: number; name?: string; grams?: number | null; assumption?: string | null; excluded?: boolean };
type TableItem = { i: number; kcal?: number; protein?: number; fat?: number; carbs?: number };

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function buildBreakdown(opts: BuildBreakdownOptions): Promise<NutritionBreakdown> {
  const model = opts.model || defaultAiModels().nutrition;
  const lines = opts.lines.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("Brak składników do policzenia");

  // Co wiemy bez modelu: gramy podane wprost i z tabeli miar
  const known = lines.map((line) => gramsFromMeasure(line));

  // --- 1. strukturyzacja ---
  const structInput = lines
    .map((line, i) => {
      const k = known[i];
      return `${i + 1}. ${line}${k ? `  [known grams: ${k.grams}]` : ""}`;
    })
    .join("\n");
  const ctx = opts.context ? `\nKontekst: ${opts.context.slice(0, 600)}` : "";
  const struct = await chatJson<{ items?: StructItem[]; servingsEstimate?: number; servingsReason?: string }>({
    model,
    system: STRUCTURE_SYSTEM,
    user:
      `Przepis: ${opts.title}${ctx}\n` +
      `Liczba porcji podana w materiale: ${opts.servings ?? "brak"}\n` +
      `Składniki:\n${structInput}`,
    maxTokens: 4000,
  });
  const byIndex = new Map<number, StructItem>();
  for (const it of struct.data.items ?? []) {
    const i = Number(it?.i);
    if (Number.isInteger(i) && i >= 1 && i <= lines.length) byIndex.set(i, it);
  }

  const items: NutritionItem[] = lines.map((line, idx) => {
    const k = known[idx];
    const s = byIndex.get(idx + 1);
    const name = (s?.name && String(s.name).trim()) || k?.name || line;
    if (k) {
      return {
        line,
        name,
        grams: k.grams,
        gramsSource: k.source,
        assumption: k.assumption,
        per100: null,
        excluded: !!s?.excluded,
      };
    }
    const g = num(s?.grams);
    return {
      line,
      name,
      grams: g != null && g >= 0 ? Math.round(g * 10) / 10 : null,
      gramsSource: "ai-estimate",
      assumption: s?.assumption ? String(s.assumption) : null,
      per100: null,
      excluded: !!s?.excluded,
    };
  });

  // --- 2. tabela per 100 g (tylko dla składników liczonych) ---
  const need = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.excluded && it.grams != null);
  if (need.length) {
    const table = await chatJson<{ items?: TableItem[] }>({
      model,
      system: TABLE_SYSTEM,
      user: need.map(({ it, i }) => `${i + 1}. ${it.name}`).join("\n"),
      maxTokens: 3000,
    });
    for (const t of table.data.items ?? []) {
      const i = Number(t?.i) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
      const kcal = num(t.kcal);
      const protein = num(t.protein);
      const fat = num(t.fat);
      const carbs = num(t.carbs);
      if (kcal == null || protein == null || fat == null || carbs == null) continue;
      if (kcal < 0 || kcal > 950 || protein < 0 || fat < 0 || carbs < 0) continue;
      items[i].per100 = { kcal: Math.round(kcal), protein, fat, carbs };
    }
  }

  const servingsEstimate = (() => {
    const n = num(struct.data.servingsEstimate);
    return n != null && n > 0 ? Math.round(n) : null;
  })();
  const servings = opts.servings && opts.servings > 0 ? Math.round(opts.servings) : servingsEstimate;
  const servingsSource: ServingsSource =
    opts.servings && opts.servings > 0 ? opts.servingsSource ?? "draft" : "ai-estimate";

  const totals = computeTotals(items);
  const ps = perServing(totals, servings);
  const base = {
    items,
    servings,
    servingsSource,
    servingsReason: struct.data.servingsReason ? String(struct.data.servingsReason) : null,
    servingsEstimate,
    totals,
    perServing: ps,
    model,
    computedAt: new Date().toISOString(),
    draftPerServing: opts.draftPerServing ?? null,
  };
  const issues = breakdownIssues(base);

  // Różnica względem tego, co model z wideo podał "na oko"
  const d = opts.draftPerServing;
  if (ps && d?.kcal != null && d.kcal > 0) {
    const delta = Math.abs(ps.kcal - d.kcal) / d.kcal;
    if (delta > 0.25) {
      issues.push({
        severity: "warning",
        code: "draft-delta",
        message: `Model z wideo podał ${d.kcal} kcal/porcję, przeliczenie ze składników daje ${ps.kcal} kcal (różnica ${Math.round(delta * 100)}%).`,
        field: "kcal",
      });
    }
  }

  return { ...base, issues };
}
