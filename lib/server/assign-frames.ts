// Etap "przypisanie klatek": osobne wywołanie vision po drafcie. Model dostaje
// WSZYSTKIE unikalne klatki jako miniatury z czasem oraz listę kroków z oknami
// czasowymi i dla każdego kroku wskazuje do 3 kandydatów z oceną. Domknięcie
// (unikalność, chronologia, okno) robi lib/frame-assign w kodzie.
import fs from "fs";
import { chatJson, type ChatPart } from "./ai-chat";
import { resolveAssignments, type AssignResult, type FrameCandidate } from "../frame-assign";
import type { FrameInfo } from "../import-draft";

const SYSTEM =
  "Dobierasz zdjęcia do kroków przepisu kulinarnego z klatek rolki TikTok. Klatki są ponumerowane chronologicznie " +
  "i mają podany czas (sekundy od początku). Dla KAŻDEGO kroku wskaż do 3 klatek, które najlepiej pokazują czynność " +
  "z tego kroku (mieszanie, smażenie, nakładanie, krojenie), z oceną score 0-1 i krótkim 'why'. " +
  "Zasady: klatka ma pokazywać CZYNNOŚĆ lub efekt kroku, nie planszę tytułową ani napis; autorka w kadrze jest w porządku, " +
  "jeśli widać, co robi; unikaj klatek z dużymi nałożonymi napisami; klatki kroku powinny być w czasie zbliżonym do " +
  "podanego okna kroku (jeśli jest). Gdy żadna klatka nie pasuje, zwróć pustą listę zamiast naciągać. " +
  "Do hero wybierz do 3 klatek z gotowym, wyeksponowanym daniem: ostre, apetyczne, jak najmniej napisów. " +
  'Odpowiadasz WYŁĄCZNIE JSON-em: {"steps":[{"i":int,"candidates":[{"frame":int,"score":number,"why":string}]}],"hero":[{"frame":int,"score":number}]}.';

export type AssignStepsInput = {
  title: string;
  steps: { body: string; title?: string | null; startSec?: number | null; endSec?: number | null }[];
  frames: (FrameInfo & { thumbPath: string })[];
  model: string;
};

export async function assignFramesWithAi(input: AssignStepsInput): Promise<AssignResult> {
  const parts: ChatPart[] = [];
  input.frames.forEach((f, i) => {
    parts.push({ type: "text", text: `Klatka ${i + 1} (t=${f.t != null ? Math.round(f.t) : "?"} s):` });
    parts.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(f.thumbPath).toString("base64")}`, detail: "low" },
    });
  });
  const stepsText = input.steps
    .map((s, i) => {
      const win =
        s.startSec != null || s.endSec != null ? ` [czas ${s.startSec ?? "?"}-${s.endSec ?? "?"} s]` : "";
      return `${i + 1}.${win} ${s.title ? s.title + ": " : ""}${s.body}`;
    })
    .join("\n");
  parts.push({ type: "text", text: `Przepis: ${input.title}\n\nKroki:\n${stepsText}` });

  const { data } = await chatJson<{
    steps?: { i: number; candidates?: FrameCandidate[] }[];
    hero?: FrameCandidate[];
  }>({ model: input.model, system: SYSTEM, user: parts, maxTokens: 3000 });

  const candidates: FrameCandidate[][] = input.steps.map(() => []);
  for (const s of data.steps ?? []) {
    const i = Math.round(Number(s?.i)) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= candidates.length) continue;
    candidates[i] = (Array.isArray(s.candidates) ? s.candidates : []).slice(0, 5);
  }
  return resolveAssignments({
    frames: input.frames,
    steps: input.steps.map((s) => ({ startSec: s.startSec ?? null, endSec: s.endSec ?? null })),
    candidates,
    hero: Array.isArray(data.hero) ? data.hero.slice(0, 5) : [],
  });
}
