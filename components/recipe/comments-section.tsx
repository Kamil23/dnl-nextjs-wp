import { useState } from "react";

type CommentNode = {
  id: number;
  parentId: number | null;
  authorName: string;
  body: string;
  isAuthor: boolean;
  createdAt: string | null;
};

function plural(n: number) {
  if (n === 1) return "1 komentarz";
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return `${n} komentarze`;
  return `${n} komentarzy`;
}

function dateLabel(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })
    : "";
}

function CommentCard({ c, reply }: { c: CommentNode; reply?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        c.isAuthor ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"
      } ${reply ? "ml-8 mt-2" : ""}`}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-semibold text-gray-900">{c.authorName}</span>
        {c.isAuthor && (
          <span className="text-xs bg-amber-500 text-white rounded-full px-2 py-0.5">autorka</span>
        )}
        <span className="text-xs text-gray-400">{dateLabel(c.createdAt)}</span>
      </div>
      <p className="mt-1 text-gray-700 leading-relaxed whitespace-pre-line">{c.body}</p>
    </div>
  );
}

// Approved comments arrive server-rendered (SEO-friendly, ISR keeps them
// fresh); new ones go through moderation, so submitting only shows a note.
export default function CommentsSection({
  recipeId,
  comments,
}: {
  recipeId: number;
  comments: CommentNode[];
}) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, stays empty for humans
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesFor = (id: number) => comments.filter((c) => c.parentId === id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/komentarze/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId, name, body, website }),
    });
    setBusy(false);
    if (res.ok) {
      setSent(true);
      setBody("");
    } else {
      const msg = await res
        .json()
        .then((j) => j.error)
        .catch(() => null);
      setError(msg || "Nie udało się wysłać komentarza, spróbuj ponownie");
    }
  }

  return (
    <section id="komentarze" className="scroll-mt-6">
      <h2 className="text-xl font-bold tracking-tight mb-1">Komentarze</h2>
      <p className="text-sm text-gray-500 mb-5">
        {topLevel.length > 0
          ? plural(comments.length)
          : "Zrobiłaś ten przepis? Podziel się wrażeniami!"}
      </p>

      {topLevel.length > 0 && (
        <div className="space-y-3 mb-8">
          {topLevel.map((c) => (
            <div key={c.id}>
              <CommentCard c={c} />
              {repliesFor(c.id).map((r) => (
                <CommentCard key={r.id} c={r} reply />
              ))}
            </div>
          ))}
        </div>
      )}

      {sent ? (
        <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
          Dziękujemy! Twój komentarz pojawi się po akceptacji. 🧡
        </p>
      ) : (
        <form
          onSubmit={submit}
          className="rounded-3xl border border-gray-100 bg-white shadow-bottomSmall p-5 space-y-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Twoje imię"
            className="w-full sm:max-w-xs border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            minLength={2}
            maxLength={2000}
            rows={4}
            placeholder="Twój komentarz: jak wyszło, co zmieniłaś, o co chcesz dopytać?"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={busy || !name.trim() || body.trim().length < 2}
              className="bg-gray-900 text-white rounded-xl px-5 py-2 text-sm hover:bg-amber-500 transition disabled:opacity-50"
            >
              {busy ? "Wysyłanie..." : "Dodaj komentarz"}
            </button>
            <span className="text-xs text-gray-400">
              Komentarze pojawiają się po akceptacji.
            </span>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </section>
  );
}
