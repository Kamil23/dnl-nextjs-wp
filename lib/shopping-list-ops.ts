// Pure shopping-list operations shared by the client (localStorage mode)
// and the API routes (shared-list mode). Ports the freshlist message types
// (create/update/delete/check/position) as explicit ops applied in one
// place, so concurrent editors can't fork the stored state.

import { mergeShoppingLines } from "./quantity";

export type ShoppingItem = {
  id: string;
  title: string;
  checked: boolean;
  // Epoch ms of the last check-off — drives the Reminders-style auto
  // cleanup (checked items vanish on the next visit after ~12h)
  checkedAt?: number | null;
  // Origin recipe when the item came from "Dodaj składniki do listy"
  recipe?: { id: number; title: string; uri: string } | null;
};

export type NewShoppingItem = Omit<ShoppingItem, "checked">;

export type ListOp =
  // `at: "start"` — manual adds land right under the always-visible input
  // at the top; recipe imports append at the end of the unchecked section
  | { op: "addItems"; items: NewShoppingItem[]; replaceRecipeId?: number | null; at?: "start" | "end" }
  | { op: "updateItem"; id: string; title: string }
  | { op: "removeItem"; id: string }
  // `checked` carries the target state (not a flip) so replayed or
  // concurrent toggles stay idempotent
  | { op: "toggleItem"; id: string; checked: boolean }
  | { op: "reorder"; ids: string[] }
  // Without `checkedBefore` removes all checked items; with it, only those
  // checked before the given epoch ms (the auto-cleanup path)
  | { op: "clearChecked"; checkedBefore?: number }
  // Full-state sync used right after a lazily-created session, when local
  // mutations may have raced the create call
  | { op: "replaceAll"; items: ShoppingItem[] }
  // Handled outside applyOp (name lives next to data, not inside it)
  | { op: "rename"; name: string };

// Abuse guards for the public shared-list endpoint
export const MAX_TOTAL_ITEMS = 400;
export const MAX_ITEM_LENGTH = 300;
export const MAX_NAME_LENGTH = 100;

// Display order: unchecked first (stable), checked sink to the bottom —
// freshlist's sortBySortOrder with the array itself as the sort order
export function sortForDisplay(list: ShoppingItem[]): ShoppingItem[] {
  return [...list.filter((i) => !i.checked), ...list.filter((i) => i.checked)];
}

export function applyOp(list: ShoppingItem[], op: ListOp): ShoppingItem[] {
  switch (op.op) {
    case "addItems": {
      const next =
        op.replaceRecipeId != null
          ? list.filter((i) => i.recipe?.id !== op.replaceRecipeId)
          : [...list];
      const existing = new Set(next.map((i) => i.id));

      // Same ingredient already on the list (unchecked) absorbs the new
      // amount instead of creating a duplicate row. A merge across sources
      // drops the recipe link — the row no longer belongs to one recipe.
      const added: ShoppingItem[] = [];
      const mergeInto = (pool: ShoppingItem[], item: ShoppingItem): boolean => {
        for (let idx = 0; idx < pool.length; idx++) {
          if (pool[idx].checked) continue;
          const title = mergeShoppingLines(pool[idx].title, item.title);
          if (title) {
            const sameRecipe =
              pool[idx].recipe && item.recipe && pool[idx].recipe!.id === item.recipe.id;
            pool[idx] = { ...pool[idx], title, recipe: sameRecipe ? pool[idx].recipe : null };
            return true;
          }
        }
        return false;
      };
      for (const raw of op.items) {
        if (existing.has(raw.id)) continue;
        existing.add(raw.id);
        const item = { ...raw, checked: false };
        if (!mergeInto(next, item) && !mergeInto(added, item)) added.push(item);
      }

      const firstChecked = next.findIndex((i) => i.checked);
      const endOfUnchecked = firstChecked === -1 ? next.length : firstChecked;
      next.splice(op.at === "start" ? 0 : endOfUnchecked, 0, ...added);
      return next.slice(0, MAX_TOTAL_ITEMS);
    }
    case "updateItem":
      return list.map((i) => (i.id === op.id ? { ...i, title: op.title } : i));
    case "removeItem":
      return list.filter((i) => i.id !== op.id);
    case "toggleItem":
      return list.map((i) =>
        i.id === op.id
          ? { ...i, checked: op.checked, checkedAt: op.checked ? Date.now() : null }
          : i
      );
    case "reorder": {
      const byId = new Map(list.map((i) => [i.id, i]));
      const ordered = op.ids
        .map((id) => byId.get(id))
        .filter((i): i is ShoppingItem => !!i);
      const seen = new Set(op.ids);
      // Items the reorder didn't know about (concurrent adds) keep their
      // relative order at the end
      return [...ordered, ...list.filter((i) => !seen.has(i.id))];
    }
    case "clearChecked":
      return list.filter(
        (i) => !i.checked || (op.checkedBefore != null && (i.checkedAt ?? 0) >= op.checkedBefore)
      );
    case "replaceAll":
      return op.items.slice(0, MAX_TOTAL_ITEMS);
    case "rename":
      return list;
  }
}

// Both localStorage and shared_lists rows may still hold the previous
// recipe-grouped shape ({recipeId, items[], checked[]}) — flatten in place.
export function migrateList(raw: unknown): ShoppingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry: any, ei: number) => {
    if (entry && Array.isArray(entry.items)) {
      return entry.items.map((title: string, i: number) => ({
        id: `mig-${entry.recipeId}-${ei}-${i}`,
        title: String(title),
        checked: !!entry.checked?.[i],
        recipe: {
          id: entry.recipeId,
          title: String(entry.title ?? ""),
          uri: String(entry.uri ?? "/"),
        },
      }));
    }
    if (entry && typeof entry.id === "string" && typeof entry.title === "string") {
      return [entry as ShoppingItem];
    }
    return [];
  });
}

export function osobaPlural(n: number): string {
  return n === 1 ? "osoba" : n >= 2 && n <= 4 ? "osoby" : "osób";
}
