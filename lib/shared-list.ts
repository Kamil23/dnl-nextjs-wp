// Client for the shared (live) shopping list. Persistence flows like in
// the old freshlist app: optimistic local update → REST persist → server
// broadcast to everyone in the session (here over SSE instead of a
// separate websocket server).

import type { ListOp, ShoppingItem } from "./shopping-list-ops";

const SHARED_ID_KEY = "dnl-shared-list-id";
const CLIENT_ID_KEY = "dnl-client-id";
const MY_LISTS_KEY = "dnl-my-lists";

// Every shared list the user created or opened, shown in the "Moje listy"
// section (freshlist kept the same registry as "favoritesList")
export type SavedList = { id: string; name: string | null; createdAt?: string | null };

export function getMyLists(): SavedList[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MY_LISTS_KEY) || "[]");
    return Array.isArray(raw)
      ? raw.filter((l) => l && typeof l.id === "string")
      : [];
  } catch {
    return [];
  }
}

// Unnamed lists surface their creation date instead — always current,
// unlike a date baked into the name. When several unnamed lists share a
// date (pass `all` for collision detection), the time disambiguates:
// "Lista z 3.08, 14:32".
export function listDisplayName(l: SavedList, all?: SavedList[]): string {
  if (l.name) return l.name;
  if (!l.createdAt) return "Lista zakupów";
  const d = new Date(l.createdAt);
  const dateLabel = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const collides = all?.some(
    (o) =>
      o.id !== l.id &&
      !o.name &&
      o.createdAt &&
      new Date(o.createdAt).toDateString() === d.toDateString()
  );
  if (!collides) return `Lista z ${dateLabel}`;
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `Lista z ${dateLabel}, ${time}`;
}

export function rememberList(id: string, name: string | null, createdAt?: string | null) {
  const previous = getMyLists().find((l) => l.id === id);
  const rest = getMyLists().filter((l) => l.id !== id);
  localStorage.setItem(
    MY_LISTS_KEY,
    JSON.stringify([{ id, name, createdAt: createdAt ?? previous?.createdAt ?? null }, ...rest])
  );
}

export function forgetList(id: string) {
  localStorage.setItem(
    MY_LISTS_KEY,
    JSON.stringify(getMyLists().filter((l) => l.id !== id))
  );
  if (getSharedListId() === id) clearSharedListId();
}

export function getSharedListId(): string | null {
  try {
    return localStorage.getItem(SHARED_ID_KEY);
  } catch {
    return null;
  }
}

export function setSharedListId(id: string) {
  localStorage.setItem(SHARED_ID_KEY, id);
}

export function clearSharedListId() {
  localStorage.removeItem(SHARED_ID_KEY);
}

// Stable per-browser id so a client can ignore its own typing broadcasts
// (freshlist used the websocket connection key for this)
export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export async function createSharedList(
  data: ShoppingItem[]
): Promise<{ id: string; name: string | null }> {
  // Trailing slashes everywhere: `trailingSlash: true` 308-redirects
  // slash-less API URLs too, so hit the canonical form directly
  const res = await fetch("/api/lista/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error("create failed");
  const { id, name, createdAt } = await res.json();
  rememberList(id, name ?? null, createdAt ?? null);
  return { id, name: name ?? null };
}

// Fire-and-forget by design: the UI already updated optimistically and the
// SSE echo will reconcile any divergence.
// Resolves null ONLY on a definite 404 — network/server errors throw, so
// callers can tell "the list is gone" from "the connection hiccuped"
export async function fetchSharedList(
  id: string
): Promise<{ data: ShoppingItem[]; name: string | null; createdAt: string | null } | null> {
  const res = await fetch(`/api/lista/${id}/`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("fetch failed");
  const { data, name, createdAt } = await res.json();
  return { data, name: name ?? null, createdAt: createdAt ?? null };
}

export function sendOp(id: string, op: ListOp): Promise<void> {
  return fetch(`/api/lista/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(op),
  }).then(
    () => undefined,
    () => undefined
  );
}

export function sendTyping(id: string, typing: boolean) {
  fetch(`/api/lista/${id}/typing/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: getClientId(), typing }),
  }).catch(() => {});
}

export function subscribeSharedList(
  id: string,
  handlers: {
    onList: (data: ShoppingItem[]) => void;
    onMeta?: (meta: { name: string | null; createdAt?: string | null }) => void;
    onPresence?: (count: number) => void;
    onTyping?: (payload: { clientId: string; typing: boolean }) => void;
    onGone?: () => void;
  }
): () => void {
  const es = new EventSource(`/api/lista/${id}/events/`);
  const on = (event: string, fn: (data: any) => void) => {
    es.addEventListener(event, (e) => {
      try {
        fn(JSON.parse((e as MessageEvent).data));
      } catch {}
    });
  };
  on("list", (d) => handlers.onList(d));
  on("meta", (d) => handlers.onMeta?.(d));
  on("presence", (d) => handlers.onPresence?.(d.count));
  on("typing", (d) => handlers.onTyping?.(d));
  es.addEventListener("gone", () => {
    handlers.onGone?.();
    es.close();
  });
  // EventSource auto-reconnects on network errors; nothing to do here
  return () => es.close();
}
