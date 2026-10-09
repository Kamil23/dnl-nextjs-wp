// Operacje na tekstowej warstwie przepisu, wspólne dla podglądu importu i
// edytora: model zwraca listę operacji (set / add / remove z powodem), kod je
// waliduje i nakłada. Czysty moduł (działa też w przeglądarce), z testami.

export type RecipeText = {
  title: string;
  lead: string;
  about: string | null;
  ingredientGroups: { title: string | null; items: string[] }[];
  steps: { title: string | null; body: string; tip: string | null }[];
  servings: number | null;
  prepTimeMin: number | null;
  totalTimeMin: number | null;
  difficulty: string | null;
};

export type RecipeOp =
  | { op: "set"; path: string; value: unknown }
  | { op: "add"; path: string; index?: number | null; value: unknown }
  | { op: "remove"; path: string };

export type ChangeKind = "requested" | "consequence";

export type RecipeChange = RecipeOp & {
  reason: string;
  kind: ChangeKind;
  before?: unknown;
};

export type ApplyResult = {
  recipe: RecipeText;
  applied: RecipeChange[];
  rejected: { op: RecipeChange; why: string }[];
};

const SCALAR_TEXT = new Set(["title", "lead", "about"]);
const SCALAR_INT = new Set(["servings", "prepTimeMin", "totalTimeMin"]);
const MIN_STEPS = 2;
export const MAX_OPS = 40;

type Parsed =
  | { kind: "scalar"; field: string }
  | { kind: "groupTitle"; g: number }
  | { kind: "item"; g: number; i: number }
  | { kind: "items"; g: number }
  | { kind: "groups" }
  | { kind: "stepField"; n: number; key: "body" | "title" | "tip" }
  | { kind: "step"; n: number }
  | { kind: "steps" };

export function parseOpPath(path: string): Parsed | null {
  if (SCALAR_TEXT.has(path) || SCALAR_INT.has(path) || path === "difficulty") return { kind: "scalar", field: path };
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^ingredientGroups\[(\d+)\]\.title$/))) return { kind: "groupTitle", g: +m[1] };
  if ((m = path.match(/^ingredientGroups\[(\d+)\]\.items\[(\d+)\]$/))) return { kind: "item", g: +m[1], i: +m[2] };
  if ((m = path.match(/^ingredientGroups\[(\d+)\]\.items$/))) return { kind: "items", g: +m[1] };
  if (path === "ingredientGroups") return { kind: "groups" };
  if ((m = path.match(/^steps\[(\d+)\]\.(body|title|tip)$/))) return { kind: "stepField", n: +m[1], key: m[2] as any };
  if ((m = path.match(/^steps\[(\d+)\]$/))) return { kind: "step", n: +m[1] };
  if (path === "steps") return { kind: "steps" };
  return null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const int = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export function cloneRecipe(r: RecipeText): RecipeText {
  return {
    ...r,
    ingredientGroups: r.ingredientGroups.map((g) => ({ title: g.title, items: [...g.items] })),
    steps: r.steps.map((s) => ({ ...s })),
  };
}

// Aktualna wartość pod ścieżką (do pola `before` w podglądzie zmian)
export function readPath(r: RecipeText, path: string): unknown {
  const p = parseOpPath(path);
  if (!p) return undefined;
  switch (p.kind) {
    case "scalar":
      return (r as any)[p.field];
    case "groupTitle":
      return r.ingredientGroups[p.g]?.title;
    case "item":
      return r.ingredientGroups[p.g]?.items[p.i];
    case "stepField":
      return r.steps[p.n]?.[p.key];
    case "step":
      return r.steps[p.n];
    default:
      return undefined;
  }
}

