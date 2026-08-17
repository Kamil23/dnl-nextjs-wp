import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, dbSchema } from "../../../lib/db";
import {
  SIGNUP_SOURCES,
  magnetForSource,
  newToken,
  normalizeEmail,
  confirmMail,
  sendMail,
  type SignupSource,
} from "../../../lib/server/newsletter";

const { subscribers } = dbSchema;

// Public write endpoint → simple per-IP throttle (same pattern as admin login)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, { n: number; since: number }>();

function throttled(req: NextApiRequest): boolean {
  const fwd = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0].trim()) ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.since > WINDOW_MS) {
    hits.set(ip, { n: 1, since: now });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  source: z.enum(SIGNUP_SOURCES),
  // Anti-bot fields set by NewsletterSignup: `hp` is a honeypot that must stay
  // empty, `ts` is the form-mount timestamp (humans need a moment to type).
  hp: z.string().max(200).optional(),
  ts: z.number().int().optional(),
});

// Aug 2026: subscription-bombing bots flooded the footer form (~40/day). They
// POST straight to the API or autofill every field, so an empty honeypot plus
// a minimum fill time cuts them off.
const MIN_FILL_MS = 3000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (throttled(req)) {
    return res.status(429).json({ error: "Za dużo prób. Spróbuj za chwilę." });
  }
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Podaj poprawny adres e-mail" });
  }
  const { source, hp, ts } = parsed.data;
  // Bot signature → pretend success so the operator has no signal to adapt to
  if (hp || !ts || Date.now() - ts < MIN_FILL_MS) {
    return res.status(200).json({ ok: true });
  }
  const email = normalizeEmail(parsed.data.email);
  const magnet = magnetForSource(source as SignupSource);

  try {
    const [existing] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, email));

    if (existing?.status === "confirmed") {
      // Already on the list — behave identically to a fresh signup (no status leak)
      return res.status(200).json({ ok: true });
    }

    let token: string;
    if (existing) {
      // pending or unsubscribed → refresh consent trail and resend confirmation
      token = existing.token;
      await db
        .update(subscribers)
        .set({ status: "pending", source, magnet, consentedAt: new Date() })
        .where(eq(subscribers.id, existing.id));
    } else {
      token = newToken();
      await db.insert(subscribers).values({ email, source, magnet, token });
    }

    const mail = confirmMail(token, magnet);
    await sendMail({ to: email, subject: mail.subject, html: mail.html });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("newsletter signup:", e.message);
    return res.status(500).json({ error: "Nie udało się zapisać. Spróbuj ponownie." });
  }
}
