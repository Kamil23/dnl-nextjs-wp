// WebAuthn (klucz sprzętowy / passkey) dla panelu admina. Warstwa wspólna dla
// endpointów: rpID/origin z APP_ORIGIN, podpisane cookies na challenge
// (5 minut) i na stan "hasło OK, czekamy na klucz" (preauth).
import { createHmac, timingSafeEqual } from "crypto";
import type { NextApiRequest } from "next";

const ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";

export function expectedOrigin() {
  return ORIGIN;
}

export function rpID() {
  return new URL(ORIGIN).hostname;
}

export const RP_NAME = "Dieta na luzie - panel";

const CHALLENGE_COOKIE = "dnl_webauthn_ch";
const PREAUTH_COOKIE = "dnl_admin_pre";
const CHALLENGE_TTL = 5 * 60;
const PREAUTH_TTL = 5 * 60;

function hmac(label: string, payload: string) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET is not set");
  return createHmac("sha256", secret).update(`${label}:${payload}`).digest("hex");
}

function safeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function cookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// --- challenge (rejestracja i logowanie) ---

export function challengeCookieHeader(challenge: string) {
  const exp = Math.floor(Date.now() / 1000) + CHALLENGE_TTL;
  const sig = hmac("dnl-webauthn-ch-v1", `${challenge}.${exp}`);
  return cookie(CHALLENGE_COOKIE, `${challenge}.${exp}.${sig}`, CHALLENGE_TTL);
}

export function readChallenge(req: NextApiRequest): string | null {
  const raw = req.cookies?.[CHALLENGE_COOKIE];
  if (!raw) return null;
  const [challenge, expStr, sig] = raw.split(".");
  if (!challenge || !expStr || !sig) return null;
  const exp = parseInt(expStr, 10);
  if (!exp || exp * 1000 < Date.now()) return null;
  try {
    if (!safeEq(sig, hmac("dnl-webauthn-ch-v1", `${challenge}.${exp}`))) return null;
  } catch {
    return null;
  }
  return challenge;
}

export function clearChallengeCookieHeader() {
  return cookie(CHALLENGE_COOKIE, "", 0);
}

// --- preauth: hasło przeszło, sesja czeka na potwierdzenie kluczem ---

export function preauthCookieHeader() {
  const exp = Math.floor(Date.now() / 1000) + PREAUTH_TTL;
  const sig = hmac("dnl-admin-preauth-v1", String(exp));
  return cookie(PREAUTH_COOKIE, `${exp}.${sig}`, PREAUTH_TTL);
}

export function hasValidPreauth(req: NextApiRequest): boolean {
  const raw = req.cookies?.[PREAUTH_COOKIE];
  if (!raw) return false;
  const [expStr, sig] = raw.split(".");
  if (!expStr || !sig) return false;
  const exp = parseInt(expStr, 10);
  if (!exp || exp * 1000 < Date.now()) return false;
  try {
    return safeEq(sig, hmac("dnl-admin-preauth-v1", String(exp)));
  } catch {
    return false;
  }
}

export function clearPreauthCookieHeader() {
  return cookie(PREAUTH_COOKIE, "", 0);
}
