import type { NextApiRequest, NextApiResponse } from "next";
import { desc, eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

const { newsletterLinkClicks } = dbSchema;

// Lazy detail behind the edition row in the admin: which links were clicked.
// (Static route wins over [id].ts, so /stats is safe next to the dynamic one.)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const editionId = parseInt(String(req.query.edition), 10);
  if (!Number.isInteger(editionId)) return res.status(400).json({ error: "Bad edition id" });

  const links = await db
    .select({ url: newsletterLinkClicks.url, clicks: newsletterLinkClicks.clicks })
    .from(newsletterLinkClicks)
    .where(eq(newsletterLinkClicks.editionId, editionId))
    .orderBy(desc(newsletterLinkClicks.clicks))
    .limit(20);

  return res.status(200).json({ links });
}
