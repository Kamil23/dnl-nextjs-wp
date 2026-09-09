// Rdzeń generowania szkiców zamienników ("Czym zastąpić?"): jedno wywołanie
// OpenAI na przepis, wynik jako source=ai / status=draft do akceptu w adminie.
// Wołane z CLI (scripts/generate-substitutions.ts) i z workera (zlecenie z
// przycisku w /admin/zamienniki). Instancja drizzle od wołającego.
import { and, asc, desc, eq, notExists, sql } from "drizzle-orm";
import * as schema from "../db/schema";

const { recipes, ingredientGroups, ingredients, substitutions } = schema;

type AiItem = { ingredient: string; substitute: string; effect: string; kcalDelta: number };

export type SubstitutionsRunResult = {
  targets: number;
  done: number;
  inserted: number;
  skipped: number;
  failed: number;
};

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

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
  const parsed = JSON.parse(json.choices[0].message.content.replace(/^```json?\s*|\s*```$/g, ""));
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

export async function runSubstitutionsGenerate(
  db: any,
  log: (s: string) => void = () => {},
  opts: { limit?: number; recipeId?: number | null } = {}
): Promise<SubstitutionsRunResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Brak OPENAI_API_KEY w środowisku");
  }
  const limit = Math.max(1, opts.limit ?? 10);
  const recipeId = opts.recipeId ?? null;

  let targets: { id: number; title: string; kcal: number | null }[];
  if (recipeId != null) {
    targets = await db
      .select({ id: recipes.id, title: recipes.title, kcal: recipes.kcal })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    if (targets.length === 0) throw new Error(`Nie znaleziono przepisu o id ${recipeId}`);
  } else {
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
      log("Wszystkie opublikowane przepisy mają już zamienniki.");
      return { targets: 0, done: 0, inserted: 0, skipped: 0, failed: 0 };
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
    const items = rows.map((x: any) => x.rawText);
    if (items.length === 0) {
      skipped++;
      log(`- [${r.id}] ${r.title}: brak składników, pomijam`);
      continue;
    }

    try {
      const aiItems = await askForSubstitutions(r.title, r.kcal, items);

      const allowed = new Set(items);
      const seen = new Set<string>();
      let dropped = 0;
      const values: any[] = [];
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
          effect: typeof it?.effect === "string" && it.effect.trim() ? it.effect.trim() : null,
          kcalDelta: Number.isFinite(Number(it?.kcalDelta)) ? Math.round(Number(it.kcalDelta)) : 0,
          source: "ai",
          status: "draft",
        });
      }

      const toInsert = values.slice(0, 6);
      if (toInsert.length > 0) await db.insert(substitutions).values(toInsert);

      done++;
      inserted += toInsert.length;
      log(
        `✓ [${r.id}] ${r.title}: ${toInsert.length} ${plural(toInsert.length, "szkic", "szkice", "szkiców")}` +
          (dropped > 0 ? ` (odrzucono ${dropped})` : "")
      );
    } catch (e: any) {
      failed++;
      log(`✗ [${r.id}] ${r.title}: ${e?.message?.slice(0, 160)}`);
    }
  }

  log(
    `Gotowe: ${done} z ${targets.length} przepisów, ${inserted} szkiców jako draft, ${skipped} bez składników, ${failed} błędów.`
  );
  return { targets: targets.length, done, inserted, skipped, failed };
}
