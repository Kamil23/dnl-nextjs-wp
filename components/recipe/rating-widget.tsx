import { useEffect, useState } from "react";

// Star voting: one vote per reader (server dedups by fingerprint, we also
// remember the vote locally to show it after a revisit).
export default function RatingWidget({ recipeId, rating }) {
  const [hover, setHover] = useState(0);
  const [myVote, setMyVote] = useState(0);
  const [agg, setAgg] = useState(rating);
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const storageKey = `dnl-rating-${recipeId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setMyVote(parseInt(saved, 10));
    } catch {}
  }, [storageKey]);

  async function vote(value: number) {
    if (busy) return;
    setBusy(true);
    setMyVote(value);
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {}
    const res = await fetch("/api/oceny/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId, value }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.count > 0) setAgg({ value: data.value, count: data.count });
      setThanks(true);
    }
    setBusy(false);
  }

  // Idle state shows the current average; hover and the reader's own vote win
  const display = hover || myVote || (agg ? Math.round(Number(agg.value)) : 0);

  return (
    <div className="mt-8 rounded-3xl border border-gray-100 bg-white shadow-bottomSmall p-6 text-center print:hidden">
      <h2 className="text-xl font-bold tracking-tight mb-1">Oceń ten przepis</h2>
      <p className="text-sm text-gray-500 mb-4">
        {agg
          ? `Średnia ${Number(agg.value).toFixed(1)} na podstawie ${agg.count} ocen`
          : "Bądź pierwszą osobą, która oceni!"}
      </p>
      <div
        className="flex justify-center gap-1 text-4xl select-none"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label="Oceń przepis w skali 1-5"
      >
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => vote(v)}
            onMouseEnter={() => setHover(v)}
            role="radio"
            aria-checked={myVote === v}
            aria-label={`${v} ${v === 1 ? "gwiazdka" : "gwiazdki"}`}
            className={`transition-transform hover:scale-125 ${
              v <= display ? "text-amber-400" : "text-gray-200"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {thanks && (
        <p className="text-sm text-green-600 mt-3">Dziękujemy za Twoją ocenę! 🧡</p>
      )}
    </div>
  );
}
