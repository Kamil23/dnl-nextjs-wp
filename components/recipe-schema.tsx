import {
  SITE_URL,
  SITE_TITLE,
  AUTHOR_NAME,
  AUTHOR_PAGE_PATH,
  SOCIAL_TIKTOK_URL,
  SOCIAL_INSTAGRAM_URL,
} from "../lib/constants";
import { minutesToIso8601 } from "../lib/recipe-parser";
import { absUrl } from "../lib/seo";
import type { FullRecipe } from "../lib/queries";

// Recipe + BreadcrumbList JSON-LD built from structured DB fields —
// richer than what the old WP theme emitted (which parsed the same data
// out of the rendered HTML).
// Props arrive JSON-serialized from getStaticProps, so dates may be strings
function iso(d: Date | string | null | undefined) {
  return d ? new Date(d).toISOString() : undefined;
}

// Tagi diety -> wartości DietTypeEnumeration; brak trafienia = undefined
// (tagów dietowych nie ma jeszcze w słowniku, mapper czeka na nie)
const DIET_PATTERNS: [RegExp, string][] = [
  [/wegan|wegań|vegan/i, "https://schema.org/VeganDiet"],
  [/wegetaria|^wege\b|-wege\b|wege$/i, "https://schema.org/VegetarianDiet"],
  [/gluten/i, "https://schema.org/GlutenFreeDiet"],
  [/laktoza|laktozy/i, "https://schema.org/LowLactoseDiet"],
];

function dietFromTags(tagTexts: string[]): string[] {
  const hits = DIET_PATTERNS.map(([re, uri]) =>
    tagTexts.some((t) => re.test(t)) ? uri : null
  ).filter(Boolean) as string[];
  return hits;
}

export default function RecipeSchema({ recipe }: { recipe: FullRecipe }) {
  const ingredientTexts = recipe.ingredientGroups.flatMap((g) => g.items);  // Articles never emit Recipe schema, even if stray list data exists.
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
        image: recipe.heroImage ? [absUrl(recipe.heroImage)] : undefined,
        datePublished: iso(recipe.publishedAt),
        dateModified: iso(recipe.updatedAt),
        description: recipe.seoDescription || recipe.lead || undefined,
        author: {
          "@type": "Person",
          name: recipe.authorName || AUTHOR_NAME,
          // Własna strona autorki = kotwica encji (E-E-A-T); profile społeczne
          // jako sameAs spinają tożsamość między platformami
          url: `${SITE_URL}${AUTHOR_PAGE_PATH}`,
          sameAs: [`${SITE_URL}${AUTHOR_PAGE_PATH}`, SOCIAL_INSTAGRAM_URL, SOCIAL_TIKTOK_URL],
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
        // Diety z tagów — tylko jednoznaczne wzorce, bo Google waliduje
        // wartości względem enumeracji schema.org (DietTypeEnumeration)
        suitableForDiet: dietFromTags(recipe.tags.map((t) => `${t.slug} ${t.name}`)) || undefined,
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
              image: s.image ? absUrl(s.image) : undefined,
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
        // Approved comments are real engagement signals — expose them the same
        // way the old WP theme did (scrapowalne w JSON-LD, jak oceny)
        commentCount: recipe.comments.length || undefined,
        comment: recipe.comments.length
          ? recipe.comments
              .filter((c) => !c.parentId)
              .slice(0, 20)
              .map((c) => ({
                "@type": "Comment",
                author: { "@type": "Person", name: c.authorName },
                text: c.body,
                dateCreated: iso(c.createdAt),
              }))
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
              thumbnailUrl: recipe.heroImage ? absUrl(recipe.heroImage) : undefined,
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

  // One <script> per schema object. A single tag with an array is valid for
  // Google, but naive JSON-LD consumers (browser extensions, recipe scrapers)
  // do JSON.parse(tag)["@context"] and crash on the array — and scrapability
  // is a feature here (ratings/comments are meant to be machine-readable).
  return (
    <>
      {blocks.map((b, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(b) }}
        />
      ))}
    </>
  );
}
