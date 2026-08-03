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

  return line;
}
