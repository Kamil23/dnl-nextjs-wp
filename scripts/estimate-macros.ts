/**
 * One-shot backfill: estimate kcal/protein/fat/carbs per serving for recipes
 * that have ingredients but no kcal (the WP-imported ones). Values land in the
 * recipe (nutrition in the Recipe schema) and are editable in the admin.
 * The estimation itself lives in lib/server/estimate-macros.ts (shared with the
 * admin "estimate" button and the TikTok import fallback).
 * Run: npx tsx scripts/estimate-macros.ts
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { estimateMacros } from "../lib/server/estimate-macros";

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });
const { recipes, ingredientGroups, ingredients } = schema;

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Brak OPENAI_API_KEY");

  // Every recipe with ingredients and no kcal — drafts included, so
  // TikTok imports awaiting review get macros too
  const targets = await db.select().from(recipes).where(isNull(recipes.kcal));

  let done = 0,
    skipped = 0,
    failed = 0;
  for (const r of targets) {
    const rows = await db
      .select({ rawText: ingredients.rawText })
      .from(ingredientGroups)
      .innerJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
      .where(eq(ingredientGroups.recipeId, r.id));
    const items = rows.map((x) => x.rawText);
    if (items.length === 0) {
      skipped++;
      continue;
    }
    try {
      const m = await estimateMacros(r.title, r.servings, items);
      const patch: any = {
        kcal: m.kcal,
        protein: m.protein != null ? String(m.protein) : null,
        fat: m.fat != null ? String(m.fat) : null,
        carbs: m.carbs != null ? String(m.carbs) : null,
      };
      // kcal/porcję ma sens tylko przy jawnej liczbie porcji — gdy jej nie
      // było, zapisujemy założenie modelu (operator może poprawić)
      if (!r.servings && m.assumedServings > 0) {
        patch.servings = m.assumedServings;
        patch.servingsText = `ok. ${m.assumedServings} porcji`;
      }
      await db.update(recipes).set(patch).where(eq(recipes.id, r.id));
      done++;
      console.log(
        `✓ ${r.title}: ${m.kcal} kcal/porcję (${r.servings ?? `założono ${m.assumedServings}`} porcji) | B ${m.protein} T ${m.fat} W ${m.carbs}`
      );
    } catch (e: any) {
      failed++;
      console.warn(`✗ ${r.title}: ${e.message?.slice(0, 120)}`);
    }
  }
  console.log(`\nGotowe: ${done} uzupełnionych, ${skipped} bez składników, ${failed} błędów.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
