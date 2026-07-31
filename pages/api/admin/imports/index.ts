import type { NextApiRequest, NextApiResponse } from "next";
import { desc } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

const { imports } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    const rows = await db.select().from(imports).orderBy(desc(imports.createdAt)).limit(200);
    return res.json(JSON.parse(JSON.stringify(rows)));
  }

  if (req.method === "POST") {
    const url = (req.body?.url || "").trim();
    if (!/^https:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/.+/.test(url)) {
      return res.status(400).json({ error: "Podaj poprawny link do TikToka" });
    }
    const [row] = await db
      .insert(imports)
      .values({ tiktokUrl: url, status: "pending" })
      .returning({ id: imports.id });
    return res.status(201).json({ id: row.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
