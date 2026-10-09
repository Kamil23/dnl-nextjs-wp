// Deterministyczne domknięcie przypisania klatek do kroków. Model (vision)
// daje tylko kandydatów z oceną; tutaj egzekwujemy to, czego prompt nie
// gwarantuje: jedna klatka do jednego kroku, chronologia wzdłuż kroków,
// okno czasowe kroku, a gdy nic nie pasuje - brak zdjęcia zamiast naciągania.
// Czysta funkcja, bez I/O, do testów jednostkowych.
import type { FrameInfo } from "./import-draft";

export type FrameCandidate = { frame: number; score: number; why?: string };
export type StepWindow = { startSec: number | null; endSec: number | null };

export type AssignInput = {
  frames: FrameInfo[]; // indeks w tablicy = numer klatki - 1
  steps: StepWindow[];
  candidates: FrameCandidate[][]; // per krok, posortowane dowolnie
  hero: FrameCandidate[];
};

export type AssignResult = {
  stepImages: (number | null)[]; // indeks klatki (0-based) lub null
  stepCandidates: number[][]; // top-3 indeksów po walidacji, do panelu
  heroIndex: number | null;
  heroCandidates: number[];
};

const WINDOW_SLACK = 3;

function inWindow(t: number | null, w: StepWindow): boolean {
  if (t == null) return true;
  if (w.startSec == null && w.endSec == null) return true;
  const lo = (w.startSec ?? w.endSec ?? 0) - WINDOW_SLACK;
  const hi = (w.endSec ?? w.startSec ?? Infinity) + WINDOW_SLACK;
  return t >= lo && t <= hi;
}

function validIndex(n: number, len: number): number | null {
  const i = Math.round(Number(n)) - 1;
  return Number.isInteger(i) && i >= 0 && i < len ? i : null;
}

// Najostrzejsza klatka z okna czasowego kroku (fallback), pomijając zajęte
function sharpestInWindow(frames: FrameInfo[], w: StepWindow, taken: Set<number>): number | null {
  if (w.startSec == null && w.endSec == null) return null;
  let best: number | null = null;
  let bestSharp = -1;
  frames.forEach((f, i) => {
    if (taken.has(i) || !inWindow(f.t, w)) return;
    const s = f.sharpness ?? 0;
    if (s > bestSharp) {
      bestSharp = s;
      best = i;
    }
  });
  return best;
}

export function resolveAssignments(input: AssignInput): AssignResult {
  const len = input.frames.length;
  const taken = new Set<number>();

  // Kandydaci po walidacji: istniejące klatki, w oknie czasowym, sortowane po score
  const perStep = input.steps.map((w, si) =>
    (input.candidates[si] ?? [])
      .map((c) => ({ i: validIndex(c.frame, len), score: Number(c.score) || 0 }))
      .filter((c): c is { i: number; score: number } => c.i != null && inWindow(input.frames[c.i].t, w))
      .sort((a, b) => b.score - a.score)
  );

  // Rozstrzyganie konfliktów: globalnie od najwyższego score
  const claims = perStep
    .flatMap((cands, si) => cands.map((c) => ({ si, i: c.i, score: c.score })))
    .sort((a, b) => b.score - a.score);
  const chosen: (number | null)[] = input.steps.map(() => null);
  for (const c of claims) {
    if (chosen[c.si] != null || taken.has(c.i)) continue;
    chosen[c.si] = c.i;
    taken.add(c.i);
  }

  // Chronologia: czas klatek nie może cofać się wzdłuż kroków. Naruszenie
  // zastępujemy najostrzejszą klatką z okna kroku (albo zostawiamy pusto).
  let lastT = -Infinity;
  for (let si = 0; si < chosen.length; si++) {
    const i = chosen[si];
    if (i == null) {
      const fb = sharpestInWindow(input.frames, input.steps[si], taken);
      if (fb != null) {
        chosen[si] = fb;
        taken.add(fb);
      }
      continue;
    }
    const t = input.frames[i].t;
    if (t != null && t < lastT) {
      taken.delete(i);
      const fb = sharpestInWindow(input.frames, input.steps[si], taken);
      chosen[si] = fb;
      if (fb != null) taken.add(fb);
    }
    const t2 = chosen[si] != null ? input.frames[chosen[si]!].t : null;
    if (t2 != null) lastT = Math.max(lastT, t2);
  }

  const heroValid = input.hero
    .map((c) => ({ i: validIndex(c.frame, len), score: Number(c.score) || 0 }))
    .filter((c): c is { i: number; score: number } => c.i != null)
    .sort((a, b) => b.score - a.score);

  return {
    stepImages: chosen,
    stepCandidates: perStep.map((cands, si) => {
      const ids = cands.map((c) => c.i);
      const cur = chosen[si];
      if (cur != null && !ids.includes(cur)) ids.unshift(cur);
      return Array.from(new Set(ids)).slice(0, 3);
    }),
    heroIndex: heroValid[0]?.i ?? null,
    heroCandidates: Array.from(new Set(heroValid.map((c) => c.i))).slice(0, 3),
  };
}
