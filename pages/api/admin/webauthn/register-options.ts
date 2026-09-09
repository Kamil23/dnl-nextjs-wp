import type { NextApiRequest, NextApiResponse } from "next";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import { challengeCookieHeader, expectedOrigin, rpID, RP_NAME } from "../../../../lib/server/webauthn";

// Krok 1 rejestracji klucza (tylko zalogowany admin): opcje + challenge w cookie.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const existing = await db.select().from(dbSchema.webauthnCredentials);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(),
    userName: "admin",
    userDisplayName: "Admin Dieta na luzie",
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (c.transports.split(",") as any) : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  res.setHeader("Set-Cookie", challengeCookieHeader(options.challenge));
  // origin do debugowania niezgodności rpID w dev/prod
  return res.json({ options, origin: expectedOrigin() });
}
