import type { NextApiRequest, NextApiResponse } from "next";
import { searchEnabled, searchMeili, type RecipeDoc } from "../../lib/search";
import { logSearch } from "../../lib/server/search-log";

// „Z lodówki": co ugotuję z tego, co mam.
//   GET /api/z-lodowki?skladniki=kurczak,ryż,brokuł
// Każdy składnik odpytuje Meili osobno (równolegle, składniki są w polu
// przeszukiwalnym indeksu), wyniki łączymy po uri, a ranking premiuje
// przepisy pokrywające najwięcej podanych składników.

const MIN_ITEMS = 1;
const MAX_ITEMS = 8;
const MIN_LEN = 2;
const MAX_LEN = 40;
const PER_INGREDIENT_LIMIT = 60;
const TOP = 24;

type LodowkaHit = {
  title: string;
  uri: string;
  heroImage: string | null;
  lead: string | null;
  kcal: number | null;
  protein: number | null;
  totalTimeMin: number | null;
  ratingValue: number | null;
  // które z podanych składników przepis pokrywa (w kolejności zapytania)
  matched: string[];
  matchedCount: number;
  // ile składników podał użytkownik
  total: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Dozwolone tylko GET." });
  }

  const raw = typeof req.query.skladniki === "string" ? req.query.skladniki : "";
  const pozycje = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (pozycje.length < MIN_ITEMS || pozycje.length > MAX_ITEMS) {
    return res
      .status(400)
      .json({ error: `Podaj od ${MIN_ITEMS} do ${MAX_ITEMS} składników, rozdzielonych przecinkami.` });
  }
  if (pozycje.some((s) => s.length < MIN_LEN || s.length > MAX_LEN)) {
    return res
      .status(400)
      .json({ error: `Każdy składnik musi mieć od ${MIN_LEN} do ${MAX_LEN} znaków.` });
  }

  // Duplikaty (np. „ser,Ser") sklejamy do pierwszego wystąpienia,
  // żeby nie odpytywać Meili dwa razy i nie zawyżać `total`.
  const widziane = new Set<string>();
  const skladniki = pozycje.filter((s) => {
    const key = s.toLowerCase();
    if (widziane.has(key)) return false;
    widziane.add(key);
    return true;
  });

  if (!searchEnabled()) return res.json({ hits: [] });

  let perSkladnik: RecipeDoc[][];
  try {
    perSkladnik = await Promise.all(
      skladniki.map((s) => searchMeili({ q: s, limit: PER_INGREDIENT_LIMIT }))
    );
  } catch {
    // Meili chwilowo niedostępny: pusta lista zamiast 500 (wzór: /api/szukaj)
    return res.json({ hits: [] });
  }

  // uri → dokument + zbiór składników, na które przepis się załapał
  const byUri = new Map<string, { doc: RecipeDoc; matched: Set<string> }>();
  perSkladnik.forEach((docs, i) => {
    const nazwa = skladniki[i];
    for (const doc of docs) {
      const entry = byUri.get(doc.uri);
      if (entry) entry.matched.add(nazwa);
      else byUri.set(doc.uri, { doc, matched: new Set([nazwa]) });
    }
  });

  // Ranking: pokrycie składników DESC, potem ocena DESC (brak oceny na końcu),
  // potem kcal ASC (brak kcal na końcu).
  const ranked = [...byUri.values()].sort((a, b) => {
    if (b.matched.size !== a.matched.size) return b.matched.size - a.matched.size;
    const ra = a.doc.ratingValue ?? null;
    const rb = b.doc.ratingValue ?? null;
    if (ra !== rb) {
      if (ra == null) return 1;
      if (rb == null) return -1;
      return rb - ra;
    }
    const ka = a.doc.kcal ?? Number.POSITIVE_INFINITY;
    const kb = b.doc.kcal ?? Number.POSITIVE_INFINITY;
    return ka - kb;
  });

  const hits: LodowkaHit[] = ranked.slice(0, TOP).map(({ doc, matched }) => ({
    title: doc.title,
    uri: doc.uri,
    heroImage: doc.heroImage ?? null,
    lead: doc.lead ?? null,
    kcal: doc.kcal ?? null,
    protein: doc.protein ?? null,
    totalTimeMin: doc.totalTimeMin ?? null,
    ratingValue: doc.ratingValue ?? null,
    matched: skladniki.filter((s) => matched.has(s)),
    matchedCount: matched.size,
    total: skladniki.length,
  }));

  // Best-effort: analityka nigdy nie może zepsuć odpowiedzi.
  try {
    await logSearch(skladniki.join(", "), hits.length, "lodowka", req);
  } catch {
    // cisza
  }

  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate");
  return res.json({ hits });
}
