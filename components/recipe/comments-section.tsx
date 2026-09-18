import { useMemo, useState } from "react";

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

function CommentCard({ c, onReply }: { c: CommentNode; onReply: () => void }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        c.isAuthor ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"
      }`}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-semibold text-gray-900">{c.authorName}</span>
        {c.isAuthor && (
          <span className="text-xs bg-amber-500 text-white rounded-full px-2 py-0.5">autorka</span>
        )}
        <span className="text-xs text-gray-400">{dateLabel(c.createdAt)}</span>
      </div>
      <p className="mt-1 text-gray-700 leading-relaxed whitespace-pre-line">{c.body}</p>
      <button
        type="button"
        onClick={onReply}
        className="mt-2 text-xs font-medium text-gray-500 hover:text-amber-600"
      >
        ↩ Odpowiedz
      </button>
    </div>
  );
}

function ReplyForm({
  recipeId,
  parentId,
  onSent,
}: {
  recipeId: number;
  parentId: number;
  onSent: () => void;
}) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, stays empty for humans
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/komentarze/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId, parentId, name, body, website }),
    });
    setBusy(false);
    if (res.ok) {
      onSent();
    } else {
      const msg = await res
        .json()
        .then((j) => j.error)
        .catch(() => null);
      setError(msg || "Nie udało się wysłać odpowiedzi, spróbuj ponownie");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 rounded-2xl border border-gray-200 bg-white p-4 space-y-2"
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
        rows={3}
        autoFocus
        placeholder="Twoja odpowiedź"
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
          className="bg-gray-900 text-white rounded-xl px-4 py-2 text-sm hover:bg-amber-500 transition disabled:opacity-50"
        >
          {busy ? "Wysyłanie..." : "Odpowiedz"}
        </button>
        <span className="text-xs text-gray-400">Odpowiedzi pojawiają się po akceptacji.</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

// Approved comments arrive server-rendered (SEO-friendly, ISR keeps them
// fresh); new ones go through moderation, so submitting only shows a note.
// Threads nest arbitrarily deep via parentId - the indent stops growing after
// a few levels so long conversations stay readable on mobile.
const MAX_INDENT_DEPTH = 4;

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
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [sentFor, setSentFor] = useState<number | null>(null);

  const topLevel = comments.filter((c) => !c.parentId);
  const byParent = useMemo(() => {
    const m = new Map<number, CommentNode[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const list = m.get(c.parentId) ?? [];
      list.push(c);
      m.set(c.parentId, list);
    }
    return m;
  }, [comments]);

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

  function renderThread(c: CommentNode, depth: number) {
    return (
      <div
        key={c.id}
        className={depth === 0 ? "" : depth <= MAX_INDENT_DEPTH ? "ml-5 sm:ml-8 mt-2" : "mt-2"}
      >
        <CommentCard
          c={c}
          onReply={() => {
            setReplyFor(replyFor === c.id ? null : c.id);
            setSentFor(null);
          }}
        />
        {replyFor === c.id && (
          <ReplyForm
            recipeId={recipeId}
            parentId={c.id}
            onSent={() => {
              setReplyFor(null);
              setSentFor(c.id);
            }}
          />
        )}
        {sentFor === c.id && (
          <p className="mt-2 text-sm text-green-600 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
            Dziękujemy! Twoja odpowiedź pojawi się po akceptacji. 🧡
          </p>
        )}
        {(byParent.get(c.id) ?? []).map((child) => renderThread(child, depth + 1))}
      </div>
    );
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
        <div className="space-y-3 mb-8">{topLevel.map((c) => renderThread(c, 0))}</div>
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
