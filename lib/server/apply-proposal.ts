// Zastosowanie / cofnięcie jednej propozycji z audytu (recipe_proposals).
// Zapis punktowy po ścieżce pola, w transakcji, z kontrolą QC po zapisie:
// jeśli zmiana wprowadza NOWY błąd QC (lib/recipe-qc), transakcja się cofa,
// a propozycja dostaje status failed z powodem. `before` w wierszu pozwala
// odwrócić zmianę jeden do jednego. Przyjmuje instancję drizzle od wołającego
// (API w web albo skrypt), jak lib/search-sync.
import { and, asc, eq, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { checkRecipe, type QcIssue } from "../recipe-qc";

const { recipes, ingredientGroups, ingredients, steps } = schema;

export type ParsedPath =
  | { kind: "field"; field: RecipeField }
  | { kind: "ingredient"; g: number; i: number }
  | { kind: "step"; n: number; key: "body" | "title" | "tip" };

const INT_FIELDS = ["servings", "kcal", "prepTimeMin", "cookTimeMin", "totalTimeMin"] as const;
const NUM_FIELDS = ["protein", "fat", "carbs"] as const;
const TEXT_FIELDS = ["title", "lead", "servingsText", "difficulty"] as const;
type RecipeField = (typeof INT_FIELDS)[number] | (typeof NUM_FIELDS)[number] | (typeof TEXT_FIELDS)[number];
const ALL_FIELDS: string[] = [...INT_FIELDS, ...NUM_FIELDS, ...TEXT_FIELDS];

export function parsePath(path: string): ParsedPath | null {
  if (ALL_FIELDS.includes(path)) return { kind: "field", field: path as RecipeField };
  let m = path.match(/^ingredientGroups\[(\d+)\]\.items\[(\d+)\]$/);
  if (m) return { kind: "ingredient", g: Number(m[1]), i: Number(m[2]) };
  m = path.match(/^steps\[(\d+)\]\.(body|title|tip)$/);
  if (m) return { kind: "step", n: Number(m[1]), key: m[2] as "body" | "title" | "tip" };
  return null;
}

export function isAllowedPath(path: string): boolean {
  return parsePath(path) !== null;
}

async function loadIngredientRow(db: any, recipeId: number, g: number, i: number) {
  const groups = await db
    .select({ id: ingredientGroups.id })
    .from(ingredientGroups)
    .where(eq(ingredientGroups.recipeId, recipeId))
    .orderBy(asc(ingredientGroups.position));
  const group = groups[g];
  if (!group) return null;
  const rows = await db
    .select({ id: ingredients.id, rawText: ingredients.rawText })
    .from(ingredients)
    .where(eq(ingredients.groupId, group.id))
    .orderBy(asc(ingredients.position));
  return rows[i] ?? null;
}

async function loadStepRow(db: any, recipeId: number, n: number) {
  const rows = await db
    .select({ id: steps.id, body: steps.body, title: steps.title, tip: steps.tip })
    .from(steps)
    .where(eq(steps.recipeId, recipeId))
    .orderBy(asc(steps.position));
  return rows[n] ?? null;
}

// Aktualna wartość pola wskazanego ścieżką (do `before` i do kontroli, czy
// ktoś nie zmienił pola w międzyczasie)
export async function readValue(db: any, recipeId: number, path: string): Promise<unknown> {
  const p = parsePath(path);
  if (!p) throw new Error(`Nieobsługiwana ścieżka: ${path}`);
  if (p.kind === "field") {
    const [r] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    if (!r) throw new Error("Przepis nie istnieje");
    const v = r[p.field];
    return v == null ? null : (NUM_FIELDS as readonly string[]).includes(p.field) ? Number(v) : v;
  }
  if (p.kind === "ingredient") {
    const row = await loadIngredientRow(db, recipeId, p.g, p.i);
    return row ? row.rawText : undefined;
  }
  const row = await loadStepRow(db, recipeId, p.n);
  return row ? row[p.key] : undefined;
}

async function writeValue(tx: any, recipeId: number, path: string, value: unknown) {
  const p = parsePath(path)!;
  if (p.kind === "field") {
    let v: unknown = value;
    if ((INT_FIELDS as readonly string[]).includes(p.field)) {
      const n = value == null || value === "" ? null : Math.round(Number(value));
      if (n != null && !Number.isFinite(n)) throw new Error(`Niepoprawna liczba dla ${p.field}`);
      v = n;
    } else if ((NUM_FIELDS as readonly string[]).includes(p.field)) {
      const n = value == null || value === "" ? null : Number(value);
      if (n != null && !Number.isFinite(n)) throw new Error(`Niepoprawna liczba dla ${p.field}`);
      v = n == null ? null : String(n);
    } else {
      v = value == null ? null : String(value);
      if (p.field === "title" && !String(v).trim()) throw new Error("Tytuł nie może być pusty");
      if (p.field === "difficulty" && v != null && !["latwy", "sredni", "trudny"].includes(String(v))) {
        throw new Error("Niepoprawna trudność");
      }
    }
    await tx.update(recipes).set({ [p.field]: v, updatedAt: new Date() }).where(eq(recipes.id, recipeId));
    return;
  }
  if (p.kind === "ingredient") {
    const row = await loadIngredientRow(tx, recipeId, p.g, p.i);
    if (!row) throw new Error(`Składnik ${path} nie istnieje`);
    const text = String(value ?? "").trim();
    if (!text) throw new Error("Składnik nie może być pusty");
    // zmieniony tekst unieważnia strukturę amount/unit/name z importu
    await tx.update(ingredients).set({ rawText: text, amount: null, unit: null, name: null }).where(eq(ingredients.id, row.id));
    await tx.update(recipes).set({ updatedAt: new Date() }).where(eq(recipes.id, recipeId));
    return;
  }
  const row = await loadStepRow(tx, recipeId, p.n);
  if (!row) throw new Error(`Krok ${path} nie istnieje`);
  const text = value == null ? null : String(value);
  if (p.key === "body" && !text?.trim()) throw new Error("Treść kroku nie może być pusta");
  await tx.update(steps).set({ [p.key]: text }).where(eq(steps.id, row.id));
  await tx.update(recipes).set({ updatedAt: new Date() }).where(eq(recipes.id, recipeId));
}

export async function qcIssuesFor(db: any, recipeId: number): Promise<QcIssue[]> {
  const [r] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!r) return [];
  const [ingC] = await db
    .select({ c: sql<number>`count(${ingredients.id})::int` })
    .from(ingredientGroups)
    .leftJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
    .where(eq(ingredientGroups.recipeId, recipeId));
  const [stepC] = await db.select({ c: sql<number>`count(*)::int` }).from(steps).where(eq(steps.recipeId, recipeId));
  return checkRecipe({
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
    ingredientCount: Number(ingC?.c ?? 0),
    stepCount: Number(stepC?.c ?? 0),
    hasContentHtml: (r.contentHtml?.length ?? 0) > 50,
  });
}

