import { describe, expect, it } from "vitest";
import { reviewDraft } from "../import-review";
import { frameUrls } from "../import-draft";

const base = {
  title: "Test",
  categorySlugs: ["obiady"],
  ingredientGroups: [{ title: null, items: ["200 g makaronu", "2 jajka", "100 g sera"] }],
  steps: [
    { title: null, body: "Ugotuj", tip: null, image: null },
    { title: null, body: "Wymieszaj", tip: null, image: null },
  ],
  servings: 2,
  kcal: 500,
  protein: 25,
  fat: 15,
  carbs: 60,
  confidence: "high" as const,
  notes: null,
  prepTimeMin: 20,
  totalTimeMin: 30,
};

describe("reviewDraft", () => {
  it("passes a complete draft", () => {
    const r = reviewDraft(base);
    expect(r.blocking).toBe(false);
    expect(r.issues).toEqual([]);
  });
  it("blocks on missing servings and kcal", () => {
    const r = reviewDraft({ ...base, servings: null, kcal: null });
    expect(r.blocking).toBe(true);
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["servings-missing", "kcal-missing"]));
  });
  it("warns on medium confidence and ingredients without amounts, blocks when most lack amounts", () => {
    const warn = reviewDraft({ ...base, confidence: "medium", ingredientGroups: [{ title: null, items: ["200 g makaronu", "2 jajka", "100 g sera", "sól"] }] });
    expect(warn.blocking).toBe(false);
    expect(warn.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["confidence", "ingredients-no-amount"]));
    const block = reviewDraft({ ...base, ingredientGroups: [{ title: null, items: ["makaron", "jajka", "ser"] }] });
    expect(block.blocking).toBe(true);
  });
  it("flags Atwater mismatch via shared QC rules", () => {
    const r = reviewDraft({ ...base, kcal: 200, protein: 50, fat: 50, carbs: 50 });
    expect(r.issues.some((i) => i.code === "macro-mismatch")).toBe(true);
  });
});

describe("frameUrls", () => {
  it("accepts legacy string frames and new frame objects", () => {
    expect(frameUrls({ frames: ["/a.jpg", { url: "/b.jpg", t: 3 }] })).toEqual(["/a.jpg", "/b.jpg"]);
    expect(frameUrls(null)).toEqual([]);
  });
});
