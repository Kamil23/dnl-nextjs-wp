import type { NextApiRequest, NextApiResponse } from "next";
import { adminCookieHeader, safeEqual, sessionToken } from "../../../lib/admin-auth";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const password = req.body?.password;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof password !== "string" || !safeEqual(password, expected)) {
    return res.status(401).json({ error: "Nieprawidłowe hasło" });
  }
  res.setHeader("Set-Cookie", adminCookieHeader(sessionToken(), THIRTY_DAYS));
  return res.status(200).json({ ok: true });
}
