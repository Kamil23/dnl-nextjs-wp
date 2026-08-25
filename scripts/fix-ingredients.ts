/**
 * One-shot ingredient audit for published recipes:
 *  - makes implicit amounts explicit ("jajko" -> "1 jajko", "łyżka X" ->
 *    "1 łyżka X") WITHOUT inventing any numbers,
 *  - reports ingredients that genuinely lack an amount (operator decides).
 * Run: npx tsx scripts/fix-ingredients.ts        (report + apply)
 *      npx tsx scripts/fix-ingredients.ts --dry  (report only)
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });
const { recipes, ingredientGroups, ingredients } = schema;
const DRY = process.argv.includes("--dry");

async function audit(title: string, items: string[]) {
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
            "Audytujesz listę składników przepisu. Dla KAŻDEGO składnika zwróć obiekt " +
            '{"text": string, "status": "ok"|"normalized"|"missing"}.\n' +
            "- normalized: TYLKO ujawnienie domyślnej ilości, np. 'jajko' -> '1 jajko', " +
            "'łyżka miodu' -> '1 łyżka miodu', 'szklanka mleka' -> '1 szklanka mleka'. " +
            "NIE WOLNO wymyślać liczb, których nie ma w tekście!\n" +
            "- missing: składnik bez żadnej ilości, której nie da się bezpiecznie założyć " +
            "(np. 'mąka pszenna', 'ser biały') - text zostaw bez zmian.\n" +
            "- ok: ma ilość albo celowo jej nie potrzebuje ('sól do smaku', 'oliwa do smażenia', " +
            "'aromat waniliowy', przyprawy do smaku).\n" +
            'Zwróć JSON: {"items": [...]} - dokładnie tyle pozycji, ile dostałeś, w tej samej kolejności.',
        },
        { role: "user", content: `Przepis: ${title}\n${JSON.stringify(items)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const parsed = JSON.parse(
    json.choices[0].message.content.replace(/^```json?\s*|\s*```$/g, "")
  );
  return parsed.items as { text: string; status: string }[];
}

async function main() {
  const all = await db.select().from(recipes).where(eq(recipes.status, "published"));
  let normalized = 0;
  const missing: string[] = [];

  for (const r of all) {
    const rows = await db
      .select({ id: ingredients.id, rawText: ingredients.rawText })
      .from(ingredientGroups)
      .innerJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
      .where(eq(ingredientGroups.recipeId, r.id))
      .orderBy(ingredientGroups.position, ingredients.position);
    if (rows.length === 0) continue;

    try {
      const result = await audit(r.title, rows.map((x) => x.rawText));
      if (result.length !== rows.length) {
        console.warn(`⚠ ${r.title}: liczba pozycji się nie zgadza - pomijam`);
        continue;
      }
      for (let i = 0; i < rows.length; i++) {
        const { text, status } = result[i];
        if (status === "normalized" && text !== rows[i].rawText) {
          console.log(`  ✎ [${r.title}] "${rows[i].rawText}" -> "${text}"`);
          normalized++;
          if (!DRY) {
            await db.update(ingredients).set({ rawText: text }).where(eq(ingredients.id, rows[i].id));
          }
        } else if (status === "missing") {
          missing.push(`[${r.title}] ${rows[i].rawText}`);
        }
      }
    } catch (e: any) {
      console.warn(`✗ ${r.title}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log(`\n== PODSUMOWANIE ==`);
  console.log(`Ujawnione domyślne ilości: ${normalized}${DRY ? " (dry-run, nic nie zapisano)" : ""}`);
  console.log(`\nSkładniki BEZ ilości - do uzupełnienia w adminie (${missing.length}):`);
  for (const m of missing) console.log(`  ? ${m}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
