/**
 * Re-parses ingredients from the original WP content with the multi-section
 * parser (Spód / Masa / Dekoracja...) and replaces the stored groups when
 * the new parse finds MORE items than the import did. Clears kcal for the
 * repaired recipes so estimate-macros can recompute on full data.
 * Run: npx tsx scripts/repair-ingredients.ts
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { parseIngredientGroups } from "../lib/recipe-parser";

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });
const { recipes, ingredientGroups, ingredients } = schema;

async function main() {
  const all = await db.select().from(recipes);
  let repaired = 0;

  for (const r of all) {
    if (!r.contentHtml || r.uri.startsWith("/artykuly/")) continue;

    const parsed = parseIngredientGroups(r.contentHtml);
    const newCount = parsed.reduce((n, g) => n + g.items.length, 0);

    const current = await db
      .select({ rawText: ingredients.rawText })
      .from(ingredientGroups)
      .innerJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
      .where(eq(ingredientGroups.recipeId, r.id));

    if (newCount <= current.length) continue;

    await db.transaction(async (tx) => {
      await tx.delete(ingredientGroups).where(eq(ingredientGroups.recipeId, r.id));
      let pos = 0;
      for (const g of parsed) {
        const [group] = await tx
          .insert(ingredientGroups)
          .values({ recipeId: r.id, title: g.title, position: pos++ })
          .returning({ id: ingredientGroups.id });
        await tx.insert(ingredients).values(
          g.items.map((rawText, i) => ({ groupId: group.id, rawText, position: i }))
        );
      }
      // macros were computed on incomplete ingredients — recompute later
      await tx
        .update(recipes)
        .set({ kcal: null, protein: null, fat: null, carbs: null })
        .where(eq(recipes.id, r.id));
    });

    repaired++;
    console.log(
      `✎ ${r.title}: ${current.length} -> ${newCount} składników (${parsed
        .map((g) => g.title || "—")
        .join(" / ")})`
    );
  }

  console.log(`\nNaprawiono: ${repaired} przepisów. Teraz uruchom: npx tsx scripts/estimate-macros.ts`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
