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

// Table-based 600px shell (email clients have no flex/grid), warm brand
// palette, hidden preheader (the line shown next to the subject in the inbox
// list — a proven open-rate lever) and a spam-compliant footer.
export function mailShell(inner: string, unsubToken?: string, preheader?: string) {
  const footer = unsubToken
    ? `<tr><td style="padding:20px 28px 28px;text-align:center;">
         <p style="margin:0;font-size:12px;line-height:1.6;color:#a8a29e;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
           Dostajesz tę wiadomość, bo zapisałaś(-eś) się na ${escapeHtml(SITE_TITLE)} (dietanaluzie.pl).<br/>
           <a href="${unsubscribeUrl(unsubToken)}" style="color:#a8a29e;">Wypisz się</a> · odpowiedz na tego maila, jeśli masz pytanie
         </p>
       </td></tr>`
    : "";
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; border-radius: 0 !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#faf6f0;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;">
<tr><td align="center" style="padding:24px 8px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;">
    <tr><td class="px" style="padding:28px 28px 0;text-align:center;">
      <div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#1f2937;">dieta na luzie 🧡</div>
      <div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;color:#a8a29e;margin-top:2px;">jak jeść i nie zwariować?</div>
    </td></tr>
    <tr><td class="px" style="padding:20px 28px 8px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
      ${inner}
    </td></tr>
    ${footer}
  </table>
</td></tr>
</table>
</body></html>`;
}

// Bulletproof button: padded table cell with bgcolor renders everywhere
// (a styled <a> alone collapses in Outlook)
export function mailButton(href: string, label: string, bg = "#111827", color = "#ffffff") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
    <tr><td bgcolor="${bg}" style="border-radius:999px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;font-weight:700;color:${color};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

const button = (href: string, label: string) => mailButton(href, label);

export function confirmMail(token: string, magnet: string | null) {
  const m = magnet ? MAGNETS[magnet] : null;
  const promise = m?.file
    ? `Po potwierdzeniu od razu dostaniesz PDF „${escapeHtml(m.title)}".`
    : m
      ? "Po potwierdzeniu jesteś na liście. Dam znać, gdy Planer ruszy."
      : "Po potwierdzeniu będziesz dostawać nowe przepisy i sezonowe pomysły.";
  return {
    subject: "Potwierdź zapis do Diety na luzie",
    html: mailShell(
      `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Cześć! Jeden klik i gotowe:</p>
      <div style="margin:0 0 20px;">${button(confirmUrl(token), "Potwierdzam zapis ✓")}</div>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.6;">${promise}</p>
      <p style="margin:0 0 20px;color:#9ca3af;font-size:13px;">Jeśli to nie Ty, po prostu zignoruj tę wiadomość.</p>
    `,
      undefined,
      "Jeden klik i prezent jest Twój"
    ),
  };
}

export function welcomeMail(token: string, magnet: string | null) {
  const m = magnet ? MAGNETS[magnet] : null;
  const magnetBlock = m?.file
    ? `<p style="margin:0 0 8px;font-size:16px;">Twój prezent czeka:</p>
       <div style="margin:0 0 20px;">${mailButton(`${SITE_URL}${m.file}`, `Pobieram PDF 🎁`, "#f59e0b", "#1f2937")}</div>`
    : m
      ? `<p style="margin:0 0 20px;font-size:16px;">Jesteś na liście oczekujących Planera. Odezwę się, gdy będzie gotowy do testów.</p>`
      : "";
  return {
    subject: m?.file ? `Twój PDF: ${m.title}` : "Witaj w Diecie na luzie!",
    html: mailShell(
      `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Dzięki za zapis! To ja, Roksana.</p>
      ${magnetBlock}
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.6;">Co jakiś czas wyślę Ci nowe przepisy z moich rolek, sezonowe pomysły i rzeczy, których nie wrzucam nigdzie indziej.</p>
      <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Na start zajrzyj po inspiracje: <a href="${SITE_URL}/kategoria/przepisy/" style="color:#b45309;font-weight:600;">wszystkie przepisy →</a></p>
    `,
      token,
      m?.file ? "Twój PDF jest w środku" : "Miło Cię widzieć!"
    ),
  };
}
