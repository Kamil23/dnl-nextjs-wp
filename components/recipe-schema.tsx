import { SITE_URL } from "../lib/constants";
import {
  stripTags,
  parseIngredients,
  parseSteps,
  parseTotalTimeMinutes,
  minutesToIso8601,
} from "../lib/recipe-parser";

export default function RecipeSchema({ post, description }) {
  const content = post?.content || "";
  const recipeIngredient = parseIngredients(content);
  const steps = parseSteps(content);

  // Not every post is a recipe card — skip schema when there is nothing to mark up
  if (recipeIngredient.length === 0 && steps.length === 0) return null;

  const totalTime = minutesToIso8601(parseTotalTimeMinutes(content));
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
