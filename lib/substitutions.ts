// Zamienniki składników ("Czym zastąpić?"). AI generuje szkice offline
// (scripts/generate-substitutions.ts), Roksana akceptuje w /admin/zamienniki,
// a strona przepisu pokazuje wyłącznie wiersze approved.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, dbSchema } from "./db";

const { substitutions, recipes } = dbSchema;

export type SubstitutionRow = typeof substitutions.$inferSelect;

/** Zaakceptowane zamienniki dla strony przepisu (tylko approved). */
export async function listApprovedSubstitutions(recipeId: number) {
  return db
    .select()
    .from(substitutions)
    .where(
      and(eq(substitutions.recipeId, recipeId), eq(substitutions.status, "approved"))
    )
    .orderBy(asc(substitutions.ingredientText));
}

export type DraftSubstitutionItem = {
  id: number;
  ingredientText: string;
  substitute: string;
  effect: string | null;
  kcalDelta: number | null;
};

export type DraftSubstitutionGroup = {
  recipeId: number;
  recipeTitle: string;
  recipeUri: string;
  items: DraftSubstitutionItem[];
};

/** Wszystkie szkice z tytułem przepisu, pogrupowane po przepisie (admin). */
export async function listDraftSubstitutionsGrouped(): Promise<DraftSubstitutionGroup[]> {
  const rows = await db
    .select({
      id: substitutions.id,
      recipeId: substitutions.recipeId,
      ingredientText: substitutions.ingredientText,
      substitute: substitutions.substitute,
      effect: substitutions.effect,
      kcalDelta: substitutions.kcalDelta,
      recipeTitle: recipes.title,
      recipeUri: recipes.uri,
    })
    .from(substitutions)
    .innerJoin(recipes, eq(recipes.id, substitutions.recipeId))
    .where(eq(substitutions.status, "draft"))
    // najświeższe przepisy na górze, w obrębie przepisu kolejność generowania
    .orderBy(desc(substitutions.recipeId), asc(substitutions.id));

  const groups = new Map<number, DraftSubstitutionGroup>();
  for (const r of rows) {
    let g = groups.get(r.recipeId);
    if (!g) {
      g = {
        recipeId: r.recipeId,
        recipeTitle: r.recipeTitle,
        recipeUri: r.recipeUri,
        items: [],
      };
      groups.set(r.recipeId, g);
    }
    g.items.push({
      id: r.id,
      ingredientText: r.ingredientText,
      substitute: r.substitute,
      effect: r.effect,
      kcalDelta: r.kcalDelta,
    });
  }
  return Array.from(groups.values());
}

/** Liczniki do nagłówka admina: ile szkiców, zaakceptowanych, odrzuconych. */
export async function countByStatus(): Promise<{
  draft: number;
  approved: number;
  rejected: number;
}> {
  const rows = await db
    .select({ status: substitutions.status, c: sql<number>`count(*)::int` })
    .from(substitutions)
    .groupBy(substitutions.status);

  const out = { draft: 0, approved: 0, rejected: 0 };
  for (const r of rows) out[r.status] = Number(r.c);
  return out;
}
