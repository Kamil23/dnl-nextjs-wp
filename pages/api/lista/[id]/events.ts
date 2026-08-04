import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db, dbSchema } from "../../../../lib/db";
import { migrateList } from "../../../../lib/shopping-list-ops";
import { uuidSchema } from "../../../../lib/server/list-validation";
import { presenceCount, publish, subscribe } from "../../../../lib/server/list-bus";

const { sharedLists } = dbSchema;

// Long-lived SSE connection — resolved manually, not by returning
export const config = { api: { externalResolver: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.safeParse(req.query.id);
  if (!id.success) return res.status(404).end();

  const [row] = await db.select().from(sharedLists).where(eq(sharedLists.id, id.data));

  // Opening a list counts as activity — keeps a regularly-viewed list
  // from hitting the 60-day TTL even if nobody edits it
  if (row) {
    await db
      .update(sharedLists)
      .set({ updatedAt: new Date() })
      .where(eq(sharedLists.id, id.data));
  }

  res.writeHead(row ? 200 : 404, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Nginx must not buffer the stream on the VPS
    "X-Accel-Buffering": "no",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (!row) {
    send("gone", {});
    return res.end();
  }

  send("meta", { name: row.name, createdAt: row.createdAt });
  send("list", migrateList(row.data));

  const unsubscribe = subscribe(id.data, send);
  publish(id.data, "presence", { count: presenceCount(id.data) });

  // Heartbeat keeps proxies from timing out the idle connection; sending
  // the presence count doubles as a self-correcting refresh (dead
  // connections are only reaped when a write to them fails)
  const heartbeat = setInterval(
    () => send("presence", { count: presenceCount(id.data) }),
    25000
  );

  // `req` never fires "close" on client disconnect for a bodyless GET —
  // the response side does, once the socket is torn down
  res.once("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    publish(id.data, "presence", { count: presenceCount(id.data) });
    res.end();
  });
}
