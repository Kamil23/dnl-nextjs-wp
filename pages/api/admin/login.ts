import type { NextApiRequest, NextApiResponse } from "next";
import { adminCookieHeader, safeEqual, sessionToken } from "../../../lib/admin-auth";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

// In-memory brute-force throttle. The app runs as a single Node process, so a
// module-level map is enough to blunt password guessing on the single-operator
// login: after MAX_FAILS wrong tries an IP is locked out for LOCK_MS.
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map<string, { fails: number; until: number }>();

function clientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const ip = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0].trim();
  return ip || req.socket.remoteAddress || "unknown";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = clientIp(req);
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now) {
    const retry = Math.ceil((rec.until - now) / 1000);
    res.setHeader("Retry-After", String(retry));
    return res
      .status(429)
      .json({ error: "Zbyt wiele prób. Spróbuj ponownie później." });
  }

  const password = req.body?.password;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof password !== "string" || !safeEqual(password, expected)) {
    const fails = (rec && rec.until > now ? rec.fails : rec?.fails ?? 0) + 1;
    attempts.set(ip, {
      fails,
      until: fails >= MAX_FAILS ? now + LOCK_MS : 0,
    });
    return res.status(401).json({ error: "Nieprawidłowe hasło" });
  }

  attempts.delete(ip);
  res.setHeader("Set-Cookie", adminCookieHeader(sessionToken(), THIRTY_DAYS));
  return res.status(200).json({ ok: true });
}
