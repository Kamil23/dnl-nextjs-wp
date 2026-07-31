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

export function minutesToIso8601(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}`;
}
