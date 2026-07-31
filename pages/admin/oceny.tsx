import { GetServerSideProps } from "next";
import Link from "next/link";
import { useState } from "react";
import { desc, eq } from "drizzle-orm";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { db, dbSchema } from "../../lib/db";

const STATUS_LABELS = {
  pending: { label: "Oczekuje", cls: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Zaakceptowana", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Odrzucona", cls: "bg-red-100 text-red-700" },
};

function Stars({ value }) {
  return (
    <span className="text-amber-400">
      {"★".repeat(value)}
      <span className="text-gray-200">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default function AdminRatings({ ratings: initial }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("pending");

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  async function moderate(id: number, status: "approved" | "rejected") {
    const res = await fetch(`/api/admin/ratings/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    }
  }

  return (
    <AdminShell title="Oceny">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">
          Oceny{" "}
          {pendingCount > 0 && (
            <span className="text-sm font-normal bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 align-middle">
              {pendingCount} do przejrzenia
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          {["pending", "approved", "rejected", "all"].map((s) => (
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
        <p className="text-gray-400 text-sm">Brak ocen w tym widoku. ✨</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Przepis</th>
                <th className="px-4 py-3 font-medium">Ocena</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={r.recipeUri} target="_blank" className="font-medium text-gray-900 hover:underline">
                      {r.recipeTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Stars value={r.value} /> <span className="text-gray-500">({r.value}/5)</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(r.createdAt).toLocaleString("pl-PL")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_LABELS[r.status].cls}`}>
                      {STATUS_LABELS[r.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status !== "approved" && (
                      <button
                        onClick={() => moderate(r.id, "approved")}
                        className="text-green-600 hover:text-green-800 font-medium mr-3"
                      >
                        ✓ Akceptuj
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button
                        onClick={() => moderate(r.id, "rejected")}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        ✕ Odrzuć
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const { ratings, recipes } = dbSchema;
  const rows = await db
    .select({
      id: ratings.id,
      value: ratings.value,
      status: ratings.status,
      createdAt: ratings.createdAt,
      recipeTitle: recipes.title,
      recipeUri: recipes.uri,
    })
    .from(ratings)
    .innerJoin(recipes, eq(recipes.id, ratings.recipeId))
    .orderBy(desc(ratings.createdAt))
    .limit(500);

  return { props: { ratings: JSON.parse(JSON.stringify(rows)) } };
};
