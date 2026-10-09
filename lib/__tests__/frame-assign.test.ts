import { describe, expect, it } from "vitest";
import { resolveAssignments } from "../frame-assign";

const frames = (ts: number[], sharp?: number[]) => ts.map((t, i) => ({ url: `f${i + 1}`, t, sharpness: sharp?.[i] ?? 100 }));

describe("resolveAssignments", () => {
  it("picks the best candidate per step and keeps frames unique", () => {
    const r = resolveAssignments({
      frames: frames([1, 5, 10, 15]),
      steps: [{ startSec: null, endSec: null }, { startSec: null, endSec: null }],
      candidates: [
        [{ frame: 2, score: 0.9 }, { frame: 3, score: 0.5 }],
        [{ frame: 2, score: 0.8 }, { frame: 4, score: 0.7 }],
      ],
      hero: [{ frame: 4, score: 0.9 }, { frame: 1, score: 0.3 }],
    });
    expect(r.stepImages).toEqual([1, 3]);
    expect(r.heroIndex).toBe(3);
    expect(r.heroCandidates).toEqual([3, 0]);
  });

  it("drops candidates outside the step time window", () => {
    const r = resolveAssignments({
      frames: frames([1, 20, 40]),
      steps: [{ startSec: 0, endSec: 5 }],
      candidates: [[{ frame: 3, score: 0.95 }, { frame: 1, score: 0.4 }]],
      hero: [],
    });
    expect(r.stepImages).toEqual([0]);
  });

  it("enforces chronology, falling back to the sharpest frame in the window", () => {
    const r = resolveAssignments({
      frames: frames([2, 12, 22, 24], [10, 10, 30, 90]),
      steps: [
        { startSec: 20, endSec: 25 },
        { startSec: 0, endSec: 14 },
        { startSec: 20, endSec: 25 },
      ],
      candidates: [[{ frame: 3, score: 0.9 }], [{ frame: 2, score: 0.9 }], [{ frame: 1, score: 0.9 }]],
      hero: [],
    });
    // step 2 would go back in time (t=12 after t=22) -> replaced by sharpest free frame in its window (f1, t=2)
    expect(r.stepImages[0]).toBe(2);
    expect(r.stepImages[1]).toBe(0);
    // step 3: candidate f1 is outside window, fallback = sharpest free frame in 20-25 (f4)
    expect(r.stepImages[2]).toBe(3);
  });

  it("leaves a step without image when nothing fits and there is no window", () => {
    const r = resolveAssignments({
      frames: frames([1, 2]),
      steps: [{ startSec: null, endSec: null }],
      candidates: [[{ frame: 9, score: 1 }]],
      hero: [],
    });
    expect(r.stepImages).toEqual([null]);
    expect(r.stepCandidates).toEqual([[]]);
  });
});
