import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import {
  countByStatus,
  listDraftSubstitutionsGrouped,
  type DraftSubstitutionGroup,
  type DraftSubstitutionItem,
} from "../../lib/substitutions";

// Moderacja zamienników składników ("Czym zastąpić?"): AI wygenerowało szkice
// (scripts/generate-substitutions.ts), tutaj Roksana je poprawia i akceptuje.
// Na stronę przepisu trafiają wyłącznie zaakceptowane.

type Counts = { draft: number; approved: number; rejected: number };
type EditState = { substitute: string; effect: string; kcalDelta: string };

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

const defaults = (it: DraftSubstitutionItem): EditState => ({
  substitute: it.substitute,
  effect: it.effect ?? "",
  kcalDelta: it.kcalDelta != null ? String(it.kcalDelta) : "0",
});

export default function AdminZamienniki({
  groups,
  counts,
}: {
  groups: DraftSubstitutionGroup[];
  counts: Counts;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<number, EditState>>({});

  const editFor = (it: DraftSubstitutionItem): EditState => edits[it.id] ?? defaults(it);
  const updateEdit = (it: DraftSubstitutionItem, patch: Partial<EditState>) =>
    setEdits((prev) => ({ ...prev, [it.id]: { ...(prev[it.id] ?? defaults(it)), ...patch } }));

  async function decide(it: DraftSubstitutionItem, status: "approved" | "rejected") {
    const v = editFor(it);
    if (status === "approved" && !v.substitute.trim()) {
      alert("Zamiennik nie może być pusty.");
      return;
    }
    setBusy(it.id);
    try {
      const kcal = parseInt(v.kcalDelta, 10);
      const payload =
        status === "approved"
          ? {
              status,
              substitute: v.substitute.trim(),
              effect: v.effect.trim() || null,
              kcalDelta: Number.isFinite(kcal) ? kcal : 0,
            }
          : { status };
      const res = await fetch(`/api/admin/substitutions/${it.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      router.replace(router.asPath); // odśwież listę i liczniki po zapisie
    } catch (e) {
      alert("Nie udało się zapisać: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell title="Zamienniki">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Zamienniki</h1>
        <p className="text-sm text-gray-500">
          Sekcja &bdquo;Czym zastąpić?&rdquo; na stronach przepisów. Publikują się tylko
          zaakceptowane.{" "}
          <span className="text-amber-600 font-medium">
            {counts.draft} {plural(counts.draft, "szkic", "szkice", "szkiców")}
          </span>
          ,{" "}
          <span className="text-emerald-600 font-medium">
            {counts.approved}{" "}
            {plural(counts.approved, "zaakceptowany", "zaakceptowane", "zaakceptowanych")}
          </span>
          ,{" "}
          <span className="text-gray-400">
            {counts.rejected} {plural(counts.rejected, "odrzucony", "odrzucone", "odrzuconych")}
          </span>
          .
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-gray-500">
          Brak szkiców. Wygeneruj:{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[13px] text-gray-700">
            npm run substitutions:generate
          </code>
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.recipeId}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={`/admin/przepisy/${g.recipeId}`}
                  className="font-semibold text-gray-900 hover:underline"
                >
                  {g.recipeTitle}
                </Link>
                <Link
                  href={g.recipeUri}
                  target="_blank"
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  podgląd ↗
                </Link>
                <span className="text-xs text-gray-400">
                  {g.items.length} {plural(g.items.length, "szkic", "szkice", "szkiców")}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Składnik</th>
                      <th className="px-4 py-3 font-medium">Zamiennik</th>
                      <th className="px-4 py-3 font-medium">Efekt</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap" title="Zmiana kcal na porcję">
                        Δkcal
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {g.items.map((it) => {
                      const v = editFor(it);
                      return (
                        <tr key={it.id}>
                          <td className="px-4 py-3 align-top text-gray-800 max-w-[220px]">
                            {it.ingredientText}
                          </td>
                          <td className="px-4 py-3 align-top min-w-[180px]">
                            <input
                              value={v.substitute}
                              onChange={(e) => updateEdit(it, { substitute: e.target.value })}
                              disabled={busy === it.id}
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 align-top min-w-[220px]">
                            <input
                              value={v.effect}
                              onChange={(e) => updateEdit(it, { effect: e.target.value })}
                              disabled={busy === it.id}
                              placeholder="wpływ na smak lub teksturę"
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              value={v.kcalDelta}
                              onChange={(e) => updateEdit(it, { kcalDelta: e.target.value })}
                              disabled={busy === it.id}
                              inputMode="numeric"
                              className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-right focus:border-gray-400 focus:outline-none disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                            <button
                              onClick={() => decide(it, "approved")}
                              disabled={busy !== null}
                              title="Zapisze poprawki z wiersza i opublikuje na stronie przepisu"
                              className="rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busy === it.id ? "Zapisuję…" : "Akceptuj"}
                            </button>
                            <button
                              onClick={() => decide(it, "rejected")}
                              disabled={busy !== null}
                              className="ml-2 rounded-full border border-gray-200 text-gray-600 px-3 py-1 text-xs font-medium hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                            >
                              Odrzuć
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }

  const [groups, counts] = await Promise.all([
    listDraftSubstitutionsGrouped(),
    countByStatus(),
  ]);

  return {
    props: {
      groups: JSON.parse(JSON.stringify(groups)),
      counts,
    },
  };
};
