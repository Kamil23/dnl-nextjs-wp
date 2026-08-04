import type { NextApiRequest, NextApiResponse } from "next";
import { sql as dsql } from "drizzle-orm";
import { db, dbSchema } from "../../../lib/db";
import { migrateList } from "../../../lib/shopping-list-ops";
import { listDataSchema } from "../../../lib/server/list-validation";

const { sharedLists } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Accept the caller's current list in either shape (fresh flat items or
  // a pre-migration localStorage payload)
  const parsed = listDataSchema.safeParse(migrateList(req.body?.data ?? []));
  if (!parsed.success) {
    return res.status(400).json({ error: "Bad request" });
  }

  // Opportunistic TTL: purge lists untouched for 60 days so the table
  // doesn't grow forever (no cron needed at this traffic level)
  await db.delete(sharedLists).where(dsql`${sharedLists.updatedAt} < now() - interval '60 days'`);

  // No default name — the UI titles unnamed lists "Lista zakupów" and the
  // "Moje listy" section falls back to "Lista z <createdAt>"
  const [row] = await db
    .insert(sharedLists)
    .values({ data: parsed.data })
    .returning({ id: sharedLists.id, name: sharedLists.name, createdAt: sharedLists.createdAt });

  return res.status(201).json({ id: row.id, name: row.name, createdAt: row.createdAt });
}
