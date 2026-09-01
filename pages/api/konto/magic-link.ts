import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, dbSchema } from "../../../lib/db";
import {
  mailButton,
  mailShell,
  newToken,
  normalizeEmail,
  sendMail,
} from "../../../lib/server/newsletter";
import { SITE_TITLE, SITE_URL } from "../../../lib/constants";

const { users, loginTokens } = dbSchema;

// Magic link do logowania czytelnika: upsert konta po mailu + jednorazowy
// token (15 min). Endpoint ZAWSZE odpowiada {ok:true} dla poprawnego maila,
// żeby nie dało się sprawdzić, czy dany adres ma u nas konto.
const TOKEN_TTL_MS = 15 * 60 * 1000;
// Anty-spam: nie wysyłamy drugiego maila, jeśli świeży link wciąż jest w drodze
const RESEND_COOLDOWN_MS = 60 * 1000;

// Publiczny endpoint wysyłający maile → prosty throttle per IP
// (ten sam wzorzec co /api/newsletter)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, { n: number; since: number }>();

function clientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  return (
    (Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0].trim()) ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function throttled(req: NextApiRequest): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.since > WINDOW_MS) {
    hits.set(ip, { n: 1, since: now });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

function loginMail(url: string) {
  return {
    subject: `Twój link do logowania - ${SITE_TITLE}`,
    html: mailShell(
      `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Cześć! Kliknij, aby się zalogować:</p>
      <div style="margin:0 0 20px;">${mailButton(url, "Zaloguj mnie")}</div>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.6;">Link działa 15 minut i można go użyć tylko raz.</p>
      <p style="margin:0 0 20px;color:#9ca3af;font-size:13px;">Jeśli to nie Ty, po prostu zignoruj tę wiadomość.</p>
    `,
      undefined,
      "Jeden klik i jesteś w środku"
    ),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (throttled(req)) {
    return res.status(429).json({ error: "Za dużo prób. Spróbuj za chwilę." });
  }

  const emailRaw =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!emailRaw || emailRaw.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return res.status(400).json({ error: "Podaj poprawny adres e-mail" });
  }

  // Dokąd wrócić po zalogowaniu: tylko ścieżki wewnętrzne (żadnych "//host")
  const nextRaw = typeof req.body?.next === "string" ? req.body.next : "";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\")
      ? nextRaw
      : "/moje-przepisy/";

  const email = normalizeEmail(emailRaw);

  try {
    // Upsert konta po mailu (unikalny indeks users_email_idx)
    await db.insert(users).values({ email }).onConflictDoNothing({ target: users.email });
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return res.status(200).json({ ok: true });

    // Niewykorzystany token młodszy niż 60 s → nie wysyłaj ponownie
    const cutoff = new Date(Date.now() - RESEND_COOLDOWN_MS);
    const [recent] = await db
      .select({ id: loginTokens.id })
      .from(loginTokens)
      .where(
        and(
          eq(loginTokens.userId, user.id),
          isNull(loginTokens.usedAt),
          gt(loginTokens.createdAt, cutoff)
        )
      )
      .limit(1);
    if (recent) return res.status(200).json({ ok: true });

    const token = newToken();
    await db.insert(loginTokens).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });

    const url = `${SITE_URL}/api/konto/weryfikacja?token=${token}&next=${encodeURIComponent(next)}`;
    try {
      const mail = loginMail(url);
      await sendMail({ to: email, subject: mail.subject, html: mail.html });
    } catch (e: any) {
      // Świadomie {ok:true}: brak sygnału dla botów, błąd zostaje w logach
      console.error("magic-link mail:", e.message);
    }
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("magic-link:", e.message);
    return res.status(200).json({ ok: true });
  }
}
