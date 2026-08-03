/**
 * One-shot: estimate kcal/protein/fat/carbs per serving for published
 * recipes that have ingredients but no kcal (the WP-imported ones).
 * Values land in the recipe (nutrition in the Recipe schema) and are
 * editable in the admin afterwards.
 * Run: npx tsx scripts/estimate-macros.ts
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });
const { recipes, ingredientGroups, ingredients } = schema;

async function estimate(title: string, servings: number | null, items: string[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Jesteś dietetykiem. Szacujesz wartości odżywcze przepisu NA JEDNĄ PORCJĘ na podstawie listy składników. " +
            "Zwracasz WYŁĄCZNIE JSON: {\"kcal\": int, \"protein\": number, \"fat\": number, \"carbs\": number, \"assumedServings\": int}. " +
            "assumedServings = liczba porcji użyta do podziału (podana albo Twoje realistyczne założenie, np. ciasto ~12 kawałków). " +
            "Wartości realistyczne; gramy zaokrąglaj do 1 miejsca.",
        },
        {
          role: "user",
          content: `Przepis: ${title}\nLiczba porcji: ${servings ?? "nieznana — załóż realistyczną i zwróć w assumedServings"}\nSkładniki:\n${items.join("\n")}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content.replace(/^```json?\s*|\s*```$/g, ""));
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Brak OPENAI_API_KEY");

  // Every recipe with ingredients and no kcal — drafts included, so
  // TikTok imports awaiting review get macros too
  const targets = await db.select().from(recipes).where(isNull(recipes.kcal));

  let done = 0, skipped = 0, failed = 0;
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
      const m = await estimate(r.title, r.servings, items);
      if (!m.kcal || m.kcal < 20 || m.kcal > 3000) throw new Error(`podejrzane kcal: ${m.kcal}`);
      // kcal/porcję ma sens tylko przy jawnej liczbie porcji — gdy jej nie
      // było, zapisujemy założenie modelu (operator może poprawić)
      const patch: any = {
        kcal: Math.round(m.kcal),
        protein: m.protein != null ? String(m.protein) : null,
        fat: m.fat != null ? String(m.fat) : null,
        carbs: m.carbs != null ? String(m.carbs) : null,
      };
      if (!r.servings && m.assumedServings > 0) {
        patch.servings = Math.round(m.assumedServings);
        patch.servingsText = `ok. ${Math.round(m.assumedServings)} porcji`;
      }
      await db.update(recipes).set(patch).where(eq(recipes.id, r.id));
      done++;
      console.log(`✓ ${r.title}: ${Math.round(m.kcal)} kcal/porcję (${r.servings ?? `założono ${m.assumedServings}`} porcji) | B ${m.protein} T ${m.fat} W ${m.carbs}`);
    } catch (e: any) {
      failed++;
      console.warn(`✗ ${r.title}: ${e.message?.slice(0, 120)}`);
    }
  }
  console.log(`\nGotowe: ${done} uzupełnionych, ${skipped} bez składników, ${failed} błędów.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
