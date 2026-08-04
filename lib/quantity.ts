// Parses and scales quantities in Polish ingredient lines so the
// servings switcher can recompute amounts ("pół szklanki" x2 -> "1 szklanka"
// is out of scope grammatically — we render numbers, e.g. "1 szklanki").
// Lines without a recognizable leading quantity are returned unchanged.

const WORD_VALUES: [RegExp, number][] = [
  [/^półtorej|^półtora/i, 1.5],
  [/^pół/i, 0.5],
  [/^ćwierć/i, 0.25],
  [/^jedna|^jeden|^jedno/i, 1],
  [/^dwie|^dwa/i, 2],
  [/^trzy/i, 3],
  [/^cztery/i, 4],
  [/^pięć/i, 5],
];

type ParsedQuantity = { value: number; rest: string } | null;

export function parseQuantity(line: string): ParsedQuantity {
  const trimmed = line.trim();

  // "2", "1,5", "1.5", "1/2", "2-3"
  const numMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?/);
  if (numMatch) {
    let value = parseFloat(numMatch[1].replace(",", "."));
    if (numMatch[2]) value = value / parseFloat(numMatch[2]);
    return { value, rest: trimmed.slice(numMatch[0].length) };
  }

  for (const [re, value] of WORD_VALUES) {
    const m = trimmed.match(re);
    if (m) return { value, rest: trimmed.slice(m[0].length) };
  }

  return null;
}

// Countable unit/ingredient words with Polish plural forms:
// [1 sztuka, 2-4 sztuki (i ułamki), 5+ sztuk]
const COUNTABLE_FORMS: string[][] = [
  ["łyżka", "łyżki", "łyżek"],
  ["łyżeczka", "łyżeczki", "łyżeczek"],
  ["szklanka", "szklanki", "szklanek"],
  ["jajko", "jajka", "jajek"],
  ["jajo", "jaja", "jaj"],
  ["ząbek", "ząbki", "ząbków"],
  ["puszka", "puszki", "puszek"],
  ["opakowanie", "opakowania", "opakowań"],
  ["kostka", "kostki", "kostek"],
  ["plaster", "plastry", "plastrów"],
  ["plasterek", "plasterki", "plasterków"],
  ["garść", "garście", "garści"],
  ["szczypta", "szczypty", "szczypt"],
  ["sztuka", "sztuki", "sztuk"],
  ["kromka", "kromki", "kromek"],
  ["tortilla", "tortille", "tortilli"],
  ["bułka", "bułki", "bułek"],
  ["paczka", "paczki", "paczek"],
  ["ciastko", "ciastka", "ciastek"],
  ["batonik", "batoniki", "batoników"],
  ["listek", "listki", "listków"],
];

function findCountable(word: string): string[] | null {
  const w = word.toLowerCase();
  return COUNTABLE_FORMS.find((forms) => forms.includes(w)) ?? null;
}

// 1 łyżka | 2-4 łyżki (także 1½, 2¼...) | 5+ łyżek — z wyjątkiem 12-14
function unitForm(forms: string[], value: number): string {
  if (value === 1) return forms[0];
  if (!Number.isInteger(value)) return forms[1];
  const d10 = value % 10;
  const d100 = value % 100;
  if (d10 >= 2 && d10 <= 4 && !(d100 >= 12 && d100 <= 14)) return forms[1];
  return forms[2];
}

const UNICODE_FRACTIONS: Record<string, string> = {
  "0.25": "¼",
  "0.5": "½",
  "0.75": "¾",
  "0.33": "⅓",
  "0.67": "⅔",
};

export function formatQuantity(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 100) / 100;
  const fracStr = UNICODE_FRACTIONS[String(frac)];
  if (fracStr) return whole > 0 ? `${whole}${fracStr}` : fracStr;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(".", ",");
}

// --- shopping-list merging -------------------------------------------------
// Parses a free-text list line into amount + unit + name so identical
// ingredients from different recipes can be summed ("2 jajka" + "3 jajka"
// -> "5 jajek"). No ingredient database — matching is by normalized name.

const WEIGHT_FACTORS: Record<string, number> = { g: 1, dag: 10, kg: 1000 };
const VOLUME_FACTORS: Record<string, number> = { ml: 1, l: 1000 };

