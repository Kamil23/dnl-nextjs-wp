import { GetServerSideProps } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { desc, eq } from "drizzle-orm";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { db, dbSchema } from "../../lib/db";

const STATUS_LABELS = {
  pending: { label: "Oczekuje", cls: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Zaakceptowany", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Odrzucony", cls: "bg-red-100 text-red-700" },
};

export default function AdminComments({ comments: initial }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("all");
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  // Flat list, newest first (rows arrive DESC from the server); replies carry
  // a quote of their parent for context instead of nesting.
  const byId = useMemo(() => new Map<number, any>(rows.map((r) => [r.id, r])), [rows]);
  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  async function moderate(id: number, status: "approved" | "rejected") {
    const res = await fetch(`/api/admin/comments/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    }
  }

  function subtreeIds(id: number) {
    const ids = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of rows) {
        if (r.parentId && ids.has(r.parentId) && !ids.has(r.id)) {
          ids.add(r.id);
          grew = true;
        }
      }
    }
    return ids;
  }

  async function remove(id: number) {
    const ids = subtreeIds(id);
    const msg =
      ids.size > 1 ? "Usunąć komentarz razem z odpowiedziami?" : "Usunąć komentarz?";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/admin/comments/${id}/`, { method: "DELETE" });
    if (res.ok) {
      setRows((rs) => rs.filter((r) => !ids.has(r.id)));
    }
  }

  async function sendReply(parent) {
    if (busy || !replyText.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/comments/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: parent.id, body: replyText.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      const { reply } = await res.json();
      setRows((rs) => [
        { ...reply, recipeTitle: parent.recipeTitle, recipeUri: parent.recipeUri },
        // Replying also approves a pending/rejected parent (server does the same)
        ...rs.map((r) => (r.id === parent.id ? { ...r, status: "approved" } : r)),
      ]);
      setReplyFor(null);
      setReplyText("");
    }
  }

  return (
    <AdminShell title="Komentarze">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">
          Komentarze{" "}
          {pendingCount > 0 && (
            <span className="text-sm font-normal bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 align-middle">
              {pendingCount} do przejrzenia
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                filter === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
              }`}
            >
              {s === "all" ? "Wszystkie" : STATUS_LABELS[s].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">Brak komentarzy w tym widoku. ✨</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const parent = c.parentId ? byId.get(c.parentId) : null;
            return (
              <div
                key={c.id}
                className={`rounded-xl border p-4 ${
                  c.isAuthor ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-2 flex-wrap text-sm">
                    <span className="font-semibold text-gray-900">{c.authorName}</span>
                    {c.isAuthor && (
                      <span className="text-xs bg-amber-500 text-white rounded-full px-2 py-0.5">
                        autorka
                      </span>
                    )}
                    <span className="text-gray-400">o</span>
                    <Link href={c.recipeUri} target="_blank" className="font-medium text-gray-900 hover:underline">
                      {c.recipeTitle}
                    </Link>
                    <span className="text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleString("pl-PL")}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_LABELS[c.status].cls}`}>
                    {STATUS_LABELS[c.status].label}
                  </span>
                </div>

                {c.parentId && (
                  <p className="mt-2 text-xs text-gray-400 truncate">
                    ↩ odpowiedź dla{" "}
                    <span className="font-medium text-gray-500">
                      {parent ? parent.authorName : "…"}
                    </span>
                    {parent && <>: „{parent.body}”</>}
                  </p>
                )}

                <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{c.body}</p>

                <div className="mt-3 flex items-center gap-4 text-sm">
                  {!c.isAuthor && c.status !== "approved" && (
                    <button onClick={() => moderate(c.id, "approved")} className="text-green-600 hover:text-green-800 font-medium">
                      ✓ Akceptuj
                    </button>
                  )}
                  {!c.isAuthor && c.status !== "rejected" && (
                    <button onClick={() => moderate(c.id, "rejected")} className="text-red-500 hover:text-red-700 font-medium">
                      ✕ Odrzuć
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setReplyFor(replyFor === c.id ? null : c.id);
                      setReplyText("");
                    }}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    ↩ Odpowiedz jako Roksana
                  </button>
                  <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-600 ml-auto">
                    Usuń
                  </button>
                </div>

                {replyFor === c.id && (
                  <div className="mt-3 flex gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      autoFocus
                      placeholder="Odpowiedź opublikuje się od razu, podpisana jako Roksana"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                    <button
                      onClick={() => sendReply(c)}
                      disabled={busy || !replyText.trim()}
                      className="self-end bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
                    >
                      Wyślij
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const { comments, recipes } = dbSchema;
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      authorName: comments.authorName,
      body: comments.body,
      isAuthor: comments.isAuthor,
      status: comments.status,
      createdAt: comments.createdAt,
      recipeTitle: recipes.title,
      recipeUri: recipes.uri,
    })
    .from(comments)
    .innerJoin(recipes, eq(recipes.id, comments.recipeId))
    .orderBy(desc(comments.createdAt))
    .limit(500);

  return { props: { comments: JSON.parse(JSON.stringify(rows)) } };
};
