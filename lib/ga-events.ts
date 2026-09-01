// Product events for GA4 (FEATURES.md §0 + strategia: North Star = decyzje
// żywieniowe). gtag loads only after cookie consent (pages/_app.tsx), so every
// call is guarded: no consent, no gtag, no event. Safe to call anywhere client-side.

type EventParams = Record<string, string | number | boolean | undefined>;

export function track(name: string, params?: EventParams) {
  if (typeof window === "undefined") return;
  (window as any).gtag?.("event", name, params);
}
