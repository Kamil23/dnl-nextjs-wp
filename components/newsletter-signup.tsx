import Link from "next/link";
import { useRef, useState } from "react";

type Source =
  | "recipe-slodkie"
  | "recipe-slone"
  | "kalkulator"
  | "cook-mode"
  | "stopka"
  | "konwerter"
  | "kolekcje";

// Cloudflare Turnstile guards the footer variant only: the footer sits on every
// page, so it is the form spambots find. The CF script and widget load lazily on
// first focus to stay off the critical path. No site key configured → no captcha
// (dev, or before the keys land in .env).
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string };
  }
}

const COPY: Record<Source, { emoji: string; title: string; text: string; cta: string }> = {
  "recipe-slodkie": {
    emoji: "🍰",
    title: "10 fit słodyczy bez pieczenia",
    text: "Zostaw mail, a wyślę Ci PDF z przepisami, które robią furorę na TikToku. Zero pieczenia, pełne makro.",
    cta: "Wyślij mi PDF",
  },
  "recipe-slone": {
    emoji: "🍕",
    title: "Szybkie fit posiłki: 10 przepisów",
    text: "PDF z pomysłami na obiady i kolacje w kwadrans. Zostaw mail, wysyłam od razu.",
    cta: "Wyślij mi PDF",
  },
  kalkulator: {
    emoji: "📅",
    title: "Tydzień jedzenia pod Twój wynik?",
    text: "Buduję Planer, który ułoży Ci menu z moich przepisów pod Twoje kalorie, z gotową listą zakupów. Zapisz się, dostaniesz dostęp jako pierwsza(-y).",
    cta: "Zapisz mnie na listę",
  },
  "cook-mode": {
    emoji: "💌",
    title: "Chcesz więcej takich przepisów?",
    text: "Nowe przepisy z rolek i sezonowe pomysły, prosto na maila.",
    cta: "Zapisuję się",
  },
  stopka: {
    emoji: "💌",
    title: "Nowe przepisy prosto na maila",
    text: "Co dwa tygodnie: nowości z rolek i sezonowe pomysły.",
    cta: "Zapisuję się",
  },
  konwerter: {
    emoji: "💌",
    title: "Więcej kulinarnych ściąg?",
    text: "Nowe przepisy, tabele przeliczników i sezonowe pomysły prosto na maila.",
    cta: "Zapisuję się",
  },
  kolekcje: {
    emoji: "💌",
    title: "Chcesz więcej takich przepisów?",
    text: "Nowe przepisy z tej kolekcji trafiają też do newslettera — zapisz się, żeby nic nie przegapić.",
    cta: "Zapisuję się",
  },
};

export default function NewsletterSignup({
  source,
  compact = false,
}: {
  source: Source;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  // Anti-bot: honeypot value (must stay empty) + mount time, checked server-side
  const [website, setWebsite] = useState("");
  const [mountedAt] = useState(() => Date.now());
  const captcha = source === "stopka" && !!TURNSTILE_SITE_KEY;
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaMounted = useRef(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const c = COPY[source];

  function mountCaptcha() {
    if (!captcha || captchaMounted.current || !captchaRef.current) return;
    captchaMounted.current = true;
    const render = () =>
      window.turnstile?.render(captchaRef.current!, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        size: "flexible",
        callback: (t: string) => setCaptchaToken(t),
        "expired-callback": () => setCaptchaToken(""),
      });
    if (window.turnstile) {
      render();
      return;
    }
    const s = document.createElement("script");
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (captcha && !captchaToken) {
      setState("error");
      setError("Chwila, trwa weryfikacja antybotowa. Spróbuj za moment.");
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source,
          hp: website,
          ts: mountedAt,
          cf: captchaToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Coś poszło nie tak");
      setState("done");
    } catch (err: any) {
      setState("error");
      setError(err.message || "Coś poszło nie tak. Spróbuj ponownie.");
    }
  }

  if (state === "done") {
    return (
      <div className={`rounded-2xl bg-amber-50 border border-amber-100 ${compact ? "p-4" : "p-6"} print:hidden`}>
        <p className="font-semibold">Sprawdź skrzynkę 📬</p>
        <p className="text-sm text-gray-600 mt-1">
          Wysłałam Ci maila z linkiem potwierdzającym. Kliknij go, a wszystko ruszy.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-amber-50 border border-amber-100 ${compact ? "p-4" : "p-6"} print:hidden`}>
      <p className={`font-bold tracking-tight ${compact ? "text-base" : "text-lg"}`}>
        {c.emoji} {c.title}
      </p>
      <p className="text-sm text-gray-600 mt-1 mb-3">{c.text}</p>
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={mountCaptcha}
          placeholder="twoj@email.pl"
          className="flex-1 rounded-full border border-amber-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-full bg-gray-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
        >
          {state === "sending" ? "Wysyłam…" : c.cta}
        </button>
      </form>
      {captcha && <div ref={captchaRef} className="mt-2 empty:hidden" />}
      {state === "error" && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <p className="text-[11px] text-gray-400 mt-2">
        Zapisując się akceptujesz{" "}
        <Link href="/polityka-prywatnosci/" className="underline">
          politykę prywatności
        </Link>
        . Wypiszesz się jednym klikiem.
      </p>
    </div>
  );
}
