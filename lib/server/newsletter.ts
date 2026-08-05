// Newsletter core: magnets, tokens and Resend delivery. The subscriber list
// lives in our Postgres (lib/db/schema.ts:subscribers) — Resend is only the
// SMTP replacement. All copy is site content: no em-dashes in prose.
import { randomBytes } from "crypto";
import { SITE_TITLE, SITE_URL } from "../constants";

export const SIGNUP_SOURCES = [
  "recipe-slodkie",
  "recipe-slone",
  "kalkulator",
  "cook-mode",
  "stopka",
] as const;
export type SignupSource = (typeof SIGNUP_SOURCES)[number];

// Lead magnets: PDFs live on the media volume (Caddy serves /pobrane/* — the
// files are composed from our own recipes via /ebook/<key> printed to PDF).
export const MAGNETS: Record<
  string,
  { title: string; file: string } | { title: string; file: null }
> = {
  slodkie: {
    title: "Fit słodycze bez pieczenia: 10 przepisów",
    file: "/pobrane/fit-slodycze-bez-pieczenia.pdf",
  },
  slone: {
    title: "Szybkie fit posiłki: 10 przepisów",
    file: "/pobrane/szybkie-fit-posilki.pdf",
  },
  planer: { title: "Lista oczekujących Planera", file: null },
};

export function magnetForSource(source: SignupSource): string | null {
  if (source === "recipe-slodkie") return "slodkie";
  if (source === "recipe-slone") return "slone";
  if (source === "kalkulator") return "planer";
  return null;
}

export function newToken(): string {
  return randomBytes(24).toString("hex");
}

export function confirmUrl(token: string) {
  return `${SITE_URL}/api/newsletter/potwierdz?t=${token}`;
}
export function unsubscribeUrl(token: string) {
  return `${SITE_URL}/api/newsletter/wypisz?t=${token}`;
}

const FROM = process.env.NEWSLETTER_FROM || `Roksana | ${SITE_TITLE} <roksana@dietanaluzie.pl>`;

type Mail = { to: string; subject: string; html: string; unsubToken?: string };

async function resendRequest(path: string, body: unknown) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Brak RESEND_API_KEY");
  const res = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function toPayload(m: Mail) {
  return {
    from: FROM,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    ...(m.unsubToken
      ? {
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl(m.unsubToken)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  };
}

export async function sendMail(m: Mail) {
  return resendRequest("/emails", toPayload(m));
}

// Resend batch endpoint accepts up to 100 mails per call
export async function sendBatch(mails: Mail[]) {
  for (let i = 0; i < mails.length; i += 100) {
    await resendRequest("/emails/batch", mails.slice(i, i + 100).map(toPayload));
  }
}

// ── mail templates ───────────────────────────────────────────────────────────

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mailShell(inner: string, unsubToken?: string) {
  const footer = unsubToken
    ? `<p style="margin-top:32px;font-size:12px;color:#9ca3af;">
         Dostajesz tę wiadomość, bo zapisałaś(-eś) się na ${escapeHtml(SITE_TITLE)}.
         <a href="${unsubscribeUrl(unsubToken)}" style="color:#9ca3af;">Wypisz się</a>
       </p>`
    : "";
  return `<!doctype html><html lang="pl"><body style="margin:0;background:#faf9f7;padding:24px 12px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937;line-height:1.6;">
    <div style="font-size:22px;font-weight:700;margin-bottom:4px;">${escapeHtml(SITE_TITLE)}</div>
    <div style="font-size:13px;color:#9ca3af;margin-bottom:24px;">jak jeść i nie zwariować?</div>
    ${inner}
    ${footer}
  </div>
</body></html>`;
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 22px;font-weight:600;">${escapeHtml(label)}</a>`;
}

export function confirmMail(token: string, magnet: string | null) {
  const m = magnet ? MAGNETS[magnet] : null;
  const promise = m?.file
    ? `Po potwierdzeniu od razu dostaniesz PDF „${escapeHtml(m.title)}".`
    : m
      ? "Po potwierdzeniu jesteś na liście. Dam znać, gdy Planer ruszy."
      : "Po potwierdzeniu będziesz dostawać nowe przepisy i sezonowe pomysły.";
  return {
    subject: "Potwierdź zapis do Diety na luzie",
    html: mailShell(`
      <p style="margin:0 0 16px;">Cześć! Jeden klik i gotowe:</p>
      <p style="margin:0 0 20px;">${button(confirmUrl(token), "Potwierdzam zapis")}</p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">${promise}</p>
      <p style="margin:0;color:#9ca3af;font-size:13px;">Jeśli to nie Ty, po prostu zignoruj tę wiadomość.</p>
    `),
  };
}

export function welcomeMail(token: string, magnet: string | null) {
  const m = magnet ? MAGNETS[magnet] : null;
  const magnetBlock = m?.file
    ? `<p style="margin:0 0 8px;">Twój prezent czeka:</p>
       <p style="margin:0 0 20px;">${button(`${SITE_URL}${m.file}`, `Pobierz PDF: ${m.title}`)}</p>`
    : m
      ? `<p style="margin:0 0 20px;">Jesteś na liście oczekujących Planera. Odezwę się, gdy będzie gotowy do testów.</p>`
      : "";
  return {
    subject: m?.file ? `Twój PDF: ${m.title}` : "Witaj w Diecie na luzie!",
    html: mailShell(
      `
      <p style="margin:0 0 16px;">Dzięki za zapis! To ja, Roksana.</p>
      ${magnetBlock}
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">Co jakiś czas wyślę Ci nowe przepisy z moich rolek, sezonowe pomysły i rzeczy, których nie wrzucam nigdzie indziej.</p>
      <p style="margin:0;color:#6b7280;font-size:14px;">Na start zajrzyj po inspiracje: <a href="${SITE_URL}/kategoria/przepisy/" style="color:#111827;">wszystkie przepisy</a>.</p>
    `,
      token
    ),
  };
}
