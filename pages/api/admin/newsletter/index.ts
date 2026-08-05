import type { NextApiRequest, NextApiResponse } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import { composeDraft } from "../../../../lib/server/edition-composer";

const { newsletterEditions, subscribers } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    const [editions, stats, bySource] = await Promise.all([
      db.select().from(newsletterEditions).orderBy(desc(newsletterEditions.number)).limit(30),
      db
        .select({ status: subscribers.status, n: sql<number>`count(*)::int` })
        .from(subscribers)
        .groupBy(subscribers.status),
      db
        .select({ source: subscribers.source, n: sql<number>`count(*)::int` })
        .from(subscribers)
        .where(eq(subscribers.status, "confirmed"))
        .groupBy(subscribers.source),
    ]);
    return res.status(200).json({ editions, stats, bySource });
  }

  if (req.method === "POST") {
    // One draft at a time: reuse an existing one instead of stacking drafts
    const [existing] = await db
      .select()
      .from(newsletterEditions)
      .where(eq(newsletterEditions.status, "draft"))
      .limit(1);
    if (existing) return res.status(200).json({ edition: existing, reused: true });

    try {
      const draft = await composeDraft();
      const [row] = await db
        .insert(newsletterEditions)
        .values({ number: draft.number, subject: draft.subject, content: draft.content })
        .returning();
      return res.status(200).json({ edition: row, reused: false });
    } catch (e: any) {
      console.error("compose draft:", e.message);
      return res.status(500).json({ error: e.message?.slice(0, 300) || "Błąd składania wydania" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
