import type { NextApiRequest, NextApiResponse } from "next";
import { desc } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

const { subscribers } = dbSchema;

// CSV export of the whole list (the data is OURS — portable to any mail tool)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const rows = await db.select().from(subscribers).orderBy(desc(subscribers.createdAt));
  const csv = [
    "email,status,source,magnet,consented_at,confirmed_at",
    ...rows.map((r) =>
      [
        r.email,
        r.status,
        r.source,
        r.magnet ?? "",
        r.consentedAt?.toISOString() ?? "",
        r.confirmedAt?.toISOString() ?? "",
      ].join(",")
    ),
  ].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="subskrybenci-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.status(200).send(csv);
}
