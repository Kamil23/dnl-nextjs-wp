import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { listRecipesAdmin } from "../../lib/queries";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  published: { label: "Opublikowany", cls: "bg-green-100 text-green-800" },
  draft: { label: "Szkic", cls: "bg-gray-200 text-gray-700" },
  review: { label: "Do akceptacji", cls: "bg-yellow-100 text-yellow-800" },
};

export default function AdminRecipes({ recipes: initial }) {
  const router = useRouter();
  const [recipes, setRecipes] = useState(initial);
  const [filter, setFilter] = useState<string>("all");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered =
    filter === "all" ? recipes : recipes.filter((r) => r.status === filter);

  async function removeDraft(r: { id: number; title: string }) {
    if (!confirm(`Usunąć szkic „${r.title}"? Tej operacji nie można cofnąć.`)) return;
    const res = await fetch(`/api/admin/recipes/${r.id}/`, { method: "DELETE" });
    if (res.ok) setRecipes((rs) => rs.filter((x) => x.id !== r.id));
  }

  async function createRecipe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    setBusy(false);
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/admin/przepisy/${id}`);
    }
  }

  return (
    <AdminShell title="Przepisy">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex gap-2">
          {["all", "published", "draft", "review"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                filter === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
              }`}
            >
              {s === "all" ? `Wszystkie (${recipes.length})` : STATUS_LABELS[s].label}
            </button>
          ))}
        </div>
        <form onSubmit={createRecipe} className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tytuł nowego przepisu..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <button
            type="submit"
            disabled={busy || !newTitle.trim()}
            className="bg-gray-900 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            + Dodaj
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tytuł</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ocena</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Źródło</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/przepisy/${r.id}`} className="font-medium text-gray-900 hover:underline">
                    {r.title}
                  </Link>
                  <div className="text-xs text-gray-400">{r.uri}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_LABELS[r.status]?.cls}`}>
                    {STATUS_LABELS[r.status]?.label ?? r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {r.legacyRatingValue ? `★ ${r.legacyRatingValue} (${r.legacyRatingCount})` : "-"}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("pl-PL") : "-"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.source}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link href={`/admin/przepisy/${r.id}/podglad`} target="_blank" className="text-gray-400 hover:text-gray-700 text-xs mr-3">
                    podgląd ↗
                  </Link>
                  {r.status !== "published" && (
                    <button
                      onClick={() => removeDraft(r)}
                      className="text-red-400 hover:text-red-600 text-xs"
                      title="Usuń szkic"
                    >
                      usuń
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const recipes = await listRecipesAdmin();
  return { props: { recipes: JSON.parse(JSON.stringify(recipes)) } };
};
