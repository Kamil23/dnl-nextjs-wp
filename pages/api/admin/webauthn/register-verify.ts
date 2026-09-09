import type { NextApiRequest, NextApiResponse } from "next";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import {
  clearChallengeCookieHeader,
  expectedOrigin,
  readChallenge,
  rpID,
} from "../../../../lib/server/webauthn";

// Krok 2 rejestracji: weryfikacja odpowiedzi przeglądarki i zapis klucza.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const challenge = readChallenge(req);
  if (!challenge) return res.status(400).json({ error: "Challenge wygasł, spróbuj ponownie" });

  const { response, name } = req.body ?? {};
  if (!response) return res.status(400).json({ error: "Brak odpowiedzi klucza" });

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpID(),
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "Weryfikacja klucza nie powiodła się" });
    }

    const cred = verification.registrationInfo.credential;
    await db
      .insert(dbSchema.webauthnCredentials)
      .values({
        credentialId: cred.id,
        publicKey: isoBase64URL.fromBuffer(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports?.join(",") ?? null,
        name: typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : "Klucz",
      })
      .onConflictDoNothing();

    res.setHeader("Set-Cookie", clearChallengeCookieHeader());
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message?.slice(0, 200) || "Błąd weryfikacji" });
  }
}
