// "Popraw wg instrukcji": operator pisze wolnym tekstem, co jest nie tak
// (np. "brakuje kroku: na wierzch kawałek Kinder Bueno"), a model zwraca
// KOMPLETNY zestaw operacji na przepisie (lib/recipe-ops): krok, składnik
// z ilością, ewentualnie lead/opis. Każda operacja ma powód i rodzaj:
// wprost z instrukcji albo jej konsekwencja. Nic tu nie jest zapisywane;
// podgląd i zatwierdzenie są po stronie operatora, kalorie liczy kod później.
import { chatJson } from "./ai-chat";
import { defaultAiModels } from "./ai-models";
import { applyOps, MAX_OPS, readPath, type RecipeChange, type RecipeText } from "../recipe-ops";

const SYSTEM =
  "Jesteś redaktorką przepisów na blogu dietanaluzie.pl. Dostajesz przepis (JSON) i instrukcję operatora, co w nim poprawić. " +
  "Zwracasz listę OPERACJI na przepisie, które realizują instrukcję KOMPLETNIE i SPÓJNIE we wszystkich polach, których dotyczy. " +
  "KASKADA (obowiązkowa): nowy krok z produktem → produkt musi być też w składnikach z realistyczną ilością (np. '1 batonik Kinder Bueno (ok. 43 g)'); " +
  "nowy składnik → krok, który go używa; usunięty składnik → kroki bez niego; zmieniona ilość → kroki zgodne; " +
  "lead lub opis ('about') zmieniasz tylko, gdy po poprawce przestają być prawdziwe albo instrukcja ich dotyczy; " +
  "tytuł tylko na wyraźne życzenie; liczbę porcji tylko, gdy instrukcja o tym mówi. " +
  "Nie przepisuj stylu, nie skracaj, nie dodawaj niczego poza tym, co wynika z instrukcji. Ilości po polsku ('2 łyżki', '150 g'). " +
  "Nie podawaj wartości odżywczych, kod przeliczy je sam. Nigdy nie używaj długiego myślnika ani półpauzy. " +
  "OPERACJE: {op:'set', path, value} dla: title, lead, about, servings, prepTimeMin, totalTimeMin, difficulty, " +
  "ingredientGroups[g].title, ingredientGroups[g].items[i], steps[n].body, steps[n].title, steps[n].tip; " +
  "{op:'add', path:'ingredientGroups[g].items', index, value: string} | {op:'add', path:'steps', index, value:{title,body,tip}} | " +
  "{op:'add', path:'ingredientGroups', index, value:{title, items:[]}}; {op:'remove', path:'ingredientGroups[g].items[i]' | 'steps[n]'}. " +
  "Indeksy liczone od 0 i odnoszą się do przepisu WEJŚCIOWEGO (nie przesuwaj ich po własnych add/remove); index w add to pozycja wstawienia, " +
  "większy niż długość listy = na koniec. Każda operacja ma reason (jedno zdanie) i kind: 'requested' (wprost z instrukcji) albo 'consequence' (wynika z niej). " +
  'Odpowiadasz WYŁĄCZNIE JSON-em: {"changes":[{"op","path","index"?,"value"?,"reason","kind"}],"note": string|null}. ' +
  "Gdy instrukcja jest niejasna albo sprzeczna z przepisem, zwróć changes: [] i wyjaśnij w note.";

export type InstructResult = {
  changes: RecipeChange[];
  rejected: { op: RecipeChange; why: string }[];
  note: string | null;
  model: string;
};

export async function instructRecipe(opts: {
  recipe: RecipeText;
  instruction: string;
  sourceContext?: { caption?: string | null; transcript?: string | null } | null;
  model?: string;
}): Promise<InstructResult> {
  const model = opts.model || defaultAiModels().refine;
  const instruction = opts.instruction.trim().slice(0, 1000);
  if (!instruction) throw new Error("Pusta instrukcja");

  const recipeForModel = {
    ...opts.recipe,
    // null = opis nieedytowalny (bogaty HTML z WP); model nie ma go ruszać
    about: opts.recipe.about ?? "(nieedytowalny w tym przepisie, nie zmieniaj)",
  };
  const ctx = opts.sourceContext;
  const ctxText = ctx
    ? `\n\nMATERIAŁ ŹRÓDŁOWY (pomocniczo):\nOpis posta: ${ctx.caption?.trim() || "(brak)"}\nTranskrypcja: ${ctx.transcript?.trim().slice(0, 3000) || "(brak)"}`
    : "";

  const { data } = await chatJson<{ changes?: any[]; note?: string | null }>({
    model,
    system: SYSTEM,
    user: `PRZEPIS (JSON):\n${JSON.stringify(recipeForModel)}\n\nINSTRUKCJA OPERATORA:\n${instruction}${ctxText}`,
    maxTokens: 6000,
  });

  const raw: RecipeChange[] = (Array.isArray(data.changes) ? data.changes : [])
    .slice(0, MAX_OPS)
    .filter((c) => c && typeof c.path === "string" && ["set", "add", "remove"].includes(c.op))
    .map((c) => ({
      op: c.op,
      path: c.path,
      ...(c.op === "add" ? { index: Number.isInteger(c.index) ? c.index : null } : {}),
      ...(c.op !== "remove" ? { value: c.value } : {}),
      reason: typeof c.reason === "string" ? c.reason : "",
      kind: c.kind === "consequence" ? "consequence" : "requested",
    }));

  // Walidacja na sucho: do podglądu idą tylko operacje, które przejdą, z `before`
  const dry = applyOps(opts.recipe, raw);
  const changes = dry.applied.map((c) => ({ ...c, before: c.before ?? readPath(opts.recipe, c.path) }));
  return { changes, rejected: dry.rejected, note: data.note ? String(data.note) : null, model };
}
