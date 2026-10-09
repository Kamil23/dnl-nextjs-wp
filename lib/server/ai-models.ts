// Modele per etap importu, przestawiane z panelu (/admin/tiktok, sekcja
// "Ustawienia AI") bez redeploya. Zapis w app_settings pod kluczem ai_models;
// brak wpisu = wartości z env.
//
//   draft     - czytanie rolki (vision): tekst przepisu, kroki, czasy
//   refine    - dopełnianie braków w drafcie (tekst, mocniejszy model)
//   nutrition - gramy składników i tabela per 100 g (tekst, mocniejszy model)
//
// Klasyfikacja backlogu nadal używa OPENAI_CHEAP_MODEL (osobny, najtańszy).
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

export type AiStage = "draft" | "refine" | "nutrition";
export type AiModels = Record<AiStage, string>;

export const AI_MODELS_KEY = "ai_models";

export const AI_STAGE_LABELS: Record<AiStage, { label: string; hint: string }> = {
  draft: {
    label: "Draft z wideo",
    hint: "Ogląda klatki i czyta transkrypcję. Tani model wystarcza (ok. 0,01 $ za import).",
  },
  refine: {
    label: "Dopełnianie braków",
    hint: "Uzupełnia ilości, porcje i czasy, gdy pewność nie jest wysoka. Mocny model (ok. 0,02 $).",
  },
  nutrition: {
    label: "Wartości odżywcze",
    hint: "Gramy składników i tabela per 100 g. Tu liczy się dokładność: mocny model (ok. 0,03 $).",
  },
};

export function defaultAiModels(): AiModels {
  const fast = process.env.OPENAI_MODEL || "gpt-4o";
  const strong = process.env.OPENAI_STRONG_MODEL || "gpt-6-sol";
  return { draft: fast, refine: strong, nutrition: strong };
}

const MODEL_ID_RE = /^[a-z0-9][a-z0-9.\-_:]{1,80}$/i;

export function isValidModelId(id: unknown): id is string {
  return typeof id === "string" && MODEL_ID_RE.test(id);
}

export async function getAiModels(db: any): Promise<AiModels> {
  const defaults = defaultAiModels();
  try {
    const [row] = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, AI_MODELS_KEY));
    const stored = (row?.value ?? {}) as Partial<Record<AiStage, unknown>>;
    return {
      draft: isValidModelId(stored.draft) ? stored.draft : defaults.draft,
      refine: isValidModelId(stored.refine) ? stored.refine : defaults.refine,
      nutrition: isValidModelId(stored.nutrition) ? stored.nutrition : defaults.nutrition,
    };
  } catch {
    return defaults;
  }
}

export async function saveAiModels(db: any, patch: Partial<AiModels>): Promise<AiModels> {
  const current = await getAiModels(db);
  const next: AiModels = { ...current };
  for (const stage of ["draft", "refine", "nutrition"] as AiStage[]) {
    const v = patch[stage];
    if (v === undefined) continue;
    if (!isValidModelId(v)) throw new Error(`Niepoprawny identyfikator modelu dla etapu ${stage}`);
    next[stage] = v;
  }
  await db
    .insert(schema.appSettings)
    .values({ key: AI_MODELS_KEY, value: next })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: next, updatedAt: new Date() } });
  return next;
}