// Nakłada operacje w bezpiecznej kolejności: najpierw set, potem add (rosnąco
// po indeksie), na końcu remove od największych indeksów, żeby wcześniejsze
// operacje nie przesuwały numeracji późniejszych. Indeksy w operacjach
// odnoszą się do stanu WEJŚCIOWEGO.
export function applyOps(input: RecipeText, ops: RecipeChange[]): ApplyResult {
  const r = cloneRecipe(input);
  const applied: RecipeChange[] = [];
  const rejected: ApplyResult["rejected"] = [];
  const reject = (op: RecipeChange, why: string) => rejected.push({ op, why });

  const valid = ops.slice(0, MAX_OPS).map((op) => ({ op, p: parseOpPath(op.path) }));
  for (const { op, p } of valid) if (!p) reject(op, `nieznana ścieżka ${op.path}`);

  // --- set ---
  for (const { op, p } of valid) {
    if (!p || op.op !== "set") continue;
    const before = readPath(input, op.path);
    const rec = (): RecipeChange => ({ ...op, before });
    switch (p.kind) {
      case "scalar": {
        if (p.field === "title" && op.kind !== "requested") {
          reject(op, "tytuł można zmienić tylko na wyraźne życzenie");
          break;
        }
        if (SCALAR_TEXT.has(p.field)) {
          const v = str(op.value);
          if (p.field !== "about" && !v) {
            reject(op, "pusta wartość");
            break;
          }
          if (p.field === "about" && input.about == null) {
            reject(op, "opis tego przepisu nie jest edytowalny tekstowo");
            break;
          }
          (r as any)[p.field] = p.field === "about" && !v ? null : v;
        } else if (SCALAR_INT.has(p.field)) {
          const n = int(op.value);
          if (n == null) {
            reject(op, "niepoprawna liczba");
            break;
          }
          (r as any)[p.field] = n;
        } else {
          const v = str(op.value);
          if (v && !["latwy", "sredni", "trudny"].includes(v)) {
            reject(op, "trudność: latwy | sredni | trudny");
            break;
          }
          r.difficulty = v || null;
        }
        applied.push(rec());
        break;
      }
      case "groupTitle": {
        if (!r.ingredientGroups[p.g]) {
          reject(op, "nie ma takiej grupy");
          break;
        }
        r.ingredientGroups[p.g].title = str(op.value) || null;
        applied.push(rec());
        break;
      }
      case "item": {
        const v = str(op.value);
        if (!r.ingredientGroups[p.g]?.items[p.i] === undefined || r.ingredientGroups[p.g]?.items[p.i] === undefined) {
          reject(op, "nie ma takiego składnika");
          break;
        }
        if (!v) {
          reject(op, "pusty składnik (użyj remove)");
          break;
        }
        r.ingredientGroups[p.g].items[p.i] = v;
        applied.push(rec());
        break;
      }
      case "stepField": {
        if (!r.steps[p.n]) {
          reject(op, "nie ma takiego kroku");
          break;
        }
        const v = str(op.value);
        if (p.key === "body" && !v) {
          reject(op, "pusta treść kroku (użyj remove)");
          break;
        }
        r.steps[p.n][p.key] = v || null;
        applied.push(rec());
        break;
      }
      default:
        reject(op, "set nie działa na tej ścieżce");
    }
  }

  // --- add (po indeksie rosnąco; indeks poza zakresem = na koniec) ---
  const adds = valid
    .filter(({ op, p }) => p && op.op === "add")
    .sort((a, b) => ((a.op as any).index ?? 1e9) - ((b.op as any).index ?? 1e9));
  // przesunięcie wynikające z wcześniejszych add do tej samej listy
  const addedCount = new Map<string, number>();
  for (const { op, p } of adds) {
    if (!p || op.op !== "add") continue;
    const want = Number.isInteger(op.index) ? (op.index as number) : null;
    const shift = addedCount.get(op.path) ?? 0;
    switch (p.kind) {
      case "items": {
        const g = r.ingredientGroups[p.g];
        if (!g) {
          reject(op, "nie ma takiej grupy");
          break;
        }
        const v = str(op.value);
        if (!v) {
          reject(op, "pusty składnik");
          break;
        }
        const at = want == null || want < 0 || want > input.ingredientGroups[p.g].items.length ? g.items.length : want + shift;
        g.items.splice(at, 0, v);
        addedCount.set(op.path, shift + 1);
        applied.push({ ...op, value: v });
        break;
      }
      case "groups": {
        const val = (op.value ?? {}) as { title?: unknown; items?: unknown };
        const items = (Array.isArray(val.items) ? val.items : []).map(str).filter(Boolean);
        if (!items.length) {
          reject(op, "grupa bez składników");
          break;
        }
        const grp = { title: str(val.title) || null, items };
        const at = want == null || want < 0 || want > input.ingredientGroups.length ? r.ingredientGroups.length : want + shift;
        r.ingredientGroups.splice(at, 0, grp);
        addedCount.set(op.path, shift + 1);
        applied.push({ ...op, value: grp });
        break;
      }
      case "steps": {
        const val = (op.value ?? {}) as { title?: unknown; body?: unknown; tip?: unknown };
        const body = str(val.body);
        if (!body) {
          reject(op, "krok bez treści");
          break;
        }
        const step = { title: str(val.title) || null, body, tip: str(val.tip) || null };
        const at = want == null || want < 0 || want > input.steps.length ? r.steps.length : want + shift;
        r.steps.splice(at, 0, step);
        addedCount.set(op.path, shift + 1);
        applied.push({ ...op, value: step });
        break;
      }
      default:
        reject(op, "add nie działa na tej ścieżce");
    }
  }

  // --- remove (od końca; indeksy wejściowe + przesunięcie po add) ---
  const removes = valid.filter(({ op, p }) => p && op.op === "remove");
  const shiftedIndex = (listPath: string, idx: number) => {
    // ile elementów dodano PRZED tym indeksem w tej liście
    let shift = 0;
    for (const { op, p } of adds) {
      if (!p || op.op !== "add" || op.path !== listPath) continue;
      const w = Number.isInteger(op.index) ? (op.index as number) : 1e9;
      if (w <= idx) shift++;
    }
    return idx + shift;
  };
  const removeItems = removes
    .filter(({ p }) => p!.kind === "item")
    .sort((a, b) => (b.p as any).i - (a.p as any).i);
  for (const { op, p } of removeItems) {
    if (!p || p.kind !== "item") continue;
    const g = r.ingredientGroups[p.g];
    const before = input.ingredientGroups[p.g]?.items[p.i];
    if (!g || before === undefined) {
      reject(op, "nie ma takiego składnika");
      continue;
    }
    g.items.splice(shiftedIndex(`ingredientGroups[${p.g}].items`, p.i), 1);
    applied.push({ ...op, before });
  }
  r.ingredientGroups = r.ingredientGroups.filter((g) => g.items.length > 0);

  const removeSteps = removes
    .filter(({ p }) => p!.kind === "step")
    .sort((a, b) => (b.p as any).n - (a.p as any).n);
  for (const { op, p } of removeSteps) {
    if (!p || p.kind !== "step") continue;
    const before = input.steps[p.n];
    if (!before) {
      reject(op, "nie ma takiego kroku");
      continue;
    }
    if (r.steps.length <= MIN_STEPS) {
      reject(op, `przepis musi mieć co najmniej ${MIN_STEPS} kroki`);
      continue;
    }
    r.steps.splice(shiftedIndex("steps", p.n), 1);
    applied.push({ ...op, before });
  }
  for (const { op, p } of removes) {
    if (p && p.kind !== "item" && p.kind !== "step") reject(op, "remove nie działa na tej ścieżce");
  }

  return { recipe: r, applied, rejected };
}

