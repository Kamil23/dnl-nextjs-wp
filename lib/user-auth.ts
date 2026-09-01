// Lekka sesja czytelnika (magic link, bez haseł): podpisany cookie w stylu
// lib/admin-auth.ts, ale z WŁASNĄ etykietą HMAC, żeby token użytkownika i token
// admina nigdy nie były wymienne. Wartość cookie: `${userId}.${exp}.${hmac}`,
// gdzie exp to epoch w sekundach, a hmac = HMAC-SHA256(ADMIN_SECRET) z
// `dnl-user-session-v1:${userId}.${exp}` (hex).
import { createHmac, timingSafeEqual } from "crypto";
import type { NextApiRequest } from "next";
import type { GetServerSidePropsContext } from "next";

export const USER_COOKIE = "dnl_user";

// 180 dni: sesja ma przeżyć rzadkie wizyty (blog kulinarny, nie bank)
export const SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const HMAC_LABEL = "dnl-user-session-v1";

function sign(payload: string): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET is not set");
  return createHmac("sha256", secret).update(`${HMAC_LABEL}:${payload}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createSessionValue(userId: number): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

// Zwraca userId albo null (zły podpis, zły format, sesja wygasła)
export function verifySessionValue(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userIdRaw, expRaw, mac] = parts;
  if (!/^\d+$/.test(userIdRaw) || !/^\d+$/.test(expRaw)) return null;
  try {
    if (!safeEqual(mac, sign(`${userIdRaw}.${expRaw}`))) return null;
  } catch {
    // brak ADMIN_SECRET albo nietypowy bufor - traktuj jak brak sesji
    return null;
  }
  const exp = parseInt(expRaw, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const userId = parseInt(userIdRaw, 10);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export function getUserIdFromRequest(
  req: NextApiRequest | GetServerSidePropsContext["req"]
): number | null {
  const cookie = req.cookies?.[USER_COOKIE];
  if (!cookie) return null;
  return verifySessionValue(cookie);
}

// Wzór: adminCookieHeader (Path=/; HttpOnly; SameSite=Lax; Secure w produkcji)
export function userCookieHeader(value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${USER_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearUserCookieHeader(): string {
  return userCookieHeader("", 0);
}
