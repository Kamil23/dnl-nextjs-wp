/**
 * QC danych przepisów z linii poleceń (to samo, co strona /admin/qc).
 * Uruchom: npm run qc:recipes
 * Wypisuje przepisy z błędami/ostrzeżeniami; kończy kodem 1, gdy są błędy
 * (nadaje się do CI / pre-deploy).
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { checkRecipe, hasError } from "../lib/recipe-qc";

const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema });

async function main() {
  const { recipes, ingredientGroups, ingredients, steps } = schema;

  const recs = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      uri: recipes.uri,
      status: recipes.status,
      kcal: recipes.kcal,
      protein: recipes.protein,
      fat: recipes.fat,
      carbs: recipes.carbs,
      servings: recipes.servings,
      totalTimeMin: recipes.totalTimeMin,
      heroImage: recipes.heroImage,
      contentHtml: recipes.contentHtml,
    })
    .from(recipes)
    .where(and(eq(recipes.status, "published"), sql`${recipes.uri} not like '/artykuly/%'`));

  const ingRows = await db
    .select({ recipeId: ingredientGroups.recipeId, c: sql<number>`count(${ingredients.id})::int` })
    .from(ingredientGroups)
    .leftJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
    .groupBy(ingredientGroups.recipeId);
  const stepRows = await db
    .select({ recipeId: steps.recipeId, c: sql<number>`count(*)::int` })
    .from(steps)
    .groupBy(steps.recipeId);

  const ingBy = new Map(ingRows.map((r) => [r.recipeId, Number(r.c)]));
  const stepBy = new Map(stepRows.map((r) => [r.recipeId, Number(r.c)]));

  let errorRecipes = 0;
  let warningRecipes = 0;

  for (const r of recs) {
    const issues = checkRecipe({
      id: r.id,
      title: r.title,
      uri: r.uri,
      status: r.status,
      kcal: r.kcal,
      protein: r.protein != null ? Number(r.protein) : null,
      fat: r.fat != null ? Number(r.fat) : null,
      carbs: r.carbs != null ? Number(r.carbs) : null,
      servings: r.servings,
      totalTimeMin: r.totalTimeMin,
      heroImage: r.heroImage,
      ingredientCount: ingBy.get(r.id) ?? 0,
      stepCount: stepBy.get(r.id) ?? 0,
      hasContentHtml: (r.contentHtml?.length ?? 0) > 50,
    });
    if (issues.length === 0) continue;
    if (hasError(issues)) errorRecipes++;
    else warningRecipes++;

    console.log(`\n${hasError(issues) ? "✗" : "!"} [${r.id}] ${r.title}`);
    console.log(`  ${r.uri}`);
    for (const i of issues) {
      console.log(`  ${i.severity === "error" ? "BŁĄD " : "ostrz"}: ${i.message}`);
    }
  }

  console.log(
    `\nSprawdzono ${recs.length} przepisów - ${errorRecipes} z błędami, ${warningRecipes} z ostrzeżeniami.`
  );
  await client.end();
  process.exit(errorRecipes > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
