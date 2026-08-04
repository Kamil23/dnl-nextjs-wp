import {
  SITE_URL,
  SITE_TITLE,
  SOCIAL_TIKTOK_URL,
  SOCIAL_INSTAGRAM_URL,
} from "../lib/constants";
import { minutesToIso8601 } from "../lib/recipe-parser";
import type { FullRecipe } from "../lib/queries";

// Recipe + BreadcrumbList JSON-LD built from structured DB fields —
// richer than what the old WP theme emitted (which parsed the same data
// out of the rendered HTML).
// Props arrive JSON-serialized from getStaticProps, so dates may be strings
function iso(d: Date | string | null | undefined) {
  return d ? new Date(d).toISOString() : undefined;
}

export default function RecipeSchema({ recipe }: { recipe: FullRecipe }) {
  const ingredientTexts = recipe.ingredientGroups.flatMap((g) => g.items);
  // Articles never emit Recipe schema, even if stray list data exists.
  // `image` is a REQUIRED Recipe property for the Google rich result — emitting
  // a Recipe without one gets it rejected and reported as an error in Search
  // Console, so we suppress the Recipe block (keeping BreadcrumbList) rather than
  // ship invalid markup when a recipe has no hero image.
  const isRecipe =
    !recipe.uri.startsWith("/artykuly/") &&
    !!recipe.heroImage &&
    (ingredientTexts.length > 0 || recipe.steps.length > 0);

  const categoryNames = recipe.categories
    .map((c) => c.name)
    .filter((name) => name !== "Przepisy" && name !== "Artykuły");

  const recipeSchema = isRecipe
    ? {
        "@context": "https://schema.org/",
        "@type": "Recipe",
        name: recipe.title,
        url: `${SITE_URL}${recipe.uri}`,
        image: recipe.heroImage ? [recipe.heroImage] : undefined,
        datePublished: iso(recipe.publishedAt),
        dateModified: iso(recipe.updatedAt),
        description: recipe.seoDescription || recipe.lead || undefined,
        author: {
          "@type": "Person",
          name: recipe.authorName || "Roksana",
          url: SOCIAL_INSTAGRAM_URL,
          sameAs: [SOCIAL_INSTAGRAM_URL, SOCIAL_TIKTOK_URL],
        },
        // keywords is a recommended Recipe rich-result property — merge the
        // editorial keywords with tag names, deduplicated
        keywords:
          Array.from(
            new Set(
              [
                ...(recipe.keywords ? recipe.keywords.split(",") : []),
                ...recipe.tags.map((t) => t.name),
              ].map((k) => k.trim().toLowerCase())
            )
          ).join(", ") || undefined,
        recipeCategory: categoryNames.length ? categoryNames.join(", ") : undefined,
        recipeYield: recipe.servingsText || (recipe.servings ? `${recipe.servings} porcje` : undefined),
        prepTime: minutesToIso8601(recipe.prepTimeMin) || undefined,
        cookTime: minutesToIso8601(recipe.cookTimeMin) || undefined,
        totalTime: minutesToIso8601(recipe.totalTimeMin) || undefined,
        recipeIngredient: ingredientTexts.length ? ingredientTexts : undefined,
        recipeInstructions: recipe.steps.length
          ? recipe.steps.map((s, i) => ({
              "@type": "HowToStep",
              name: s.title || undefined,
              text: s.body,
              url: `${SITE_URL}${recipe.uri}#krok-${i + 1}`,
            }))
          : undefined,
        nutrition: recipe.kcal
          ? {
              "@type": "NutritionInformation",
              calories: `${recipe.kcal} kcal`,
              proteinContent: recipe.protein ? `${recipe.protein} g` : undefined,
              fatContent: recipe.fat ? `${recipe.fat} g` : undefined,
              carbohydrateContent: recipe.carbs ? `${recipe.carbs} g` : undefined,
            }
          : undefined,
        aggregateRating: recipe.rating
          ? {
              "@type": "AggregateRating",
              ratingValue: Number(recipe.rating.value).toFixed(1),
              reviewCount: String(recipe.rating.count),
            }
          : undefined,
        video: recipe.videoUrl
          ? {
              "@type": "VideoObject",
              name: recipe.title,
              description: recipe.seoDescription || recipe.lead || recipe.title,
              contentUrl: recipe.videoUrl,
              thumbnailUrl: recipe.heroImage || undefined,
              uploadDate: iso(recipe.publishedAt),
              duration: recipe.videoDurationSec
                ? `PT${Math.floor(recipe.videoDurationSec / 60)}M${recipe.videoDurationSec % 60}S`
                : undefined,
            }
          : undefined,
      }
    : null;

  // Strona główna -> kategoria nadrzędna -> podkategoria -> przepis
  const parentCat = recipe.categories.find((c) => !c.parentId);
  const childCat = recipe.categories.find((c) => c.parentId);
  const crumbs = [
    { name: SITE_TITLE, item: `${SITE_URL}/` },
    ...(parentCat ? [{ name: parentCat.name, item: `${SITE_URL}${parentCat.uri}` }] : []),
    ...(childCat ? [{ name: childCat.name, item: `${SITE_URL}${childCat.uri}` }] : []),
    { name: recipe.title, item: `${SITE_URL}${recipe.uri}` },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org/",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };

  const blocks = [breadcrumbSchema, ...(recipeSchema ? [recipeSchema] : [])];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(blocks) }}
    />
  );
}
