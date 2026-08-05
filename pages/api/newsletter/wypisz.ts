import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db, dbSchema } from "../../../lib/db";

const { subscribers } = dbSchema;

// One-click unsubscribe (GET from the mail footer link, POST from
// List-Unsubscribe-Post). Always lands on a friendly page, never errors.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = String(req.query.t || "");
  if (/^[0-9a-f]{48}$/.test(token)) {
    await db
      .update(subscribers)
      .set({ status: "unsubscribed" })
      .where(eq(subscribers.token, token));
  }
  if (req.method === "POST") return res.status(200).json({ ok: true });
  return res.redirect(302, "/newsletter/gotowe?w=1");
}
