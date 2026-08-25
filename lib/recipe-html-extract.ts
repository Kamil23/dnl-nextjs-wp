// Deterministic extraction of structured ingredients/steps from legacy WordPress
// content HTML (the "wp-block-list" recipes imported before the structured
// model). Used by the QC auto-fix for "brak kroków/składników w strukturze".
// Conservative on purpose: returns nothing when the expected shape isn't clearly
// there, so it never invents data from irregular markup.

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#8211;/g, "–")
    .replace(/&#215;/g, "×")
    .replace(/&#8217;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// All <li> texts inside the first list of `tag` that appears AFTER `markerRe`.
function listAfterMarker(html: string, markerRe: RegExp, tag: "ol" | "ul"): string[] | null {
  const marker = html.search(markerRe);
  if (marker === -1) return null;
  const rest = html.slice(marker);
  const listMatch = rest.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!listMatch) return null;
  const items = [...listMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => m[1])
    .filter(Boolean);
  return items.length ? items : null;
}

export type ExtractedStep = { title: string | null; body: string };

// Split "<strong>Masa.</strong> reszta" into { title: "Masa", body: "reszta" }.
// Handles <strong> with attributes (np. class="schema-how-to-step-name").
function parseStep(liHtml: string): ExtractedStep {
  const strong = liHtml.match(/^\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*([\s\S]*)$/i);
  if (strong) {
    const title = stripTags(strong[1]).replace(/[.:]\s*$/, "");
    const body = stripTags(strong[2]);
    if (title && body) return { title, body };
  }
  return { title: null, body: stripTags(liHtml) };
}

// The first <ul> that appears BEFORE the steps section - a fallback for recipes
// whose ingredient list has no "Składniki" heading (the list sits right after
// the title). Bounded to the pre-steps area so we never grab a list of steps.
function firstListBeforeSteps(html: string): string[] | null {
  const stepPos = html.search(STEP_MARKER);
  const area = stepPos === -1 ? html : html.slice(0, stepPos);
  const ul = area.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (!ul) return null;
  const items = [...ul[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]).filter(Boolean);
  return items.length ? items : null;
}

export type Extracted = {
  ingredients: string[];
  steps: ExtractedStep[];
};

const ING_MARKER = /Składniki/i;
const STEP_MARKER = /Przygotowanie|Wykonanie|Sposób przygotowania/i;

// Returns extracted structure. Either list may be empty when that section isn't
// present - callers decide per-recipe which piece to write.
export function extractStructured(html: string | null): Extracted {
  if (!html) return { ingredients: [], steps: [] };

  // Najpierw lista po nagłówku "Składniki"; gdy go brak - pierwsza <ul> przed krokami.
  const ingItems = listAfterMarker(html, ING_MARKER, "ul") ?? firstListBeforeSteps(html) ?? [];
  const ingredients = ingItems.map(stripTags).filter((t) => t.length > 0);

  // Steps are the ordered list after the "Przygotowanie" marker; fall back to
  // the last <ol> in the document if the marker is missing.
  let stepItems = listAfterMarker(html, STEP_MARKER, "ol");
  if (!stepItems) {
    const allOl = [...html.matchAll(/<ol[^>]*>([\s\S]*?)<\/ol>/gi)];
    if (allOl.length) {
      stepItems = [...allOl[allOl.length - 1][1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
    }
  }
  const steps = (stepItems ?? []).map(parseStep).filter((s) => s.body.length > 0);

  return { ingredients, steps };
}
