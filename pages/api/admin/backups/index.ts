import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { listBackups, createBackup } from "../../../../lib/server/backup";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    return res.status(200).json({ backups: listBackups() });
  }

  if (req.method === "POST") {
    try {
      const created = await createBackup();
      return res.status(200).json({ ok: true, ...created, backups: listBackups() });
    } catch (e: any) {
      return res.status(500).json({ error: e.message?.slice(0, 300) || "Błąd backupu" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
