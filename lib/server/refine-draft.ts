// Dopełnianie braków w drafcie z TikToka. Uruchamiane, gdy model z wideo nie
// był pewny (confidence != high) albo audyt (lib/import-review) znalazł braki:
// składniki bez ilości, brak porcji, brak czasu, za mało kroków. Mocniejszy
// model dostaje draft + materiał źródłowy + listę braków i uzupełnia TYLKO to,
// czego brakuje; każdą wartość spoza materiału oznacza jako wywnioskowaną.
// Wynik: patch nałożony na draft + lista aiFilled do pokazania w panelu.
import { chatJson } from "./ai-chat";
import { defaultAiModels } from "./ai-models";
import type { AiFilled, ImportDraft } from "../import-draft";
import type { QcIssue } from "../recipe-qc";

const SYSTEM =
  "Jesteś redaktorką przepisów na blogu dietanaluzie.pl i dietetyczką. Dostajesz szkic przepisu odtworzony " +
  "z rolki TikTok, materiał źródłowy (opis posta, transkrypcja) oraz listę braków znalezionych przez audyt. " +
  "Twoje zadanie: uzupełnić szkic tak, aby czytelnik mógł go wykonać i aby dało się policzyć wartości odżywcze. " +
  "ZASADY: (1) Nie zmieniaj niczego, co jest zgodne z opisem posta; opis posta jest najważniejszym źródłem. " +
  "(2) Uzupełniaj tylko pola z listy braków albo oczywiście niekompletne (składnik bez ilości, brak porcji, brak czasu, " +
  "krok bez treści). (3) Dla ilości, których nie ma w materiale, podaj realistyczną wartość typową dla takiego dania " +
  "i oznacz ją basis='inferred'. Gdy wartość da się wyczytać z transkrypcji lub klatek, basis='transcript' / 'frames'; " +
  "z opisu posta: basis='caption'. (4) Nie dodawaj nowych składników, chyba że transkrypcja lub kroki wyraźnie ich używają " +
  "(wtedy basis='transcript' i reason cytuje fragment). (5) Ilości po polsku, jak w przepisach: '2 jajka', '150 g mąki', " +
  "'pół szklanki mleka'. (6) Liczbę porcji oceń z łącznej masy i typu dania; czas przygotowania z kroków. " +
  "(7) Nigdy nie używaj długiego myślnika ani półpauzy w tekstach. " +
  "Odpowiadasz WYŁĄCZNIE JSON-em: " +
  '{"patch": {"ingredientGroups"?: [{"title": string|null, "items": string[]}], "servings"?: int, "prepTimeMin"?: int, ' +
  '"totalTimeMin"?: int, "steps"?: [{"title": string|null, "body": string, "tip": string|null}], "difficulty"?: string}, ' +
  '"filled": [{"field": string, "value": any, "reason": string, "basis": "caption"|"transcript"|"frames"|"inferred"}]}. ' +
  "W patch podawaj pełne tablice (ingredientGroups, steps) tylko wtedy, gdy coś w nich zmieniasz; wtedy przepisz całość " +
  "z poprawkami. field w filled to ścieżka, np. 'servings', 'ingredientGroups[0].items[3]', 'steps[2].body'.";

export type RefineResult = {
  draft: ImportDraft;
  filled: AiFilled[];
  model: string;
};

type Patch = {
  ingredientGroups?: { title?: string | null; items?: unknown[] }[];
  servings?: unknown;
  prepTimeMin?: unknown;
  totalTimeMin?: unknown;
  steps?: { title?: string | null; body?: unknown; tip?: string | null }[];
  difficulty?: unknown;
};

const int = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export async function refineDraft(opts: {
  draft: ImportDraft;
  caption: string | null;
  transcript: string | null;
  issues: QcIssue[];
  model?: string;
}): Promise<RefineResult> {
  const model = opts.model || defaultAiModels().refine;
  const d = opts.draft;
  const slim = {
    title: d.title,
    ingredientGroups: d.ingredientGroups,
    steps: (d.steps ?? []).map((s) => ({ title: s.title, body: s.body, tip: s.tip })),
    servings: d.servings,
    prepTimeMin: d.prepTimeMin,
    totalTimeMin: d.totalTimeMin,
    difficulty: d.difficulty,
    confidence: d.confidence,
    notes: d.notes,
  };
  const { data } = await chatJson<{ patch?: Patch; filled?: AiFilled[] }>({
    model,
    system: SYSTEM,
    user:
      `SZKIC (JSON):\n${JSON.stringify(slim)}\n\n` +
      `OPIS POSTA:\n${opts.caption?.trim() || "(brak)"}\n\n` +
      `TRANSKRYPCJA:\n${opts.transcript?.trim() || "(brak)"}\n\n` +
      `BRAKI Z AUDYTU:\n${opts.issues.map((i) => `- [${i.severity}] ${i.message}`).join("\n") || "(brak)"}`,
    maxTokens: 6000,
  });

  const patch = data.patch ?? {};
  const next: ImportDraft = { ...d };

  if (Array.isArray(patch.ingredientGroups) && patch.ingredientGroups.length) {
    const groups = patch.ingredientGroups
      .map((g) => ({
        title: typeof g?.title === "string" && g.title.trim() ? g.title.trim() : null,
        items: (Array.isArray(g?.items) ? g.items : []).map((x) => String(x ?? "").trim()).filter(Boolean),
      }))
      .filter((g) => g.items.length);
    if (groups.length) next.ingredientGroups = groups;
  }
  if (Array.isArray(patch.steps) && patch.steps.length >= 2) {
    const steps = patch.steps
      .map((s, i) => ({
        ...(d.steps?.[i] ?? { image: null }),
        title: typeof s?.title === "string" && s.title.trim() ? s.title.trim() : null,
        body: String(s?.body ?? "").trim(),
        tip: typeof s?.tip === "string" && s.tip.trim() ? s.tip.trim() : null,
      }))
      .filter((s) => s.body);
    if (steps.length >= 2) next.steps = steps;
  }
  const servings = int(patch.servings);
  if (servings) next.servings = servings;
  const prep = int(patch.prepTimeMin);
  if (prep) next.prepTimeMin = prep;
  const total = int(patch.totalTimeMin);
  if (total) next.totalTimeMin = total;
  if (typeof patch.difficulty === "string" && ["latwy", "sredni", "trudny"].includes(patch.difficulty)) {
    next.difficulty = patch.difficulty;
  }

  const filled: AiFilled[] = (Array.isArray(data.filled) ? data.filled : [])
    .filter((f) => f && typeof f.field === "string" && typeof f.reason === "string")
    .map((f) => ({
      field: f.field,
      value: f.value,
      reason: f.reason,
      basis: (["caption", "transcript", "frames", "inferred"] as const).includes(f.basis) ? f.basis : "inferred",
    }));

  return { draft: next, filled, model };
}
