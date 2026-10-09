// Kształt imports.ai_draft (JSONB). Wcześniej `any` w trzech plikach; teraz
// jeden typ plus pomocnicze funkcje tolerujące stare drafty (frames: string[]).
import type { NutritionBreakdown } from "./nutrition-calc";
import type { QcIssue } from "./recipe-qc";

export type FrameInfo = { url: string; t: number | null; sharpness?: number | null };

export type DraftStep = {
  title: string | null;
  body: string;
  tip: string | null;
  image: string | null;
  // moment rolki, w którym krok się dzieje (z transkrypcji z czasami)
  startSec?: number | null;
  endSec?: number | null;
  // top-3 klatek od modelu przypisującego (URL-e), do ręcznej korekty
  frameCandidates?: string[];
};

export type AiFilled = {
  field: string;
  value: unknown;
  reason: string;
  basis: "caption" | "transcript" | "frames" | "inferred";
};

export type TranscriptSegment = { start: number; end: number; text: string };

export type ImportDraft = {
  title: string;
  lead: string;
  about: string;
  categorySlugs: string[];
  difficulty: string | null;
  ingredientGroups: { title: string | null; items: string[] }[];
  steps: DraftStep[];
  heroFrame: string | null;
  heroEnhanced: string | null;
  heroCandidates?: string[];
  frames: (string | FrameInfo)[];
  prepTimeMin: number | null;
  totalTimeMin: number | null;
  servings: number | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  tags: string[];
  confidence: "high" | "medium" | "low";
  notes: string | null;
  sponsor: { brand: string; code: string | null; note: string | null } | null;
  videoDurationSec: number | null;
  videoViews: number | null;
  transcriptSegments?: TranscriptSegment[] | null;
  // audyt kompletności (lib/import-review)
  review?: { issues: QcIssue[]; blocking: boolean } | null;
  nutrition?: NutritionBreakdown | null;
  aiFilled?: AiFilled[];
  refinedWith?: string | null;
  models?: { draft?: string; assign?: string; refine?: string; nutrition?: string } | null;
  // żądania obsługiwane przez workera (web ma media tylko do odczytu)
  enhanceRequest?: { frame: string } | null;
  enhanceError?: string | null;
  reassignRequest?: boolean | null;
  reassignError?: string | null;
  cleanupRequest?: { keep: string[] } | null;
};

export function frameInfos(draft: Pick<ImportDraft, "frames"> | null | undefined): FrameInfo[] {
  const raw = Array.isArray(draft?.frames) ? draft!.frames : [];
  return raw
    .map((f) => (typeof f === "string" ? { url: f, t: null } : f && typeof f.url === "string" ? f : null))
    .filter((f): f is FrameInfo => !!f);
}

export function frameUrls(draft: Pick<ImportDraft, "frames"> | null | undefined): string[] {
  return frameInfos(draft).map((f) => f.url);
}

export function ingredientLines(draft: Pick<ImportDraft, "ingredientGroups"> | null | undefined): string[] {
  return (draft?.ingredientGroups ?? [])
    .flatMap((g) => g?.items ?? [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);
}
