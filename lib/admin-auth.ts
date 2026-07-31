// Single-operator auth: a signed session cookie derived from ADMIN_SECRET.
// Login checks ADMIN_PASSWORD; middleware and API routes verify the cookie.
import { createHmac, timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import type { GetServerSidePropsContext } from "next";

export const ADMIN_COOKIE = "dnl_admin";

export function sessionToken() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET is not set");
  return createHmac("sha256", secret).update("dnl-admin-session-v1").digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isAdminRequest(
  req: NextApiRequest | GetServerSidePropsContext["req"]
) {
  const cookie = req.cookies?.[ADMIN_COOKIE];
  if (!cookie) return false;
  try {
    return safeEqual(cookie, sessionToken());
  } catch {
    return false;
  }
}

export function requireAdminApi(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdminRequest(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export function adminCookieHeader(value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}
