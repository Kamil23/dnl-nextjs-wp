import { describe, expect, it } from "vitest";
import { atwaterCheck, breakdownIssues, computeTotals, gramsFromMeasure, perServing, recompute, type NutritionItem } from "../nutrition-calc";

describe("gramsFromMeasure", () => {
  it("uses the measures table for household units", () => {
    expect(gramsFromMeasure("pół szklanki mąki pszennej")).toMatchObject({ grams: 80, source: "measure-table" });
    expect(gramsFromMeasure("2 łyżki oleju rzepakowego")).toMatchObject({ grams: 28, source: "measure-table" });
    expect(gramsFromMeasure("łyżka miodu")).toMatchObject({ grams: 21, source: "measure-table" });
  });
  it("takes stated weights and volumes", () => {
    expect(gramsFromMeasure("200 g twarogu")).toMatchObject({ grams: 200, source: "stated" });
    expect(gramsFromMeasure("1,5 kg ziemniaków")).toMatchObject({ grams: 1500, source: "stated" });
    expect(gramsFromMeasure("250 ml mleka")).toMatchObject({ grams: 250, source: "stated" });
  });
  it("returns null when the ingredient is unknown or ambiguous", () => {
    expect(gramsFromMeasure("jabłko")).toBeNull();
    expect(gramsFromMeasure("szklanka mąki")).toBeNull();
    expect(gramsFromMeasure("2 jajka")).toBeNull();
  });
});

const item = (grams: number | null, per100: NutritionItem["per100"], extra: Partial<NutritionItem> = {}): NutritionItem => ({
  line: "x",
  name: "x",
  grams,
  gramsSource: "stated",
  per100,
  ...extra,
});

describe("computeTotals / perServing / atwater", () => {
  it("sums only countable items", () => {
    const totals = computeTotals([
      item(100, { kcal: 350, protein: 10, fat: 1, carbs: 72 }),
      item(50, { kcal: 900, protein: 0, fat: 100, carbs: 0 }),
      item(10, { kcal: 0, protein: 0, fat: 0, carbs: 0 }, { excluded: true }),
      item(null, { kcal: 100, protein: 1, fat: 1, carbs: 1 }),
    ]);
    expect(totals).toEqual({ kcal: 800, protein: 10, fat: 51, carbs: 72 });
    expect(perServing(totals, 4)).toEqual({ kcal: 200, protein: 2.5, fat: 12.8, carbs: 18 });
    expect(perServing(totals, null)).toBeNull();
    expect(atwaterCheck({ kcal: 800, protein: 10, fat: 51, carbs: 72 }).drift).toBeLessThan(0.05);
  });
});

describe("breakdownIssues / recompute", () => {
  it("blocks on missing servings and on mostly-missing grams", () => {
    const issues = breakdownIssues({
      items: [item(null, null), item(null, null), item(100, { kcal: 100, protein: 1, fat: 1, carbs: 1 })],
      servings: null,
      servingsSource: "draft",
      perServing: null,
    });
    expect(issues.map((i) => i.code)).toContain("grams-missing");
    expect(issues.find((i) => i.code === "grams-missing")?.severity).toBe("error");
    expect(issues.find((i) => i.code === "servings-missing")?.severity).toBe("error");
  });
  it("recompute updates totals, per-serving and issues from a patch", () => {
    const b = recompute(
      {
        items: [item(100, { kcal: 400, protein: 10, fat: 10, carbs: 50 })],
        servings: 2,
        servingsSource: "draft",
        totals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
        perServing: null,
        issues: [],
        model: "test",
        computedAt: "",
      },
      { servings: 4, servingsSource: "operator" }
    );
    expect(b.totals.kcal).toBe(400);
    expect(b.perServing?.kcal).toBe(100);
    expect(b.servingsSource).toBe("operator");
    expect(b.issues.some((i) => i.severity === "error")).toBe(false);
  });
});
