import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import { renderEditionHtml, type EditionContent } from "../../../../lib/server/edition-composer";
import { sendMail, sendBatch } from "../../../../lib/server/newsletter";

const { newsletterEditions, subscribers } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const id = parseInt(String(req.query.id), 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });

  const [edition] = await db
    .select()
    .from(newsletterEditions)
    .where(eq(newsletterEditions.id, id));
  if (!edition) return res.status(404).json({ error: "Nie ma takiego wydania" });

  // Browser preview of the exact mail HTML (open in a new tab from the admin)
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res
      .status(200)
      .send(renderEditionHtml(edition.number, edition.content as EditionContent, "0".repeat(48)));
  }

  // Save the admin-approved shape (subject + section toggles/texts)
  if (req.method === "PUT") {
    if (edition.status === "sent") return res.status(400).json({ error: "Wydanie już wysłane" });
    const { subject, content } = req.body ?? {};
    if (typeof subject !== "string" || !subject.trim() || typeof content !== "object" || !content) {
      return res.status(400).json({ error: "Brak tematu albo treści" });
    }
    const [row] = await db
      .update(newsletterEditions)
      .set({ subject: subject.trim(), content })
      .where(eq(newsletterEditions.id, id))
      .returning();
    return res.status(200).json({ edition: row });
  }

  if (req.method === "DELETE") {
    if (edition.status === "sent") return res.status(400).json({ error: "Wysłanych nie usuwamy" });
    await db.delete(newsletterEditions).where(eq(newsletterEditions.id, id));
    return res.status(200).json({ ok: true });
  }

  if (req.method === "POST") {
    const action = req.body?.action;
    const content = edition.content as EditionContent;

    if (action === "test") {
      const to = String(req.body?.to || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
        return res.status(400).json({ error: "Podaj poprawny adres testowy" });
      }
      try {
        await sendMail({
          to,
          subject: `[TEST] ${edition.subject}`,
          html: renderEditionHtml(edition.number, content, "0".repeat(48)),
        });
        return res.status(200).json({ ok: true });
      } catch (e: any) {
        return res.status(502).json({ error: e.message?.slice(0, 300) });
      }
    }

    if (action === "send") {
      if (edition.status === "sent") return res.status(400).json({ error: "Wydanie już wysłane" });
      const recipients = await db
        .select({ email: subscribers.email, token: subscribers.token })
        .from(subscribers)
        .where(and(eq(subscribers.status, "confirmed")));
      if (recipients.length === 0) {
        return res.status(400).json({ error: "Brak potwierdzonych subskrybentów" });
      }
      try {
        await sendBatch(
          recipients.map((r) => ({
            to: r.email,
            subject: edition.subject,
            html: renderEditionHtml(edition.number, content, r.token),
            unsubToken: r.token,
          }))
        );
        const [row] = await db
          .update(newsletterEditions)
          .set({ status: "sent", sentAt: new Date(), recipientCount: recipients.length })
          .where(eq(newsletterEditions.id, id))
          .returning();
        return res.status(200).json({ edition: row, sentTo: recipients.length });
      } catch (e: any) {
        console.error("newsletter send:", e.message);
        return res.status(502).json({ error: e.message?.slice(0, 300) });
      }
    }

    return res.status(400).json({ error: "Nieznana akcja" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
