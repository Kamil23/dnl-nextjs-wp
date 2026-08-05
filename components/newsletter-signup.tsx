import Link from "next/link";
import { useState } from "react";

type Source = "recipe-slodkie" | "recipe-slone" | "kalkulator" | "cook-mode" | "stopka";

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
  const c = COPY[source];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
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
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
