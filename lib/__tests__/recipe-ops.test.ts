import { describe, expect, it } from "vitest";
import { applyOps, describePath, touchesIngredients, type RecipeText } from "../recipe-ops";

const base = (): RecipeText => ({
  title: "Sernik",
  lead: "Lekki sernik.",
  about: "Robię go często.",
  ingredientGroups: [
    { title: "Spód", items: ["100 g herbatników", "50 g masła"] },
    { title: "Masa", items: ["500 g twarogu", "2 jajka", "3 łyżki ksylitolu"] },
  ],
  steps: [
    { title: null, body: "Zmiel herbatniki.", tip: null },
    { title: null, body: "Zmiksuj masę.", tip: null },
    { title: null, body: "Piecz 50 minut.", tip: null },
  ],
  servings: 8,
  prepTimeMin: 20,
  totalTimeMin: 80,
  difficulty: "latwy",
});

describe("applyOps", () => {
  it("adds a step and a consequential ingredient, keeping input indexes", () => {
    const r = applyOps(base(), [
      { op: "add", path: "steps", index: 3, value: { body: "Na wierzch połóż kawałki Kinder Bueno." }, reason: "instrukcja", kind: "requested" },
      { op: "add", path: "ingredientGroups[1].items", index: 99, value: "1 batonik Kinder Bueno (ok. 43 g)", reason: "krok go używa", kind: "consequence" },
      { op: "set", path: "lead", value: "Lekki sernik z Kinder Bueno.", reason: "opis", kind: "consequence" },
    ]);
    expect(r.rejected).toEqual([]);
    expect(r.recipe.steps).toHaveLength(4);
    expect(r.recipe.steps[3].body).toMatch(/Kinder/);
    expect(r.recipe.ingredientGroups[1].items.at(-1)).toMatch(/Kinder/);
    expect(r.recipe.lead).toMatch(/Kinder/);
    expect(r.applied.find((a) => a.path === "lead")?.before).toBe("Lekki sernik.");
    expect(touchesIngredients(r.applied)).toBe(true);
  });

  it("removes from the end so earlier indexes stay valid, and drops empty groups", () => {
    const r = applyOps(base(), [
      { op: "remove", path: "ingredientGroups[0].items[0]", reason: "", kind: "requested" },
      { op: "remove", path: "ingredientGroups[0].items[1]", reason: "", kind: "requested" },
      { op: "remove", path: "steps[0]", reason: "", kind: "consequence" },
    ]);
    expect(r.rejected).toEqual([]);
    expect(r.recipe.ingredientGroups).toHaveLength(1);
    expect(r.recipe.ingredientGroups[0].title).toBe("Masa");
    expect(r.recipe.steps.map((s) => s.body)).toEqual(["Zmiksuj masę.", "Piecz 50 minut."]);
  });

  it("combines add and remove on the same list using input indexes", () => {
    const r = applyOps(base(), [
      { op: "add", path: "ingredientGroups[1].items", index: 0, value: "1 łyżeczka wanilii", reason: "", kind: "requested" },
      { op: "remove", path: "ingredientGroups[1].items[2]", reason: "", kind: "requested" }, // ksylitol
    ]);
    expect(r.recipe.ingredientGroups[1].items).toEqual(["1 łyżeczka wanilii", "500 g twarogu", "2 jajka"]);
  });

  it("rejects bad indexes, empty values, title changes without request and too few steps", () => {
    const r = applyOps(base(), [
      { op: "set", path: "steps[9].body", value: "x", reason: "", kind: "requested" },
      { op: "set", path: "ingredientGroups[0].items[0]", value: "", reason: "", kind: "requested" },
      { op: "set", path: "title", value: "Inny", reason: "", kind: "consequence" },
      { op: "remove", path: "steps[0]", reason: "", kind: "requested" },
      { op: "remove", path: "steps[1]", reason: "", kind: "requested" },
      { op: "set", path: "servings", value: "abc", reason: "", kind: "requested" },
      { op: "set", path: "nope", value: 1, reason: "", kind: "requested" },
    ]);
    // remove idzie od końca: steps[1] schodzi, steps[0] już nie (minimum 2 kroki)
    expect(r.applied.map((a) => a.path)).toEqual(["steps[1]"]);
    expect(r.recipe.steps.map((s) => s.body)).toEqual(["Zmiel herbatniki.", "Piecz 50 minut."]);
    expect(r.rejected).toHaveLength(6);
  });

  it("refuses editing about when the recipe has none", () => {
    const r = applyOps({ ...base(), about: null }, [{ op: "set", path: "about", value: "x", reason: "", kind: "requested" }]);
    expect(r.applied).toEqual([]);
    expect(r.recipe.about).toBeNull();
  });

  it("describes paths in Polish", () => {
    const b = base();
    expect(describePath(b, { op: "add", path: "steps", index: 3, value: {} })).toBe("Krok 4 (nowy)");
    expect(describePath(b, { op: "set", path: "ingredientGroups[1].items[0]", value: "" })).toBe("Składniki → Masa, poz. 1");
    expect(describePath(b, { op: "set", path: "lead", value: "" })).toBe("Lead");
  });
});
