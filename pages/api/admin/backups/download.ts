import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { backupFilePath } from "../../../../lib/server/backup";

// Media tarballs can be hundreds of MB — disable the default 4MB response cap.
export const config = { api: { responseLimit: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const full = backupFilePath(String(req.query.file || ""));
  if (!full) return res.status(404).json({ error: "Nie ma takiego pliku" });
  const stat = fs.statSync(full);
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Length", String(stat.size));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(full)}"`
  );
  fs.createReadStream(full).pipe(res);
}