type LineParts = {
  kind: "weight" | "volume" | "count" | "plain" | "none";
  qty: number | null;
  base: number; // grams / milliliters for weight & volume
  forms: string[] | null; // countable declension forms
  name: string; // original casing, without the amount
  key: string; // normalized matching key
  nameFirst: boolean; // "mascarpone 500 g" style
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[„”"']/g, "")
    .replace(/[\s.,;:!–-]+$/g, "")
    .replace(/^[\s.,;:!–-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseShoppingLine(line: string): LineParts {
  const t = line.trim();
  const q = parseQuantity(t);

  if (q) {
    const rest = q.rest.trim();
    const m = rest.match(/^(\p{L}+)\.?/u);
    if (m) {
      const w = m[1].toLowerCase();
      if (WEIGHT_FACTORS[w] != null || VOLUME_FACTORS[w] != null) {
        const isWeight = WEIGHT_FACTORS[w] != null;
        const name = rest.slice(m[0].length).trim();
        return {
          kind: isWeight ? "weight" : "volume",
          qty: q.value,
          base: q.value * (isWeight ? WEIGHT_FACTORS[w] : VOLUME_FACTORS[w]),
          forms: null,
          name,
          key: normalizeKey(name),
          nameFirst: false,
        };
      }
      const forms = findCountable(m[1]);
      if (forms) {
        const name = rest.slice(m[0].length).trim();
        return {
          kind: "count",
          qty: q.value,
          base: 0,
          forms,
          name,
          key: normalizeKey(name) || forms[0],
          nameFirst: false,
        };
      }
    }
    return { kind: "plain", qty: q.value, base: 0, forms: null, name: rest, key: normalizeKey(rest), nameFirst: false };
  }

  // Implicit "1": "jajko", "łyżka ksylitolu"
  const first = t.match(/^(\p{L}+)/u);
  const firstForms = first ? findCountable(first[1]) : null;
  if (first && firstForms) {
    const name = t.slice(first[1].length).trim();
    return {
      kind: "count",
      qty: 1,
      base: 0,
      forms: firstForms,
      name,
      key: normalizeKey(name) || firstForms[0],
      nameFirst: false,
    };
  }

  // Mid-line amount: "mascarpone 500 g (schłodzone)"
  const mid = t.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|dag)\b/u);
  if (mid) {
    const value = parseFloat(mid[1].replace(",", "."));
    const unit = mid[2].toLowerCase();
    const isWeight = WEIGHT_FACTORS[unit] != null;
    const name = `${t.slice(0, mid.index!)} ${t.slice(mid.index! + mid[0].length)}`.replace(/\s+/g, " ").trim();
    return {
      kind: isWeight ? "weight" : "volume",
      qty: value,
      base: value * (isWeight ? WEIGHT_FACTORS[unit] : VOLUME_FACTORS[unit]),
      forms: null,
      name,
      key: normalizeKey(name),
      nameFirst: true,
    };
  }

  return { kind: "none", qty: null, base: 0, forms: null, name: t, key: normalizeKey(t), nameFirst: false };
}

function formatBase(total: number, kind: "weight" | "volume"): string {
  const [small, big] = kind === "weight" ? ["g", "kg"] : ["ml", "l"];
  // Round-number totals read better in the big unit: 1200 -> "1,2 kg"
  if (total >= 1000 && total % 100 === 0) return `${formatQuantity(total / 1000)} ${big}`;
  const rounded = Math.round(total * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : String(rounded).replace(".", ",")} ${small}`;
}

// Polish plural category — a summed count may only reuse the original noun
// form when it stays in the same category (1 / 2-4 / 5+)
function pluralCategory(n: number): number {
  if (n === 1) return 1;
  if (!Number.isInteger(n)) return 2;
  const d10 = n % 10;
  const d100 = n % 100;
  return d10 >= 2 && d10 <= 4 && !(d100 >= 12 && d100 <= 14) ? 2 : 3;
}

// The summed line when both lines describe the same ingredient in
// compatible units, otherwise null (better two rows than a wrong sum).
export function mergeShoppingLines(a: string, b: string): string | null {
  const pa = parseShoppingLine(a);
  const pb = parseShoppingLine(b);
  if (!pa.key || pa.key !== pb.key || pa.kind !== pb.kind) return null;

  switch (pa.kind) {
    case "none":
      return a; // identical unquantified items — keep one
    case "weight":
    case "volume": {
      const amount = formatBase(pa.base + pb.base, pa.kind);
      return pa.nameFirst ? `${pa.name} ${amount}` : `${amount} ${pa.name}`.trim();
    }
    case "count": {
      if (pa.forms![0] !== pb.forms![0]) return null;
      const sum = pa.qty! + pb.qty!;
      const unit = unitForm(pa.forms!, sum);
      return `${formatQuantity(sum)} ${unit}${pa.name ? ` ${pa.name}` : ""}`;
    }
    case "plain": {
      const sum = pa.qty! + pb.qty!;
      const cat = pluralCategory(sum);
      if (cat !== pluralCategory(pa.qty!) || cat !== pluralCategory(pb.qty!)) return null;
      return `${formatQuantity(sum)} ${pa.name}`;
    }
  }
}

// Scale an ingredient line by `factor`; returns the original line when the
// quantity can't be parsed (better honest than wrong).
export function scaleIngredient(line: string, factor: number): string {
  if (factor === 1) return line;

  const parsed = parseQuantity(line);
  if (parsed) {
    const scaled = parsed.value * factor;
    // If a countable unit word follows the number, decline it properly:
    // "pół szklanki mąki" x2 -> "1 szklanka mąki"
    const m = parsed.rest.match(/^\s*(\p{L}+)/u);
    const forms = m ? findCountable(m[1]) : null;
    if (m && forms) {
      const remainder = parsed.rest.slice(parsed.rest.indexOf(m[1]) + m[1].length);
      return `${formatQuantity(scaled)} ${unitForm(forms, scaled)}${remainder}`;
    }
    return `${formatQuantity(scaled)}${parsed.rest}`;
  }

  // Implicit "1": lines starting with a countable word — "jajko" = 1 jajko,
  // "łyżka ksylitolu" = 1 łyżka
  const first = line.trim().match(/^(\p{L}+)/u);
  const forms = first ? findCountable(first[1]) : null;
  if (first && forms) {
    const remainder = line.trim().slice(first[1].length);
    return `${formatQuantity(factor)} ${unitForm(forms, factor)}${remainder}`;
  }

  // Mid-line weight/volume: "mascarpone 500 g (schłodzone)" -> scale the
  // number ONLY when a real unit follows (never "36 %" — fat percentages
  // and similar must stay untouched)
  const mid = line.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|dag)\b/u);
  if (mid) {
    const value = parseFloat(mid[1].replace(",", "."));
    const scaled = Math.round(value * factor * 100) / 100;
    const rendered = Number.isInteger(scaled) ? String(scaled) : String(scaled).replace(".", ",");
    return (
      line.slice(0, mid.index!) +
      `${rendered} ${mid[2]}` +
      line.slice(mid.index! + mid[0].length)
    );
  }

  return line;
}
