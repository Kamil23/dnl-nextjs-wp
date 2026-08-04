import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import path from "path";
import { requireAdminApi } from "../../../../lib/admin-auth";

// Kicks off the import worker (scripts/process-imports.ts) from the admin,
// so nobody has to SSH in and run it by hand. The worker updates
// imports.progress as it goes and the admin page already live-polls that,
// so this endpoint only needs to start the process and return.
//
// Single-flight: one worker at a time. The child inherits the server's
// env (.env is loaded by Next), and needs yt-dlp + ffmpeg on PATH.
const globalForWorker = globalThis as unknown as { importWorker?: { startedAt: number } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    return res.json({ running: !!globalForWorker.importWorker });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (globalForWorker.importWorker) {
    return res.status(409).json({ error: "Worker już działa" });
  }
  globalForWorker.importWorker = { startedAt: Date.now() };

  const child = spawn("npx", ["tsx", "scripts/process-imports.ts"], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => console.log(`[imports-worker] ${String(d).trimEnd()}`));
  child.stderr.on("data", (d) => console.error(`[imports-worker] ${String(d).trimEnd()}`));
  child.on("exit", (code) => {
    console.log(`[imports-worker] zakończony (kod ${code})`);
    globalForWorker.importWorker = undefined;
  });
  child.on("error", (e) => {
    console.error(`[imports-worker] nie wystartował: ${e.message}`);
    globalForWorker.importWorker = undefined;
  });
  child.unref();

  return res.status(202).json({ ok: true });
}
