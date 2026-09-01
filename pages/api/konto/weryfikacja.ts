import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db, dbSchema } from "../../../lib/db";
import {
  createSessionValue,
  SESSION_MAX_AGE_SECONDS,
  userCookieHeader,
} from "../../../lib/user-auth";

const { users, loginTokens } = dbSchema;

// Cel linku z maila: jednorazowy token → sesja w cookie → powrót na `next`.
// Zły albo zużyty token prowadzi na /moje-przepisy/?blad=link (strona pokaże
// komunikat i formularz do wysłania nowego linku).
const FALLBACK_NEXT = "/moje-przepisy/";
const FAIL_REDIRECT = "/moje-przepisy/?blad=link";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = String(req.query.token || "");
  const nextRaw = String(req.query.next || "");
  // Tylko ścieżki wewnętrzne: "//host" i "/\host" to open redirect
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\")
      ? nextRaw
      : FALLBACK_NEXT;

  // newToken() = 48 znaków hex; wszystko inne odpada bez pytania bazy
  if (!/^[0-9a-f]{48}$/.test(token)) return res.redirect(302, FAIL_REDIRECT);

  try {
    const [row] = await db.select().from(loginTokens).where(eq(loginTokens.token, token));
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return res.redirect(302, FAIL_REDIRECT);
    }

    await db.update(loginTokens).set({ usedAt: new Date() }).where(eq(loginTokens.id, row.id));
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.userId));

    res.setHeader(
      "Set-Cookie",
      userCookieHeader(createSessionValue(row.userId), SESSION_MAX_AGE_SECONDS)
    );
    return res.redirect(302, next);
  } catch (e: any) {
    console.error("weryfikacja magic-link:", e.message);
    return res.redirect(302, FAIL_REDIRECT);
  }
}
