import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db, dbSchema } from "../../../lib/db";
import { welcomeMail, sendMail } from "../../../lib/server/newsletter";

const { subscribers } = dbSchema;

// Double opt-in confirmation link target. Idempotent: a second click just
// redirects to the thank-you page again.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = String(req.query.t || "");
  if (!/^[0-9a-f]{48}$/.test(token)) return res.redirect(302, "/newsletter/gotowe?e=1");

  const [sub] = await db.select().from(subscribers).where(eq(subscribers.token, token));
  if (!sub) return res.redirect(302, "/newsletter/gotowe?e=1");

  if (sub.status !== "confirmed") {
    await db
      .update(subscribers)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(subscribers.id, sub.id));
    try {
      const mail = welcomeMail(sub.token, sub.magnet);
      await sendMail({ to: sub.email, subject: mail.subject, html: mail.html, unsubToken: sub.token });
    } catch (e: any) {
      // Confirmation must not fail because the welcome mail did
      console.error("welcome mail:", e.message);
    }
  }
  return res.redirect(302, `/newsletter/gotowe?t=${token}`);
}
