import { GetServerSideProps } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { listBacklog, backlogStats, type BacklogRow } from "../../lib/tiktok-backlog";

// Backlog TikTok: filmy z profilu, które NIE mają jeszcze przepisu ani wpisu w
// kolejce. Katalog odświeża skrypt `npm run tiktok:backlog` (yt-dlp + tania
// klasyfikacja opisów). Stąd jednym klikiem wrzucasz film do kolejki importu,
// dalej przejmuje go worker i normalny flow akceptu w /admin/tiktok.

type Filter = "przepis" | "niejasne" | "inne" | "wszystkie";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "przepis", label: "Przepisy" },
  { key: "niejasne", label: "Niejasne" },
  { key: "inne", label: "Inne" },
  { key: "wszystkie", label: "Wszystkie" },
];

function fmtViews(v: number | null) {
  if (v == null) return "";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} mln`;
  if (v >= 1_000) return `${Math.round(v / 1_000)} tys.`;
  return String(v);
}

export default function TikTokBacklog({
  rows,
  stats,
}: {
  rows: BacklogRow[];
  stats: { catalogTotal: number; backlog: number; backlogPrzepisy: number; lastRefresh: string | null };
}) {
  const [filter, setFilter] = useState<Filter>("przepis");
  const [queued, setQueued] = useState<Record<string, "sending" | "ok" | "error">>({});
  const [bulk, setBulk] = useState<{ running: boolean; done: number; total: number } | null>(null);

  const visible = useMemo(
    () => rows.filter((r) => (filter === "wszystkie" ? true : (r.kind ?? "niejasne") === filter)),
    [rows, filter]
  );

  async function enqueue(row: BacklogRow): Promise<boolean> {
    setQueued((q) => ({ ...q, [row.videoId]: "sending" }));
    try {
      const res = await fetch("/api/admin/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: row.url }),
      });
      // 409/duplikat też traktujemy jako "jest w systemie"
      const ok = res.ok || res.status === 409;
      setQueued((q) => ({ ...q, [row.videoId]: ok ? "ok" : "error" }));
      return ok;
    } catch {
      setQueued((q) => ({ ...q, [row.videoId]: "error" }));
      return false;
    }
  }

  async function enqueueAllVisible() {
    const todo = visible.filter((r) => queued[r.videoId] !== "ok");
    if (todo.length === 0) return;
    if (!confirm(`Dodać ${todo.length} filmów do kolejki importu? Worker przetworzy je po kolei.`)) return;
    setBulk({ running: true, done: 0, total: todo.length });
    let done = 0;
    for (const row of todo) {
      await enqueue(row);
      done++;
      setBulk({ running: true, done, total: todo.length });
    }
    setBulk({ running: false, done, total: todo.length });
  }

  return (
    <AdminShell title="Backlog TikTok">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Backlog TikTok</h1>
          <p className="text-sm text-gray-500">
            W katalogu {stats.catalogTotal} filmów, w backlogu {stats.backlog} (w tym{" "}
            <span className="font-medium text-gray-700">{stats.backlogPrzepisy} sklasyfikowanych jako przepisy</span>).
            {stats.lastRefresh && (
              <> Odświeżono: {new Date(stats.lastRefresh).toLocaleString("pl-PL")}.</>
            )}{" "}
            Aktualizacja katalogu: <code className="bg-gray-100 px-1 rounded">npm run tiktok:backlog</code>
          </p>
        </div>
        {visible.length > 0 && (
          <button
            onClick={enqueueAllVisible}
            disabled={bulk?.running}
            className="rounded-full bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {bulk?.running
              ? `Dodaję... ${bulk.done}/${bulk.total}`
              : `Dodaj widoczne do kolejki (${visible.filter((r) => queued[r.videoId] !== "ok").length})`}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              filter === f.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
            }`}
          >
            {f.label} ({rows.filter((r) => (f.key === "wszystkie" ? true : (r.kind ?? "niejasne") === f.key)).length})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500">
          Katalog jest pusty albo wszystko już zaimportowane. Uruchom{" "}
          <code className="bg-gray-100 px-1 rounded">npm run tiktok:backlog</code>, żeby pobrać listę filmów z profilu.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-gray-500">Brak filmów w tym filtrze.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Opis filmu</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Wyświetlenia</th>
                <th className="px-4 py-3 font-medium">Typ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => {
                const state = queued[r.videoId];
                return (
                  <tr key={r.videoId} className={state === "ok" ? "bg-emerald-50/40" : ""}>
                    <td className="px-4 py-3 align-top">
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-gray-900 hover:underline">
                        {r.caption ? (r.caption.length > 120 ? r.caption.slice(0, 120) + "…" : r.caption) : (
                          <span className="text-gray-400">(bez opisu) {r.videoId}</span>
                        )}
                      </a>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap text-gray-600">{fmtViews(r.viewCount)}</td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          r.kind === "przepis"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.kind === "inne"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.kind ?? "niejasne"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      {state === "ok" ? (
                        <span className="text-emerald-600 text-xs font-medium">✓ w kolejce</span>
                      ) : (
                        <button
                          onClick={() => enqueue(r)}
                          disabled={state === "sending" || bulk?.running}
                          className="rounded-full bg-gray-900 text-white px-3 py-1 text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
                        >
                          {state === "sending" ? "Dodaję..." : state === "error" ? "Ponów" : "Do kolejki"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Dodane filmy trafiają do kolejki na{" "}
        <Link href="/admin/tiktok" className="underline">
          Import TikTok
        </Link>
        , gdzie worker je przetwarza, a Ty akceptujesz szkice.
      </p>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const [rows, stats] = await Promise.all([listBacklog(), backlogStats()]);
  return {
    props: {
      rows: JSON.parse(JSON.stringify(rows)),
      stats: JSON.parse(JSON.stringify(stats)),
    },
  };
};
