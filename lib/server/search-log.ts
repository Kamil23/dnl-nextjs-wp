import { createHash } from "crypto";
import { and, eq, gte } from "drizzle-orm";
import { db, dbSchema } from "../db";

const { searchLog } = dbSchema;

// Minimalny kształt żądania (NextApiRequest i GSS ctx.req różnią się typami)
type ReqLike = {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | null } | null;
};

// Anonimowy fingerprint (ip|ua|salt) - wyłącznie do throttlingu powtórzeń,
// nie do identyfikacji użytkowników (zgodnie z FEATURES.md §0: bez ID).
function fingerprint(req: ReqLike): string {
  const xff = req.headers["x-forwarded-for"];
  const ip =
    (typeof xff === "string" ? xff : Array.isArray(xff) ? xff[0] : undefined)
      ?.split(",")[0]
      ?.trim() || req.socket?.remoteAddress || "";
  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
  const salt = process.env.ADMIN_SECRET || "dnl";
  return createHash("sha256").update(`${ip}|${ua}|${salt}`).digest("hex").slice(0, 32);
}

// Sugestie hero lecą przy każdym klawiszu - ta sama fraza od tej samej
// przeglądarki w oknie throttle to jeden wpis. Strona /szukaj (pełne
// zapytanie z Enterem) dostaje krótsze okno.
const THROTTLE_SECONDS = { hero: 1800, szukaj: 300 } as const;

// Loguje wyszukiwanie; nigdy nie rzuca - analityka nie może psuć UX.
export async function logSearch(
  phrase: string,
  results: number,
  source: keyof typeof THROTTLE_SECONDS,
  req: ReqLike
): Promise<void> {
  try {
    const clean = phrase.trim().toLowerCase().slice(0, 80);
    if (clean.length < 2) return;

    const fp = fingerprint(req);
    const since = new Date(Date.now() - THROTTLE_SECONDS[source] * 1000);
    const [recent] = await db
      .select({ id: searchLog.id })
      .from(searchLog)
      .where(
        and(
          eq(searchLog.phrase, clean),
          eq(searchLog.fingerprint, fp),
          gte(searchLog.createdAt, since)
        )
      )
      .limit(1);
    if (recent) return;

    await db.insert(searchLog).values({
      phrase: clean,
      results: Math.max(0, Math.min(results, 100000)),
      source,
      fingerprint: fp,
    });
  } catch {
    // cisza - brak logu nigdy nie może wywrócić wyszukiwania
  }
}
