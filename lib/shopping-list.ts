// Client-side shopping list persisted in localStorage. A custom event keeps
// the header badge and the list page in sync within the tab.
//
// Every list is a live shared session (Apple-style: the link is the access
// model). The session is created lazily on the first mutation, so bots and
// idle visitors never touch the database; until then the list is purely
// local. localStorage stays the single source the badge reads from, and
// doubles as the offline cache - if the server session expires, the next
// mutation quietly recreates it from the cached items.

import {
  applyOp,
  migrateList,
  sortForDisplay,
  type ListOp,
  type NewShoppingItem,
  type ShoppingItem,
} from "./shopping-list-ops";
import {
  createSharedList,
  getSharedListId,
  sendOp,
  setSharedListId,
} from "./shared-list";

export type { ShoppingItem, NewShoppingItem };

const KEY = "dnl-shopping-list";
export const SHOPPING_EVENT = "dnl-shopping-changed";

export function newItemId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `it-${Math.random().toString(36).slice(2)}`;
}

export function readList(): ShoppingItem[] {
  try {
    return migrateList(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return [];
  }
}

function write(list: ShoppingItem[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(SHOPPING_EVENT));
}

// Create the server session for the current list exactly once. Mutations
// that race the create call are synced afterwards with one replaceAll.
let createPromise: Promise<string> | null = null;
export function ensureSession(): Promise<string> {
  const existing = getSharedListId();
  if (existing) return Promise.resolve(existing);
  if (!createPromise) {
    const snapshot = readList();
    createPromise = createSharedList(snapshot)
      .then(({ id }) => {
        setSharedListId(id);
        const current = readList();
        if (JSON.stringify(current) !== JSON.stringify(snapshot)) {
          sendOp(id, { op: "replaceAll", items: current });
        }
        // Lets open pages notice the new session and subscribe
        window.dispatchEvent(new Event(SHOPPING_EVENT));
        return id;
      })
      .finally(() => {
        createPromise = null;
      });
  }
  return createPromise;
}

export function mutate(op: ListOp): ShoppingItem[] {
  const next = applyOp(readList(), op);
  write(next);
  const sharedId = getSharedListId();
  if (sharedId) {
    sendOp(sharedId, op);
  } else {
    // First mutation brings the session to life; the create payload (or
    // the follow-up replaceAll) carries this op's effect
    ensureSession().catch(() => {});
  }
  return next;
}

// Overwrite the local cache with server state (no op re-broadcast)
export function mirrorSharedList(list: ShoppingItem[]) {
  write(list);
}

// Adding a recipe replaces its previous items (re-add = updated servings)
export function addRecipeItems(
  recipe: { id: number; title: string; uri: string },
  lines: string[]
) {
  mutate({
    op: "addItems",
    replaceRecipeId: recipe.id,
    items: lines.map((title) => ({ id: newItemId(), title, recipe })),
  });
}

export function addItem(title: string) {
  mutate({ op: "addItems", items: [{ id: newItemId(), title }] });
}

export function itemCount(): number {
  return readList().length;
}

export { sortForDisplay };
