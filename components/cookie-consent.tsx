import Link from "next/link";

// Consent state lives in localStorage; GA (the only non-essential cookie
// source) is mounted by _app only after "granted". The footer's "Ustawienia
// cookies" clears the key and dispatches dnl-cookies-reset to reopen this.
export const CONSENT_KEY = "dnl-cookies";
export type Consent = "granted" | "denied";

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONSENT_KEY);
  return v === "granted" || v === "denied" ? v : null;
}

export function resetConsent() {
  localStorage.removeItem(CONSENT_KEY);
  window.dispatchEvent(new Event("dnl-cookies-reset"));
}

export default function CookieConsent({
  onDecision,
}: {
  onDecision: (v: Consent) => void;
}) {
  function decide(v: Consent) {
    localStorage.setItem(CONSENT_KEY, v);
    onDecision(v);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] p-4 sm:p-6 pointer-events-none print:hidden">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-amber-100 bg-white shadow-medium p-5">
        <p className="font-bold tracking-tight mb-1">Ciasteczka? 🍪</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Używamy cookies wyłącznie do anonimowych statystyk, żeby wiedzieć,
          które przepisy Ci smakują. Żadnych reklam. Szczegóły w{" "}
          <Link href="/polityka-prywatnosci/" className="underline hover:text-gray-900">
            polityce prywatności
          </Link>
          .
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => decide("denied")}
            className="rounded-full border border-gray-300 px-4 py-2.5 text-sm font-medium hover:border-gray-900 transition-colors"
          >
            Tylko niezbędne
          </button>
          <button
            onClick={() => decide("granted")}
            className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Akceptuję
          </button>
        </div>
      </div>
    </div>
  );
}
