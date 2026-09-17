import { createHmac, timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, dbSchema } from "../../../lib/db";

const { newsletterSends, newsletterLinkClicks, subscribers } = dbSchema;

// Resend signs webhooks via Svix: HMAC-SHA256 over "{id}.{timestamp}.{body}"
// with the base64 secret (after the "whsec_" prefix). Signature verification
// needs the raw body byte-for-byte, so the JSON parser is off.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const TOLERANCE_S = 5 * 60;

function verifySignature(req: NextApiRequest, body: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = req.headers["svix-id"];
  const timestamp = req.headers["svix-timestamp"];
  const signatures = req.headers["svix-signature"];
  if (typeof id !== "string" || typeof timestamp !== "string" || typeof signatures !== "string") {
    return false;
  }
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  // Header carries space-separated versioned signatures: "v1,base64 v1,base64"
  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    click?: { link?: string };
    bounce?: { type?: string };
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = await readRawBody(req);
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    console.error("resend webhook: RESEND_WEBHOOK_SECRET not set");
    return res.status(503).json({ error: "Webhook not configured" });
  }
  if (!verifySignature(req, body)) {
    return res.status(401).json({ error: "Bad signature" });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: "Bad JSON" });
  }

  const emailId = event.data?.email_id;
  if (!emailId) return res.status(200).json({ ok: true });
  const at = event.created_at ? new Date(event.created_at) : new Date();

  try {
    switch (event.type) {
      case "email.delivered": {
        await db
          .update(newsletterSends)
          .set({ deliveredAt: at })
          .where(and(eq(newsletterSends.resendId, emailId), isNull(newsletterSends.deliveredAt)));
        break;
      }
      case "email.opened": {
        await db
          .update(newsletterSends)
          .set({
            openCount: sql`${newsletterSends.openCount} + 1`,
            firstOpenedAt: sql`coalesce(${newsletterSends.firstOpenedAt}, ${at})`,
          })
          .where(eq(newsletterSends.resendId, emailId));
        break;
      }
      case "email.clicked": {
        const [send] = await db
          .update(newsletterSends)
          .set({
            clickCount: sql`${newsletterSends.clickCount} + 1`,
            firstClickedAt: sql`coalesce(${newsletterSends.firstClickedAt}, ${at})`,
          })
          .where(eq(newsletterSends.resendId, emailId))
          .returning({ editionId: newsletterSends.editionId });
        const link = event.data?.click?.link;
        // Per-link stats skip unsubscribe/confirm clicks - they are not
        // engagement, and the unsubscribe itself is already tracked via status
        if (send && link && !link.includes("/api/newsletter/")) {
          await db
            .insert(newsletterLinkClicks)
            .values({ editionId: send.editionId, url: link, clicks: 1 })
            .onConflictDoUpdate({
              target: [newsletterLinkClicks.editionId, newsletterLinkClicks.url],
              set: { clicks: sql`${newsletterLinkClicks.clicks} + 1` },
            });
        }
        break;
      }
      case "email.bounced": {
        const [send] = await db
          .update(newsletterSends)
          .set({ bouncedAt: at })
          .where(eq(newsletterSends.resendId, emailId))
          .returning({ subscriberId: newsletterSends.subscriberId });
        // Only a hard bounce ("Permanent") burns the address; transient ones
        // (full inbox, greylisting) may still deliver next time
        if (send?.subscriberId && event.data?.bounce?.type === "Permanent") {
          await db
            .update(subscribers)
            .set({ status: "bounced" })
            .where(and(eq(subscribers.id, send.subscriberId), eq(subscribers.status, "confirmed")));
        }
        break;
      }
      case "email.complained": {
        const [send] = await db
          .update(newsletterSends)
          .set({ complainedAt: at })
          .where(eq(newsletterSends.resendId, emailId))
          .returning({ subscriberId: newsletterSends.subscriberId });
        if (send?.subscriberId) {
          await db
            .update(subscribers)
            .set({ status: "complained" })
            .where(and(eq(subscribers.id, send.subscriberId), eq(subscribers.status, "confirmed")));
        }
        break;
      }
      default:
        break;
    }
  } catch (e: any) {
    // 500 → Svix retries with backoff, so a transient DB hiccup self-heals
    console.error("resend webhook:", event.type, e.message);
    return res.status(500).json({ error: "DB error" });
  }

  return res.status(200).json({ ok: true });
}
