import { SITE_URL } from "../constants";

// IndexNow: natychmiastowe powiadomienie Bing/Yandex/Naver/Seznam o nowych i
// zmienionych URL-ach. Google NIE wspiera protokołu - dla Google liczy się
// dokładny <lastmod> w sitemap.xml. Indeks Binga to warstwa wyszukiwania
// ChatGPT Search i Copilota, więc szybka obecność tam = widoczność w AI search.
// Jeden POST na api.indexnow.org propaguje do wszystkich uczestników protokołu.
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS_PER_REQUEST = 10000; // limit specyfikacji

/**
 * Zgłasza ścieżki (lub pełne URL-e) do IndexNow. No-op bez INDEXNOW_KEY
 * (dev/staging). Nigdy nie rzuca - błąd tylko loguje, żeby nie blokować
 * zapisu w adminie. Zwraca liczbę zgłoszonych URL-i albo null gdy pominięto.
 */
export async function notifyIndexNow(paths: string[]): Promise<number | null> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return null;

  const urlList = Array.from(new Set(paths))
    .filter(Boolean)
    .map((p) => (p.startsWith("http") ? p : `${SITE_URL}${p}`))
    .slice(0, MAX_URLS_PER_REQUEST);
  if (urlList.length === 0) return null;

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key,
        // Root, nie /api/ - katalog pliku klucza wyznacza zakres zgłaszanych
        // URL-i (rewrite w next.config.js kieruje na /api/indexnow-key)
        keyLocation: `${SITE_URL}/${key}.txt`,
        urlList,
      }),
    });
    if (!res.ok) {
      console.error(`IndexNow: HTTP ${res.status} dla ${urlList.length} URL-i`);
      return null;
    }
    return urlList.length;
  } catch (e) {
    console.error("IndexNow: ping nieudany", e);
    return null;
  }
}
