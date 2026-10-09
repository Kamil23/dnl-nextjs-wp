/**
 * Eksport opublikowanych przepisów do audytu (docs/audyt-przepisow-runbook.md).
 * Dla każdego przepisu (bez /artykuly/) pisze audit/recipes/<id>.json z pełną
 * treścią plus dwiema niezależnymi opiniami liczonymi w kodzie:
 *   - qc: wynik checkRecipe() (lib/recipe-qc),
 *   - nutritionAi: rozbicie składników na gramy i per 100 g (lib/server/nutrition-ai,
 *     model "nutrition" z ustawień) z deltą względem zapisanych kcal.
 * Do tego audit/INDEX.json z listą przepisów i audit/README-batch.md z podziałem na partie.
 *
 * Uruchom na LOKALNEJ kopii prod (restore ostatniego db-*.sql.gz z /admin/backupy):
 *   npm run audit:export                      # z rozbiciem odżywczym (koszt ~0,03 $/przepis)
 *   npm run audit:export -- --no-nutrition    # tylko eksport + QC
 *   npm run audit:export -- --ids 12,34       # wybrane przepisy
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import fs from "fs";
import path from "path";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { checkRecipe } from "../lib/recipe-qc";
import { getAiModels } from "../lib/server/ai-models";
import { buildBreakdown } from "../lib/server/nutrition-ai";
import { htmlToText } from "../lib/html-text";

const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema });
const { recipes, ingredientGroups, ingredients, steps, categories, recipeCategories, tags, recipeTags } = schema;

const args = process.argv.slice(2);
const withNutrition = !args.includes("--no-nutrition");
const idsArg = args[args.indexOf("--ids") + 1];
const onlyIds = args.includes("--ids") && idsArg ? new Set(idsArg.split(",").map((s) => Number(s.trim()))) : null;
const outArg = args[args.indexOf("--out") + 1];
const OUT = args.includes("--out") && outArg ? outArg : path.join(process.cwd(), "audit");
const BATCH = 8;

async function main() {
  fs.mkdirSync(path.join(OUT, "recipes"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "proposals"), { recursive: true });

  const recs = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.status, "published"), sql`${recipes.uri} not like '/artykuly/%'`))
    .orderBy(asc(recipes.id));
  const models = withNutrition ? await getAiModels(db) : null;
  const index: any[] = [];
  let n = 0;

  for (const r of recs) {
    if (onlyIds && !onlyIds.has(r.id)) continue;
    const groups = await db
      .select()
      .from(ingredientGroups)
      .where(eq(ingredientGroups.recipeId, r.id))
      .orderBy(asc(ingredientGroups.position));
    const ingredientGroupsOut = [] as { title: string | null; items: string[] }[];
    for (const g of groups) {
      const rows = await db
        .select({ rawText: ingredients.rawText, amount: ingredients.amount, unit: ingredients.unit, name: ingredients.name })
        .from(ingredients)
        .where(eq(ingredients.groupId, g.id))
        .orderBy(asc(ingredients.position));
      ingredientGroupsOut.push({ title: g.title, items: rows.map((x) => x.rawText) });
    }
    const stepRows = await db.select().from(steps).where(eq(steps.recipeId, r.id)).orderBy(asc(steps.position));
    const cats = await db
      .select({ slug: categories.slug, name: categories.name })
      .from(recipeCategories)
      .innerJoin(categories, eq(categories.id, recipeCategories.categoryId))
      .where(eq(recipeCategories.recipeId, r.id));
    const tagRows = await db
      .select({ slug: tags.slug, name: tags.name })
      .from(recipeTags)
      .innerJoin(tags, eq(tags.id, recipeTags.tagId))
      .where(eq(recipeTags.recipeId, r.id));

    const lines = ingredientGroupsOut.flatMap((g) => g.items);
    const qc = checkRecipe({
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
      ingredientCount: lines.length,
      stepCount: stepRows.length,
      hasContentHtml: (r.contentHtml?.length ?? 0) > 50,
    });

    let nutritionAi: any = null;
    if (withNutrition && lines.length && models) {
      try {
        const b = await buildBreakdown({
          title: r.title,
          lines,
          servings: r.servings,
          servingsSource: "draft",
          model: models.nutrition,
          draftPerServing: {
            kcal: r.kcal ?? undefined,
            protein: r.protein != null ? Number(r.protein) : undefined,
            fat: r.fat != null ? Number(r.fat) : undefined,
            carbs: r.carbs != null ? Number(r.carbs) : undefined,
          },
        });
        const stored = r.kcal ?? null;
        const computed = b.perServing?.kcal ?? null;
        nutritionAi = {
          model: b.model,
          servingsUsed: b.servings,
          servingsEstimate: b.servingsEstimate,
          servingsReason: b.servingsReason,
          totals: b.totals,
          perServing: b.perServing,
          deltaKcalPct: stored && computed ? Math.round(((computed - stored) / stored) * 100) : null,
          items: b.items.map((it) => ({ line: it.line, name: it.name, grams: it.grams, gramsSource: it.gramsSource, assumption: it.assumption, per100: it.per100, excluded: it.excluded })),
          issues: b.issues,
        };
      } catch (e: any) {
        nutritionAi = { error: String(e.message).slice(0, 200) };
      }
    }

    const out = {
      id: r.id,
      title: r.title,
      uri: r.uri,
      source: r.source,
      publishedAt: r.publishedAt,
      lead: r.lead,
      contentText: htmlToText(r.contentHtml),
      ingredientGroups: ingredientGroupsOut,
      steps: stepRows.map((s) => ({ title: s.title, body: s.body, tip: s.tip })),
      servings: r.servings,
      servingsText: r.servingsText,
      prepTimeMin: r.prepTimeMin,
      cookTimeMin: r.cookTimeMin,
      totalTimeMin: r.totalTimeMin,
      difficulty: r.difficulty,
      kcal: r.kcal,
      protein: r.protein != null ? Number(r.protein) : null,
      fat: r.fat != null ? Number(r.fat) : null,
      carbs: r.carbs != null ? Number(r.carbs) : null,
      categories: cats,
      tags: tagRows,
      legacyRating: r.legacyRatingCount ? { value: Number(r.legacyRatingValue), count: r.legacyRatingCount } : null,
      reviewMeta: r.reviewMeta ?? null,
      qc,
      nutritionAi,
    };
    fs.writeFileSync(path.join(OUT, "recipes", `${r.id}.json`), JSON.stringify(out, null, 2));
    index.push({
      id: r.id,
      title: r.title,
      uri: r.uri,
      kcal: r.kcal,
      servings: r.servings,
      qcErrors: qc.filter((i) => i.severity === "error").length,
      qcWarnings: qc.filter((i) => i.severity === "warning").length,
      deltaKcalPct: nutritionAi?.deltaKcalPct ?? null,
    });
    n++;
    console.log(`✓ [${r.id}] ${r.title}${nutritionAi?.deltaKcalPct != null ? ` (Δkcal ${nutritionAi.deltaKcalPct}%)` : ""}`);
  }

  fs.writeFileSync(path.join(OUT, "INDEX.json"), JSON.stringify(index, null, 2));
  const batches = [] as string[];
  for (let i = 0; i < index.length; i += BATCH) {
    const b = index.slice(i, i + BATCH);
    batches.push(`## Partia ${Math.floor(i / BATCH) + 1}\n` + b.map((x) => `- ${x.id}: ${x.title}`).join("\n"));
  }
  fs.writeFileSync(path.join(OUT, "README-batch.md"), `# Partie do audytu (${index.length} przepisów, po ${BATCH})\n\n${batches.join("\n\n")}\n`);
  console.log(`\nWyeksportowano ${n} przepisów do ${OUT}/recipes, partie w ${OUT}/README-batch.md`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
