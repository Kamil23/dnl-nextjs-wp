import { SITE_URL } from "../lib/constants";

function stripTags(html: string = "") {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Ingredients live in the Gutenberg list right after the "składniki" heading.
function parseIngredients(content: string): string[] {
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

// Steps come from the Yoast How-To block markup.
function parseSteps(content: string): { name?: string; text: string }[] {
  return Array.from(content.matchAll(
    /<li class="schema-how-to-step"[^>]*>([\s\S]*?)<\/li>/g
  ))
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

// "Potrzebny czas: 1 godzina 20 minut" -> "PT1H20M"
function parseTotalTime(content: string): string | null {
  const m = content.match(
    /schema-how-to-total-time[\s\S]*?<\/span>([^<]+)</
  );
  if (!m) return null;
  const text = m[1];
  const hours = text.match(/(\d+)\s*godz/i)?.[1];
  const minutes = text.match(/(\d+)\s*min/i)?.[1];
  if (!hours && !minutes) return null;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}`;
}

export default function RecipeSchema({ post, description }) {
  const content = post?.content || "";
  const recipeIngredient = parseIngredients(content);
  const steps = parseSteps(content);

  // Not every post is a recipe card — skip schema when there is nothing to mark up
  if (recipeIngredient.length === 0 && steps.length === 0) return null;

  const totalTime = parseTotalTime(content);
  const categories = post.categories?.edges
    ?.map(({ node }) => node.name)
    .filter((name) => name !== "Przepisy");

  const schema = {
    "@context": "https://schema.org/",
    "@type": "Recipe",
    name: stripTags(post.title),
    url: `${SITE_URL}${post.uri || ""}`,
    image: post.featuredImage?.node?.sourceUrl
      ? [post.featuredImage.node.sourceUrl]
      : undefined,
    datePublished: post.date,
    dateModified: post.modified,
    description: description || stripTags(post.excerpt || ""),
    author: post.author?.node?.name
      ? { "@type": "Person", name: post.author.node.name }
      : undefined,
    recipeCategory: categories?.length ? categories.join(", ") : undefined,
    recipeIngredient: recipeIngredient.length ? recipeIngredient : undefined,
    recipeInstructions: steps.length
      ? steps.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text }))
      : undefined,
    totalTime: totalTime || undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