// Czy operacje zmieniają listę składników (wtedy trzeba przeliczyć kalorie)
export function touchesIngredients(ops: RecipeChange[]): boolean {
  return ops.some((o) => o.path.startsWith("ingredientGroups"));
}

// Etykieta ścieżki po ludzku do podglądu zmian
export function describePath(r: RecipeText, op: RecipeOp): string {
  const p = parseOpPath(op.path);
  if (!p) return op.path;
  const names: Record<string, string> = {
    title: "Tytuł",
    lead: "Lead",
    about: "Kilka słów o przepisie",
    servings: "Porcje",
    prepTimeMin: "Czas przygotowania",
    totalTimeMin: "Czas łączny",
    difficulty: "Trudność",
  };
  const group = (g: number) => {
    const t = r.ingredientGroups[g]?.title;
    return t ? `Składniki → ${t}` : r.ingredientGroups.length > 1 ? `Składniki (grupa ${g + 1})` : "Składniki";
  };
  switch (p.kind) {
    case "scalar":
      return names[p.field] ?? p.field;
    case "groupTitle":
      return `${group(p.g)} → nazwa grupy`;
    case "item":
      return `${group(p.g)}, poz. ${p.i + 1}`;
    case "items":
      return `${group(p.g)} (nowy składnik)`;
    case "groups":
      return "Składniki (nowa grupa)";
    case "stepField":
      return `Krok ${p.n + 1}${p.key === "tip" ? " → tip" : p.key === "title" ? " → nazwa" : ""}`;
    case "step":
      return `Krok ${p.n + 1}`;
    case "steps":
      return `Krok ${Number.isInteger((op as any).index) ? (op as any).index + 1 : r.steps.length + 1} (nowy)`;
  }
}
