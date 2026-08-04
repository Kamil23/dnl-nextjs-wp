import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db, dbSchema } from "../../../lib/db";
import { applyOp, migrateList, type ListOp } from "../../../lib/shopping-list-ops";
import { listOpSchema, uuidSchema } from "../../../lib/server/list-validation";
import { publish } from "../../../lib/server/list-bus";

const { sharedLists } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.safeParse(req.query.id);
  if (!id.success) {
    return res.status(404).json({ error: "Not found" });
  }

  if (req.method === "GET") {
    const [row] = await db.select().from(sharedLists).where(eq(sharedLists.id, id.data));
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json({
      data: migrateList(row.data),
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  if (req.method === "PATCH") {
    const parsed = listOpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Bad request" });
    }
    const op = parsed.data as ListOp;

    if (op.op === "rename") {
      const [row] = await db
        .update(sharedLists)
        .set({ name: op.name, updatedAt: new Date() })
        .where(eq(sharedLists.id, id.data))
        .returning({ name: sharedLists.name });
      if (!row) return res.status(404).json({ error: "Not found" });
      publish(id.data, "meta", { name: row.name });
      return res.json({ name: row.name });
    }

    // SELECT ... FOR UPDATE serializes concurrent editors on the same list;
    // ops are applied server-side so the stored state never forks
    const next = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(sharedLists)
        .where(eq(sharedLists.id, id.data))
        .for("update");
      if (!row) return null;
      const updated = applyOp(migrateList(row.data), op);
      await tx
        .update(sharedLists)
        .set({ data: updated, updatedAt: new Date() })
        .where(eq(sharedLists.id, id.data));
      return updated;
    });

    if (!next) return res.status(404).json({ error: "Not found" });
    publish(id.data, "list", next);
    return res.json({ data: next });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
