import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import RecipeTile, { type RecipeTileData } from "../recipe-tile";

const SUGGESTIONS = ["sernik", "obiad w 30 minut", "owsianka", "bez pieczenia"];

// Instant search: typing renders a grid of big recipe tiles right under
// the box (the rest of the homepage steps aside via onActiveChange) —
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
  const lastQuery = useRef("");

  const active = q.trim().length >= 2;

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
    router.push(`/szukaj/?q=${encodeURIComponent(q.trim())}`);
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
        <form onSubmit={submit} className="flex justify-center gap-2 px-4 max-w-xl mx-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
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
        {!active && (
          <div className="mt-4 flex justify-center gap-2 flex-wrap text-sm px-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="rounded-full bg-white/70 border border-gray-200 px-3 py-1 text-gray-600 hover:border-amber-400 hover:text-gray-900 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}
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
