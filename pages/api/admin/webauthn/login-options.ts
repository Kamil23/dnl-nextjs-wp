import type { NextApiRequest, NextApiResponse } from "next";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db, dbSchema } from "../../../../lib/db";
import { challengeCookieHeader, hasValidPreauth, rpID } from "../../../../lib/server/webauthn";

// Krok 2 logowania (po poprawnym haśle = ważny preauth): opcje uwierzytelnienia.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!hasValidPreauth(req)) return res.status(401).json({ error: "Najpierw podaj hasło" });

  const creds = await db.select().from(dbSchema.webauthnCredentials);
  if (creds.length === 0) return res.status(400).json({ error: "Brak zarejestrowanych kluczy" });

  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "preferred",
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (c.transports.split(",") as any) : undefined,
    })),
  });

  res.setHeader("Set-Cookie", challengeCookieHeader(options.challenge));
  return res.json({ options });
}
