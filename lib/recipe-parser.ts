// Parses the recipe data embedded in WordPress-rendered post HTML:
// a Gutenberg ingredient list and the Yoast How-To block. Used by the
// public RecipeSchema component and by the WP import script.

export function stripTags(html: string = "") {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Ingredients live in the Gutenberg list right after the "składniki" heading.
export function parseIngredients(content: string): string[] {
  const headingIdx = content.search(/<h[1-6][^>]*>[^<]*składniki/i);
  const searchFrom = headingIdx >= 0 ? headingIdx : 0;
  const listMatch = content
    .slice(searchFrom)
    .match(/<ul class="wp-block-list">([\s\S]*?)<\/ul>/);
  if (!listMatch) return [];
  return Array.from(listMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g))
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
}

export type ParsedIngredientGroup = { title: string | null; items: string[] };

// Multi-section ingredients: the "Składniki" marker (heading OR plain <p>)
// is followed by alternating section titles (<p>/<h3>…) and wp-block-list
// lists - e.g. Spód / Masa kremowa / Dekoracja. Collects them all.
export function parseIngredientGroups(content: string): ParsedIngredientGroup[] {
  const marker = content.match(/<(h[1-6]|p)[^>]*>[^<]*składniki[^<]*<\/\1>/i);
  const startIdx = marker ? marker.index! + marker[0].length : 0;

  // scan only up to the how-to block / preparation heading
  let endIdx = content.length;
  for (const stop of [
    content.indexOf('schema-how-to', startIdx),
    content.slice(startIdx).search(/<(h[1-6]|p)[^>]*>[^<]*(spos[óo]b przygotowania|przygotowanie|wykonanie)/i) + startIdx,
  ]) {
    if (stop > startIdx) endIdx = Math.min(endIdx, stop);
  }
  const segment = content.slice(startIdx, endIdx);

  const groups: ParsedIngredientGroup[] = [];
  let pendingTitle: string | null = null;
  const tokens = segment.matchAll(
    /<(h[1-6]|p)[^>]*>([\s\S]*?)<\/\1>|<ul class="wp-block-list">([\s\S]*?)<\/ul>/g
  );
  for (const t of tokens) {
    if (t[3] !== undefined) {
      const items = Array.from(t[3].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g))
        .map((m) => stripTags(m[1]))
        .filter(Boolean);
      if (items.length) groups.push({ title: pendingTitle, items });
      pendingTitle = null;
    } else {
      const text = stripTags(t[2]);
      if (!text) continue;
      // long prose = the article resumed; short text = a section title
      if (text.length > 60) {
        if (groups.length > 0) break;
        continue;
      }
      pendingTitle = text.replace(/[:：]\s*$/, "");
    }
  }

  // fallback to the single-list behaviour when the structure didn't match
  if (groups.length === 0) {
    const flat = parseIngredients(content);
    return flat.length ? [{ title: null, items: flat }] : [];
  }
  return groups;
}

export type ParsedStep = { name?: string; text: string };

// Steps come from the Yoast How-To block markup.
export function parseSteps(content: string): ParsedStep[] {
  return Array.from(
    content.matchAll(/<li class="schema-how-to-step"[^>]*>([\s\S]*?)<\/li>/g)
  )
    .map((m) => {
      const name = m[1].match(
        /<strong class="schema-how-to-step-name">([\s\S]*?)<\/strong>/
      );
      const text = m[1].match(
        /<p class="schema-how-to-step-text">([\s\S]*?)<\/p>/
      );
      return {
        name: name ? stripTags(name[1]) : undefined,
        text: stripTags(text ? text[1] : m[1]),
      };
    })
    .filter((s) => s.text);
}

// "Potrzebny czas: 1 godzina 20 minut" -> total minutes
export function parseTotalTimeMinutes(content: string): number | null {
  const m = content.match(/schema-how-to-total-time[\s\S]*?<\/span>([^<]+)</);
  if (!m) return null;
  const hours = m[1].match(/(\d+)\s*godz/i)?.[1];
  const minutes = m[1].match(/(\d+)\s*min/i)?.[1];
  if (!hours && !minutes) return null;
  return (hours ? parseInt(hours, 10) * 60 : 0) + (minutes ? parseInt(minutes, 10) : 0);
}

// Removes the raw ingredient list and the Yoast How-To block from old
// WP content, so the article intro can be shown next to the new structured
// recipe UI without duplicating ingredients/steps.
export function stripRecipeBlocks(content: string): string {
  let out = content;
  // the how-to block (steps + total time)
  out = out.replace(/<div class="schema-how-to wp-block-yoast-how-to-block">[\s\S]*?<\/ol><\/div>/g, "");
  // the ingredients heading + its list
  out = out.replace(
    /<h[1-6][^>]*>[^<]*składniki[^<]*<\/h[1-6]>\s*(?:<ul class="wp-block-list">[\s\S]*?<\/ul>)?/gi,
    ""
  );
  // a bare "Sposób przygotowania" heading left above the removed block
  out = out.replace(/<h[1-6][^>]*>\s*spos[óo]b przygotowania\s*<\/h[1-6]>/gi, "");
  return out;
}

export function minutesToIso8601(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}`;
}
