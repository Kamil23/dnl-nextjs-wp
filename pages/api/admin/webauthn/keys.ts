import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

// Zarządzanie kluczami (tylko zalogowany admin): lista i usuwanie.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const { webauthnCredentials } = dbSchema;

  if (req.method === "GET") {
    const keys = await db
      .select({
        id: webauthnCredentials.id,
        name: webauthnCredentials.name,
        createdAt: webauthnCredentials.createdAt,
        lastUsedAt: webauthnCredentials.lastUsedAt,
      })
      .from(webauthnCredentials);
    return res.json({ keys });
  }

  if (req.method === "DELETE") {
    const id = Number(req.body?.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id required" });
    await db.delete(webauthnCredentials).where(eq(webauthnCredentials.id, id));
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
