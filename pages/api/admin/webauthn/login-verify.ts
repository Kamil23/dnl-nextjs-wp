import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { adminCookieHeader, sessionToken } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import {
  clearChallengeCookieHeader,
  clearPreauthCookieHeader,
  expectedOrigin,
  hasValidPreauth,
  readChallenge,
  rpID,
} from "../../../../lib/server/webauthn";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

// Finał logowania: preauth (hasło) + podpis klucza = pełna sesja admina.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!hasValidPreauth(req)) return res.status(401).json({ error: "Najpierw podaj hasło" });

  const challenge = readChallenge(req);
  if (!challenge) return res.status(400).json({ error: "Challenge wygasł, spróbuj ponownie" });

  const response = req.body?.response;
  const credId = response?.id;
  if (!response || typeof credId !== "string") {
    return res.status(400).json({ error: "Brak odpowiedzi klucza" });
  }

  const { webauthnCredentials } = dbSchema;
  const [cred] = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, credId));
  if (!cred) return res.status(400).json({ error: "Nieznany klucz" });

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpID(),
      credential: {
        id: cred.credentialId,
        publicKey: isoBase64URL.toBuffer(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports ? (cred.transports.split(",") as any) : undefined,
      },
    });
    if (!verification.verified) {
      return res.status(401).json({ error: "Weryfikacja klucza nie powiodła się" });
    }

    await db
      .update(webauthnCredentials)
      .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
      .where(eq(webauthnCredentials.id, cred.id));

    res.setHeader("Set-Cookie", [
      adminCookieHeader(sessionToken(), THIRTY_DAYS),
      clearPreauthCookieHeader(),
      clearChallengeCookieHeader(),
    ]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message?.slice(0, 200) || "Błąd weryfikacji" });
  }
}
