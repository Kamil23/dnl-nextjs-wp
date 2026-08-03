import { useRouter } from "next/router";
import { useState } from "react";

const SUGGESTIONS = ["sernik", "obiad w 30 minut", "owsianka", "bez pieczenia"];

export default function SearchHero() {
  const router = useRouter();
  const [q, setQ] = useState("");

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
      <form onSubmit={submit} className="flex justify-center gap-2 px-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="np. sernik, kurczak, śniadanie..."
          className="w-full max-w-md rounded-full border border-gray-200 bg-white px-5 py-3 shadow-bottomSmall focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Szukaj przepisu"
        />
        <button
          type="submit"
          className="rounded-full bg-gray-900 text-white px-6 py-3 font-semibold hover:bg-amber-500 transition shadow-small"
        >
          Szukaj
        </button>
      </form>
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
