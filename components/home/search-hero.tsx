import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import RecipeTile, { type RecipeTileData } from "../recipe-tile";

// Focus-panel suggestions, steered by the market research: the highest-demand
// niches (high-protein - driven by the GLP-1 wave - and calorie-aware satiety)
// get top billing and point at STATIC collection pages, so they always work and
// never depend on the search engine being up.
const GOALS = [
  { label: "🍽️ Co na obiad?", href: "/co-na-obiad/" },
  { label: "💪 Wysokobiałkowe", href: "/kolekcje/wysokie-bialko/" },
  { label: "🥗 Sycące do 500 kcal", href: "/kolekcje/glp1/" },
];

// Dish ideas run a live search (typo-tolerant); kept to terms that return hits.
const IDEAS = ["owsianka", "sernik", "kurczak", "naleśniki"];

// Browse entry points - static category pages (also work without the engine).
const BROWSE = [
  { label: "Śniadania", path: "/kategoria/przepisy/sniadania/" },
  { label: "Obiad", path: "/kategoria/przepisy/obiad/" },
  { label: "Fit słodycze", path: "/kategoria/przepisy/fit-slodycze/" },
  { label: "Jednoporcjowe", path: "/kategoria/przepisy/jednoporcjowe/" },
];

// Instant search: typing renders a grid of big recipe tiles right under
// the box (the rest of the homepage steps aside via onActiveChange) -
// the user picks by photo instead of reading a dropdown.
// `compact` renders a slimmer variant for non-homepage placements (recipe pages).
export default function SearchHero({
  onActiveChange,
  compact = false,
}: {
  onActiveChange?: (active: boolean) => void
  compact?: boolean
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RecipeTileData[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const lastQuery = useRef("");

  const active = q.trim().length >= 2;
  // Show the idea panel only while the empty box has focus.
  const showIdeas = focused && !active;

  useEffect(() => {
    onActiveChange?.(active);
    if (!active) {
      setHits([]);
      return;
    }
    setSearching(true);
    const query = q.trim();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/szukaj/?q=${encodeURIComponent(query)}&limit=12`);
        const data = await res.json();
        // ignore responses that arrive after a newer query
        if (lastQuery.current === query || true) {
          lastQuery.current = query;
          setHits(data.hits ?? []);
        }
      } catch {
      } finally {
        setSearching(false);
      }
    }, 250);
    lastQuery.current = query;
    return () => clearTimeout(t);
  }, [q, active, onActiveChange]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    // Empty box → do nothing (stay on the homepage; the idea panel guides the
    // user). Only a real query goes to the full results page.
    if (query) router.push(`/szukaj/?q=${encodeURIComponent(query)}`);
  }

  return (
    <>
      <section
        className={`text-center rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 ${
          compact ? "py-8 mb-10" : "py-10 md:py-14 mb-10"
        }`}
      >
        <h2
          className={`font-bold tracking-tighter ${
            compact ? "text-2xl mb-4" : "text-3xl md:text-4xl mb-2"
          }`}
        >
          {compact ? "Szukasz czegoś innego? 🔍" : "Na co masz dziś ochotę? 🍴"}
        </h2>
        {!compact && (
          <p className="text-gray-500 mb-6">
            Ponad 100 fit przepisów, każdy sprawdzony w mojej kuchni.
          </p>
        )}
        {/* Wspólny kontener: panel sugestii siada dokładnie pod inputem, na jego szerokość */}
        <div className="max-w-xl mx-auto px-4">
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            // delay so a click on a suggestion registers before the panel hides
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="np. sernik, kurczak, śniadanie..."
            className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 shadow-bottomSmall focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="Szukaj przepisu"
          />
          {active ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="rounded-full bg-white border border-gray-200 text-gray-500 px-5 py-3 font-semibold hover:border-gray-400 transition shadow-small shrink-0"
              aria-label="Wyczyść wyszukiwanie"
            >
              ✕
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-full bg-gray-900 text-white px-6 py-3 font-semibold hover:bg-amber-500 transition shadow-small shrink-0"
            >
              Szukaj
            </button>
          )}
        </form>
        {showIdeas && (
          <div className="w-full mt-3 rounded-2xl border border-gray-100 bg-white shadow-bottomSmall p-4 text-left">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Szukasz pod cel?</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {GOALS.map((g) => (
                <Link
                  key={g.href}
                  href={g.href}
                  className="rounded-full bg-amber-500 text-white px-3 py-1.5 text-sm hover:bg-amber-600 transition"
                >
                  {g.label}
                </Link>
              ))}
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Może na to masz ochotę?</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {IDEAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => setQ(s)}
                  className="rounded-full bg-amber-50 border border-amber-100 text-amber-800 px-3 py-1.5 text-sm hover:border-amber-300 transition"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Albo przeglądaj</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {BROWSE.map((c) => (
                <Link key={c.path} href={c.path} className="text-gray-600 hover:text-gray-900 hover:underline underline-offset-2">
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        </div>
      </section>

      {active && (
        <section className="mb-14" aria-live="polite">
          <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {searching && hits.length === 0
                ? "Szukam..."
                : hits.length > 0
                  ? `Wyniki dla „${q.trim()}"`
                  : `Nic nie znalazłam dla „${q.trim()}" 😔`}
            </h2>
            {hits.length > 0 && (
              <Link
                href={`/szukaj/?q=${encodeURIComponent(q.trim())}`}
                className="text-sm text-gray-500 hover:text-gray-900 underline"
              >
                Filtry i wszystkie wyniki →
              </Link>
            )}
          </div>

          {hits.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {hits.map((h) => (
                <RecipeTile key={h.uri} recipe={h} />
              ))}
            </div>
          ) : (
            !searching && (
              <p className="text-gray-500">
                Spróbuj prościej, np. „sernik", „kurczak", „owsianka". Literówki
                nie przeszkadzają.
              </p>
            )
          )}
        </section>
      )}
    </>
  );
}
