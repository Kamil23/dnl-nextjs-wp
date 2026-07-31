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
  if (!parsed) return line;
  return `${formatQuantity(parsed.value * factor)}${parsed.rest}`;
}
