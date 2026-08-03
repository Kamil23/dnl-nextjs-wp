// Client-side shopping list persisted in localStorage. A custom event keeps
// the header badge and the list page in sync within the tab.

export type ShoppingRecipe = {
  recipeId: number;
  title: string;
  uri: string;
  servings: number | null;
  items: string[];
  checked: boolean[];
};

const KEY = "dnl-shopping-list";
export const SHOPPING_EVENT = "dnl-shopping-changed";

export function readList(): ShoppingRecipe[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(list: ShoppingRecipe[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(SHOPPING_EVENT));
}

export function addRecipe(entry: Omit<ShoppingRecipe, "checked">) {
  const list = readList().filter((r) => r.recipeId !== entry.recipeId);
  list.push({ ...entry, checked: entry.items.map(() => false) });
  write(list);
}

export function removeRecipe(recipeId: number) {
  write(readList().filter((r) => r.recipeId !== recipeId));
}

export function toggleItem(recipeId: number, index: number) {
  const list = readList();
  const r = list.find((x) => x.recipeId === recipeId);
  if (r) {
    r.checked[index] = !r.checked[index];
    write(list);
  }
}

export function clearChecked() {
  const list = readList()
    .map((r) => ({
      ...r,
      items: r.items.filter((_, i) => !r.checked[i]),
      checked: r.checked.filter((c) => !c),
    }))
    .filter((r) => r.items.length > 0);
  write(list);
}

export function itemCount(): number {
  return readList().reduce((n, r) => n + r.items.length, 0);
}

export function asText(): string {
  return readList()
    .map((r) => `${r.title}${r.servings ? ` (${r.servings} porcji)` : ""}:\n${r.items.map((i) => `• ${i}`).join("\n")}`)
    .join("\n\n");
}
