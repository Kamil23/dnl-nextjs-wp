import Link from "next/link";
import { useEffect, useState } from "react";
import { scaleIngredient } from "../../lib/quantity";
import { addRecipe } from "../../lib/shopping-list";
import CookMode from "./cook-mode";

// Interactive ingredients: check-off (persisted per recipe in localStorage),
// servings scaler and a screen wake lock for cooking.
export default function IngredientsCard({ recipe }) {
  const baseServings: number | null = recipe.servings ?? null;
  const [servings, setServings] = useState(baseServings ?? 1);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [wakeLockOn, setWakeLockOn] = useState(false);
  const [cookMode, setCookMode] = useState(false);
  const [addedToList, setAddedToList] = useState(false);
  const storageKey = `dnl-ingredients-${recipe.slug}`;

  function addToShoppingList() {
    addRecipe({
      recipeId: recipe.id,
      title: recipe.title,
      uri: recipe.uri,
      servings: baseServings ? servings : null,
      items: recipe.ingredientGroups.flatMap((g) =>
        g.items.map((i) => scaleIngredient(i, factor))
      ),
    });
    setAddedToList(true);
    setTimeout(() => setAddedToList(false), 3000);
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setChecked(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  function toggle(key: string) {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  // Screen wake lock — re-acquired on tab return, released on toggle off
  useEffect(() => {
    if (!wakeLockOn) return;
    let lock: any = null;
    let released = false;
    async function acquire() {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {
        setWakeLockOn(false);
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [wakeLockOn]);

  const factor = baseServings ? servings / baseServings : 1;

  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-medium p-6 print-recipe">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold tracking-tight">Składniki</h2>
        {baseServings && (
          <div className="flex items-center gap-1 rounded-full border border-gray-200 px-1 py-0.5" aria-label="Liczba porcji">
            <button
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-600 font-bold"
              aria-label="Mniej porcji"
            >
              −
            </button>
            <span className="text-sm font-semibold w-16 text-center">
              {servings} {servings === 1 ? "porcja" : servings < 5 ? "porcje" : "porcji"}
            </span>
            <button
              onClick={() => setServings(servings + 1)}
              className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-600 font-bold"
              aria-label="Więcej porcji"
            >
              +
            </button>
          </div>
        )}
      </div>

      {recipe.ingredientGroups.map((group, gi) => (
        <div key={gi} className="mb-4 last:mb-0">
          {group.title && (
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {group.title}
            </h3>
          )}
          <ul className="space-y-1">
            {group.items.map((item, ii) => {
              const key = `${gi}-${ii}`;
              const isChecked = !!checked[key];
              return (
                <li key={key}>
                  <label className="flex items-start gap-3 cursor-pointer rounded-xl px-2 py-1.5 hover:bg-amber-50 transition group">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(key)}
                      className="mt-1 w-4 h-4 accent-amber-500 shrink-0"
                    />
                    <span
                      className={`text-[15px] leading-relaxed ${
                        isChecked ? "text-gray-300 line-through" : "text-gray-700"
                      }`}
                    >
                      {scaleIngredient(item, factor)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {baseServings && factor !== 1 && (
        <p className="text-xs text-gray-400 mt-3">
          Ilości przeliczone z {baseServings} na {servings} porcji — składniki bez
          liczby zostawiliśmy bez zmian.
        </p>
      )}

      {recipe.steps.length > 0 && (
        <button
          onClick={() => setCookMode(true)}
          className="mt-5 w-full rounded-2xl bg-gray-900 hover:bg-amber-500 text-white font-semibold py-3 transition print:hidden"
        >
          🍳 Tryb gotowania — krok po kroku
        </button>
      )}
      {cookMode && (
        <CookMode recipe={recipe} factor={factor} onClose={() => setCookMode(false)} />
      )}

      <button
        onClick={addToShoppingList}
        className={`mt-3 w-full rounded-2xl border-2 font-semibold py-3 transition print:hidden ${
          addedToList
            ? "border-green-500 text-green-600 bg-green-50"
            : "border-gray-200 text-gray-700 hover:border-amber-400"
        }`}
      >
        {addedToList ? (
          <>
            ✓ Dodano!{" "}
            <Link href="/lista-zakupow/" className="underline">
              Zobacz listę
            </Link>
          </>
        ) : (
          "🛒 Dodaj składniki do listy zakupów"
        )}
      </button>

      <div className="border-t border-gray-100 mt-5 pt-4 flex items-center justify-between gap-3 print:hidden">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={wakeLockOn}
            onChange={(e) => setWakeLockOn(e.target.checked)}
            className="w-4 h-4 accent-amber-500"
          />
          🔆 Nie wygaszaj ekranu
        </label>
        <button
          onClick={() => window.print()}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          🖨️ Drukuj
        </button>
      </div>
    </div>
  );
}
