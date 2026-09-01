import { CALCULATORS } from "./calculators";
import { INGREDIENTS } from "./measures";
import { COLLECTION_SLUGS } from "./collections";
import { THEMES } from "./seasonal";
import { AUTHOR_PAGE_PATH } from "./constants";

// Jedno źródło prawdy dla tras sitemapy spoza bazy. Pochodne z rejestrów
// (kalkulatory, konwerter, kolekcje, sezony), więc każda nowa pozycja w tych
// listach pojawia się w sitemapie automatycznie — bez ręcznej edycji sitemap.xml.
// Nową samodzielną stronę (plikową, indeksowalną) dorzucasz do STANDALONE_PATHS.

// Indeksowalne strony plikowe nieobjęte żadnym rejestrem ani tabelą `pages` (DB).
// Pomijamy narzędzia noindex (np. /szukaj, /lista-zakupow) — nie należą do sitemapy.
const STANDALONE_PATHS = [
  "/",
  "/co-na-obiad/",
  "/z-lodowki/",
  "/kalkulatory/",
  "/konwerter/",
  AUTHOR_PAGE_PATH, // /autor/roksana/
];

// Wszystkie ścieżki (bez SITE_URL) do wrzucenia do sitemapy obok treści z bazy.
export function staticSitemapPaths(): string[] {
  return [
    ...STANDALONE_PATHS,
    ...CALCULATORS.map((c) => `/${c.slug}/`),
    ...INGREDIENTS.map((i) => `/konwerter/${i.slug}/`),
    ...COLLECTION_SLUGS.map((s) => `/kolekcje/${s}/`),
    ...THEMES.map((t) => `/sezon/${t.key}/`),
  ];
}
