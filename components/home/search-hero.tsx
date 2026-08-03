import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = ["sernik", "obiad w 30 minut", "owsianka", "bez pieczenia"];

type Hit = { title: string; uri: string; heroImage: string | null; kcal: number | null; totalTimeMin: number | null };

export default function SearchHero() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Live suggestions (debounced) — typo-tolerant thanks to Meilisearch
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/szukaj/?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setHits(data.hits ?? []);
        setOpen(true);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/szukaj/?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <section className="text-center py-10 md:py-14 mb-10 rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-2">
        Na co masz dziś ochotę? 🍴
      </h2>
      <p className="text-gray-500 mb-6">
        Ponad 100 sprawdzonych, fit przepisów — bez zwariowania.
      </p>
      <div ref={boxRef} className="relative max-w-xl mx-auto px-4">
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => hits.length && setOpen(true)}
            placeholder="np. sernik, kurczak, śniadanie..."
            className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 shadow-bottomSmall focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="Szukaj przepisu"
          />
          <button
            type="submit"
            className="rounded-full bg-gray-900 text-white px-6 py-3 font-semibold hover:bg-amber-500 transition shadow-small"
          >
            Szukaj
          </button>
        </form>

        {open && hits.length > 0 && (
          <div className="absolute z-30 mt-2 left-4 right-4 rounded-2xl bg-white shadow-medium border border-gray-100 overflow-hidden text-left">
            {hits.map((h) => (
              <Link
                key={h.uri}
                href={h.uri}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 transition"
              >
                {h.heroImage ? (
                  <span className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0">
                    <Image src={h.heroImage} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                ) : (
                  <span className="w-11 h-11 rounded-lg bg-amber-100 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900 truncate">{h.title}</span>
                  <span className="block text-xs text-gray-400">
                    {[h.totalTimeMin && `⏱ ${h.totalTimeMin} min`, h.kcal && `🔥 ${h.kcal} kcal`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            ))}
            <button
              onClick={submit as any}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-900 py-2.5 border-t border-gray-100"
            >
              Wszystkie wyniki dla „{q}" →
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-2 flex-wrap text-sm px-4">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => router.push(`/szukaj/?q=${encodeURIComponent(s)}`)}
            className="rounded-full bg-white/70 border border-gray-200 px-3 py-1 text-gray-600 hover:border-amber-400 hover:text-gray-900 transition"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
