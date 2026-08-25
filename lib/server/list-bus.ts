// In-memory pub/sub for shared shopping lists - the SSE equivalent of the
// old freshlist websocket server's session broadcast. Single Next.js
// process assumption (self-hosted VPS); cached on globalThis to survive
// dev hot reloads.

type Subscriber = (event: string, data: unknown) => void;

const globalForBus = globalThis as unknown as {
  listBus?: Map<string, Set<Subscriber>>;
};

const channels: Map<string, Set<Subscriber>> =
  globalForBus.listBus ?? new Map();
globalForBus.listBus = channels;

export function subscribe(listId: string, fn: Subscriber): () => void {
  let set = channels.get(listId);
  if (!set) {
    set = new Set();
    channels.set(listId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) channels.delete(listId);
  };
}

export function publish(listId: string, event: string, data: unknown) {
  channels.get(listId)?.forEach((fn) => {
    try {
      fn(event, data);
    } catch {}
  });
}

export function presenceCount(listId: string): number {
  return channels.get(listId)?.size ?? 0;
}