export type ApplyResult = {
  ok: boolean;
  status: "applied" | "reverted" | "failed";
  note: string | null;
  recipeId: number;
  uri: string | null;
};

// mode "apply": zapisuje `after`, mode "revert": przywraca `before`
export async function applyProposal(db: any, proposalId: number, mode: "apply" | "revert"): Promise<ApplyResult> {
  const [prop] = await db.select().from(schema.recipeProposals).where(eq(schema.recipeProposals.id, proposalId));
  if (!prop) throw new Error("Propozycja nie istnieje");
  if (mode === "apply" && prop.status !== "pending" && prop.status !== "failed") {
    throw new Error(`Propozycja ma status ${prop.status}`);
  }
  if (mode === "revert" && prop.status !== "applied") throw new Error("Cofnąć można tylko zastosowaną propozycję");
  if (!isAllowedPath(prop.path)) throw new Error(`Nieobsługiwana ścieżka: ${prop.path}`);

  const [rec] = await db.select({ uri: recipes.uri }).from(recipes).where(eq(recipes.id, prop.recipeId));
  const uri = rec?.uri ?? null;
  const value = mode === "apply" ? prop.after : prop.before;
  const errorsBefore = new Set(
    (await qcIssuesFor(db, prop.recipeId)).filter((i) => i.severity === "error").map((i) => i.code)
  );

  let note: string | null = null;
  try {
    await db.transaction(async (tx: any) => {
      // `before` z chwili zastosowania: operator mógł edytować przepis po audycie
      if (mode === "apply") {
        const current = await readValue(tx, prop.recipeId, prop.path);
        if (current === undefined) throw new Error("Pole już nie istnieje w przepisie");
        if (JSON.stringify(current) !== JSON.stringify(prop.before ?? null)) {
          note = `Uwaga: pole miało inną wartość niż w audycie (${JSON.stringify(current)}); zapisano mimo to, cofnięcie przywróci tę wartość.`;
          await tx.update(schema.recipeProposals).set({ before: current }).where(eq(schema.recipeProposals.id, proposalId));
        }
      }
      await writeValue(tx, prop.recipeId, prop.path, value);
      const errorsAfter = (await qcIssuesFor(tx, prop.recipeId)).filter((i) => i.severity === "error");
      const fresh = errorsAfter.filter((i) => !errorsBefore.has(i.code));
      if (fresh.length) {
        throw new Error(`Zmiana wprowadza błąd QC: ${fresh.map((i) => i.message).join(" ")}`);
      }
      await tx
        .update(schema.recipeProposals)
        .set(
          mode === "apply"
            ? { status: "applied", appliedAt: new Date(), note }
            : { status: "reverted", revertedAt: new Date(), note }
        )
        .where(eq(schema.recipeProposals.id, proposalId));
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 400);
    if (mode === "apply") {
      await db.update(schema.recipeProposals).set({ status: "failed", note: msg }).where(eq(schema.recipeProposals.id, proposalId));
    }
    return { ok: false, status: "failed", note: msg, recipeId: prop.recipeId, uri };
  }
  return { ok: true, status: mode === "apply" ? "applied" : "reverted", note, recipeId: prop.recipeId, uri };
}

export async function rejectProposal(db: any, proposalId: number) {
  await db
    .update(schema.recipeProposals)
    .set({ status: "rejected" })
    .where(and(eq(schema.recipeProposals.id, proposalId), eq(schema.recipeProposals.status, "pending")));
}
