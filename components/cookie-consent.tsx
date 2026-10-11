import Link from "next/link";
import { useState } from "react";

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
  // Accept is the one-tap path; refusing lives behind "Ustawienia
  // zaawansowane" (still reachable in two taps, toggle starts unchecked).
  const [advanced, setAdvanced] = useState(false);
  const [stats, setStats] = useState(false);

  function decide(v: Consent) {
    localStorage.setItem(CONSENT_KEY, v);
    onDecision(v);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] p-4 sm:p-6 pointer-events-none print:hidden">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-amber-100 bg-white shadow-medium p-5 animate-consent-in">
        <p className="font-bold tracking-tight mb-1">Pomożesz nam ulepszać przepisy? 🍪</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Anonimowe statystyki pokazują nam, które przepisy smakują Ci
          najbardziej i co gotować dalej. Zero reklam, zero sprzedawania
          danych. Szczegóły w{" "}
          <Link href="/polityka-prywatnosci/" className="underline hover:text-gray-900">
            polityce prywatności
          </Link>
          .
        </p>

        {advanced && (
          <div className="mb-4 space-y-3 border-t border-gray-100 pt-4 text-sm">
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block font-medium">Niezbędne</span>
                <span className="block text-gray-500">Działanie strony, zapamiętanie tego wyboru.</span>
              </span>
              <input type="checkbox" checked disabled className="mt-1 h-4 w-4 accent-gray-900" />
            </label>
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <span>
                <span className="block font-medium">Statystyki</span>
                <span className="block text-gray-500">Google Analytics, anonimowe dane o odwiedzinach.</span>
              </span>
              <input
                type="checkbox"
                checked={stats}
                onChange={(e) => setStats(e.target.checked)}
                className="mt-1 h-4 w-4 accent-gray-900"
              />
            </label>
          </div>
        )}

        <button
          onClick={() => decide("granted")}
          className="w-full rounded-full bg-gray-900 text-white px-4 py-3 text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          Zgadzam się
        </button>
        {advanced ? (
          <button
            onClick={() => decide(stats ? "granted" : "denied")}
            className="mt-2 w-full rounded-full border border-gray-300 px-4 py-2.5 text-sm font-medium hover:border-gray-900 transition-colors"
          >
            Zapisz wybór
          </button>
        ) : (
          <button
            onClick={() => setAdvanced(true)}
            className="mt-3 block mx-auto text-xs text-gray-500 underline hover:text-gray-900"
          >
            Ustawienia zaawansowane
          </button>
        )}
      </div>
    </div>
  );
}
