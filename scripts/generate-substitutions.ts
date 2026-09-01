/**
 * Szkice zamienników składników ("Czym zastąpić?") generowane przez OpenAI.
 * Prekomputacja offline: jedno wywołanie na przepis, wynik ląduje w tabeli
 * substitutions jako source=ai, status=draft. Na stronę trafiają wyłącznie
 * wiersze zaakceptowane przez Roksanę w /admin/zamienniki.
 *
 * Uruchom: npx tsx scripts/generate-substitutions.ts [--limit N] [--recipe ID]
 *   --limit N    ile przepisów w tym biegu (domyślnie 10)
 *   --recipe ID  jeden przepis; generuje nawet, gdy ma już zamienniki
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, asc, desc, eq, notExists, sql } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema });
const { recipes, ingredientGroups, ingredients, substitutions } = schema;

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

type AiItem = { ingredient: string; substitute: string; effect: string; kcalDelta: number };

// Jedno wywołanie OpenAI na przepis (wzór: lib/server/estimate-macros.ts).
async function askForSubstitutions(
  title: string,
  kcal: number | null,
  items: string[]
): Promise<AiItem[]> {
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
            "Jesteś Roksaną, autorką polskiego bloga kulinarnego Dieta na luzie. " +
            "Piszesz ciepło i konkretnie, prostym językiem, bez wykładów. Nie używasz długiego myślnika. " +
            "Dla 3 do 6 najważniejszych składników przepisu podaj po jednym sprawdzonym zamienniku, " +
            "realnym kuchennie i pełniącym podobną rolę w przepisie. " +
            'Zwracasz WYŁĄCZNIE JSON: {"items":[{"ingredient": string, "substitute": string, "effect": string, "kcalDelta": int}]}. ' +
            "Zasady: ingredient to DOSŁOWNIE przepisana jedna pozycja z listy składników, znak w znak, " +
            "niczego nie skracaj ani nie poprawiaj. " +
            "substitute to konkretny zamiennik, z ilością gdy różni się od oryginału (np. 60 g erytrytolu zamiast 100 g cukru). " +
            "effect to jedna krótka fraza o wpływie na smak lub teksturę, " +
            'np. "ciasto będzie bardziej wilgotne, smak mniej kokosowy". ' +
            "kcalDelta to orientacyjna zmiana kalorii NA PORCJĘ po zamianie: liczba całkowita, " +
            "ujemna gdy wychodzi lżej, 0 gdy zmiana pomijalna. " +
            "Pomiń składniki bazowe, których nie da się sensownie zastąpić.",
        },
        {
          role: "user",
          content:
            `Przepis: ${title}\n` +
            `Kalorie na porcję: ${kcal ?? "nieznane"}\n` +
            `Lista składników (każda linia to jedna pozycja, przepisuj dosłownie):\n` +
            items.join("\n"),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const parsed = JSON.parse(
    json.choices[0].message.content.replace(/^```json?\s*|\s*```$/g, "")
  );
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "Brak OPENAI_API_KEY w środowisku (.env). Uzupełnij klucz i uruchom ponownie."
    );
    await client.end();
    process.exit(1);
  }

  const limit = Math.max(1, parseInt(argValue("--limit") ?? "10", 10) || 10);
  const recipeArg = argValue("--recipe");
  const recipeId = recipeArg != null ? parseInt(recipeArg, 10) : null;
  if (recipeArg != null && !Number.isInteger(recipeId)) {
    console.error(`Nieprawidłowe --recipe: ${recipeArg} (podaj liczbowe ID przepisu).`);
    await client.end();
    process.exit(1);
  }

  let targets: { id: number; title: string; kcal: number | null }[];
  if (recipeId != null) {
    // Jawny przepis: generuj nawet, gdy ma już zamienniki (dojdą kolejne szkice)
    targets = await db
      .select({ id: recipes.id, title: recipes.title, kcal: recipes.kcal })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    if (targets.length === 0) {
      console.error(`Nie znaleziono przepisu o id ${recipeId}.`);
      await client.end();
      process.exit(1);
    }
  } else {
    // Opublikowane przepisy (bez artykułów), które nie mają jeszcze ŻADNYCH
    // wierszy w substitutions (szkiców, zaakceptowanych ani odrzuconych)
    targets = await db
      .select({ id: recipes.id, title: recipes.title, kcal: recipes.kcal })
      .from(recipes)
      .where(
        and(
          eq(recipes.status, "published"),
          sql`${recipes.uri} not like '/artykuly/%'`,
          notExists(
            db
              .select({ one: sql`1` })
              .from(substitutions)
              .where(eq(substitutions.recipeId, recipes.id))
          )
        )
      )
      .orderBy(desc(recipes.publishedAt))
      .limit(limit);
    if (targets.length === 0) {
      console.log(
        "Wszystkie opublikowane przepisy mają już zamienniki. Użyj --recipe ID, aby dogenerować dla konkretnego."
      );
      await client.end();
      process.exit(0);
    }
  }

  let done = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of targets) {
    const rows = await db
      .select({ rawText: ingredients.rawText })
      .from(ingredientGroups)
      .innerJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
      .where(eq(ingredientGroups.recipeId, r.id))
      .orderBy(asc(ingredientGroups.position), asc(ingredients.position));
    const items = rows.map((x) => x.rawText);
    if (items.length === 0) {
      skipped++;
      console.log(`- [${r.id}] ${r.title}: brak składników, pomijam`);
      continue;
    }

    try {
      const aiItems = await askForSubstitutions(r.title, r.kcal, items);

      // Twarda walidacja: ingredient musi być dosłowną (===) pozycją z listy
      const allowed = new Set(items);
      const seen = new Set<string>();
      let dropped = 0;
      const values: (typeof substitutions.$inferInsert)[] = [];
      for (const it of aiItems) {
        const ingredient = typeof it?.ingredient === "string" ? it.ingredient : "";
        const substitute = typeof it?.substitute === "string" ? it.substitute.trim() : "";
        if (!allowed.has(ingredient) || !substitute || seen.has(ingredient)) {
          dropped++;
          continue;
        }
        seen.add(ingredient);
        values.push({
          recipeId: r.id,
          ingredientText: ingredient,
          substitute,
          effect:
            typeof it?.effect === "string" && it.effect.trim() ? it.effect.trim() : null,
          kcalDelta: Number.isFinite(Number(it?.kcalDelta))
            ? Math.round(Number(it.kcalDelta))
            : 0,
          source: "ai",
          status: "draft",
        });
      }

      const toInsert = values.slice(0, 6);
      if (toInsert.length > 0) await db.insert(substitutions).values(toInsert);

      done++;
      inserted += toInsert.length;
      console.log(
        `✓ [${r.id}] ${r.title}: ${toInsert.length} ${plural(
          toInsert.length,
          "szkic",
          "szkice",
          "szkiców"
        )}${dropped > 0 ? ` (odrzucono ${dropped} niepasujących do listy składników)` : ""}`
      );
    } catch (e: any) {
      failed++;
      console.warn(`✗ [${r.id}] ${r.title}: ${e?.message?.slice(0, 160)}`);
    }
  }

  console.log(
    `\nGotowe: ${done} z ${targets.length} przepisów, ${inserted} ${plural(
      inserted,
      "szkic",
      "szkice",
      "szkiców"
    )} zapisanych jako draft, ${skipped} bez składników, ${failed} błędów.`
  );
  if (inserted > 0) {
    console.log("Przejrzyj i zaakceptuj w /admin/zamienniki.");
  }
  await client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
