import type { NextApiRequest, NextApiResponse } from "next";
import { and, desc, eq, or } from "drizzle-orm";
import { requireAdminApi } from "../../../lib/admin-auth";
import { db, dbSchema } from "../../../lib/db";

// Zlecenia dla workera odpalane z panelu (worker ma yt-dlp i klucze AI,
// kontener web nie). GET: status ostatniego zlecenia (+interwał backlogu).
// POST {kind, action:'run', payload?} dodaje zlecenie;
// POST {kind:'tiktok_backlog', action:'interval', days} zapisuje interwał.

const KINDS = ["tiktok_backlog", "substitutions"] as const;
type Kind = (typeof KINDS)[number];

const INTERVAL_KEY = "tiktok_backlog_interval_days";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const { jobs, appSettings } = dbSchema;

  if (req.method === "GET") {
    const kind = req.query.kind as Kind;
    if (!KINDS.includes(kind)) return res.status(400).json({ error: "kind?" });
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.kind, kind))
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    let intervalDays: number | null = null;
    if (kind === "tiktok_backlog") {
      const [s] = await db.select().from(appSettings).where(eq(appSettings.key, INTERVAL_KEY));
      intervalDays = Number(s?.value ?? 0);
    }
    return res.json({ job: job ?? null, intervalDays });
  }

  if (req.method === "POST") {
    const { kind, action } = req.body ?? {};
    if (!KINDS.includes(kind)) return res.status(400).json({ error: "kind?" });

    if (action === "interval") {
      if (kind !== "tiktok_backlog") return res.status(400).json({ error: "interwał tylko dla backlogu" });
      const days = Math.max(0, Math.min(30, Number(req.body?.days) || 0));
      await db
        .insert(appSettings)
        .values({ key: INTERVAL_KEY, value: days })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: days, updatedAt: new Date() } });
      return res.json({ ok: true, intervalDays: days });
    }

    if (action === "run") {
      const active = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.kind, kind), or(eq(jobs.status, "pending"), eq(jobs.status, "running"))));
      if (active.length > 0) return res.status(409).json({ error: "Zlecenie już czeka lub trwa" });

      const payload = kind === "substitutions" ? { limit: Math.max(1, Math.min(50, Number(req.body?.limit) || 10)) } : null;
      const [job] = await db.insert(jobs).values({ kind, status: "pending", payload }).returning();
      return res.json({ ok: true, job });
    }

    return res.status(400).json({ error: "action?" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
