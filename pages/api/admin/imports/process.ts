import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

// Kicks off the import worker (scripts/process-imports.ts) from the admin,
// so nobody has to SSH in and run it by hand.
//
// Two environments, two behaviours:
//  - dev (repo on disk): spawn the worker as a child process, single-flight.
//  - production (standalone build in Docker): the source tree, tsx and
//    ffmpeg/yt-dlp are NOT in this container — the dedicated `worker` compose
//    service polls the queue every 10 s instead, so POST is just an ack and
//    "running" is inferred from the DB (any row in `processing`).
const globalForWorker = globalThis as unknown as { importWorker?: { startedAt: number } };

const WORKER_SCRIPT = path.join(process.cwd(), "scripts", "process-imports.ts");

async function dbProcessing(): Promise<boolean> {
  const rows = await db
    .select({ id: dbSchema.imports.id })
    .from(dbSchema.imports)
    .where(eq(dbSchema.imports.status, "processing"))
    .limit(1);
  return rows.length > 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    return res.json({ running: !!globalForWorker.importWorker || (await dbProcessing()) });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (globalForWorker.importWorker || (await dbProcessing())) {
    return res.status(409).json({ error: "Worker już działa" });
  }

  // Standalone build → no worker script here; the `worker` service picks the
  // queue up on its own within ~10 s.
  if (!fs.existsSync(WORKER_SCRIPT)) {
    return res.status(202).json({ ok: true, delegated: true });
  }

  globalForWorker.importWorker = { startedAt: Date.now() };

  const child = spawn("npx", ["tsx", WORKER_SCRIPT], {
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
