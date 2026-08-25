// Single source of truth for the diet facets. Recipes don't carry an explicit
// diet column — we infer it from tag text with conservative patterns, the same
// idea as the schema.org DietTypeEnumeration mapping in recipe-schema.tsx, but
// here the output is stable filter keys/labels used by the search facet and the
// Meilisearch index (`diets` filterable attribute).

export type DietFacet = {
  key: string;
  label: string;
  // schema.org DietTypeEnumeration URI, for pages that emit Recipe JSON-LD
  schema: string;
  pattern: RegExp;
};

export const DIET_FACETS: DietFacet[] = [
  { key: "weganskie", label: "Wegańskie", schema: "https://schema.org/VeganDiet", pattern: /wegan|wegań|vegan/i },
  { key: "wegetarianskie", label: "Wegetariańskie", schema: "https://schema.org/VegetarianDiet", pattern: /wegetaria|^wege\b|-wege\b|wege$/i },
  { key: "bezglutenowe", label: "Bez glutenu", schema: "https://schema.org/GlutenFreeDiet", pattern: /gluten/i },
  { key: "bez-laktozy", label: "Bez laktozy", schema: "https://schema.org/LowLactoseDiet", pattern: /laktoz/i },
];

// Given a recipe's tag texts (slug and/or name), return the diet keys it matches.
export function dietsFromTags(tagTexts: string[]): string[] {
  const hay = tagTexts.join(" ");
  return DIET_FACETS.filter((d) => d.pattern.test(hay)).map((d) => d.key);
}

export function dietLabel(key: string): string | undefined {
  return DIET_FACETS.find((d) => d.key === key)?.label;
}
