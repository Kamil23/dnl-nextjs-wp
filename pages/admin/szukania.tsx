import { GetServerSideProps } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { db, dbSchema } from "../../lib/db";

// Widok logu wyszukiwań (FEATURES.md §0): top frazy = popyt,
// frazy bez wyników = luki w treści = gotowy brief na rolki.

type Row = { phrase: string; hits: number; zero: number; lastSeen: string };

const PERIODS = [
  { key: "7", label: "7 dni" },
  { key: "30", label: "30 dni" },
  { key: "all", label: "Wszystko" },
] as const;

export default function AdminSearches({ top, zero, period }: { top: Row[]; zero: Row[]; period: string }) {
  return (
    <AdminShell title="Wyszukiwania">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Wyszukiwania</h1>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/admin/szukania?okres=${p.key}`}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                period === p.key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <Section
        title="Najczęstsze frazy"
        subtitle="Popyt użytkowniczek - co realnie szukają na stronie."
        rows={top}
      />
      <Section
        title="Szukania bez wyników"
        subtitle="Luki w treści. Każda z tych fraz to pomysł na przepis albo rolkę Roksany."
        rows={zero}
        emptyLabel="Brak pustych wyników w tym okresie. 🎉"
      />
    </AdminShell>
  );
}

function Section({
  title,
  subtitle,
  rows,
  emptyLabel = "Brak danych w tym okresie.",
}: {
  title: string;
  subtitle?: string;
  rows: Row[];
  emptyLabel?: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-bold mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-gray-400 mb-3">{subtitle}</p>}
      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm">{emptyLabel}</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fraza</th>
                <th className="px-4 py-3 font-medium">Wyszukiwania</th>
                <th className="px-4 py-3 font-medium">Bez wyników</th>
                <th className="px-4 py-3 font-medium">Ostatnio</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.phrase} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.phrase}</td>
                  <td className="px-4 py-3">{r.hits}</td>
                  <td className="px-4 py-3">
                    {r.zero > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">{r.zero}</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(r.lastSeen).toLocaleString("pl-PL")}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/szukaj/?q=${encodeURIComponent(r.phrase)}`}
                      target="_blank"
                      className="text-gray-400 hover:text-gray-700"
                    >
                      zobacz wyniki ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }

  const period = typeof query.okres === "string" && PERIODS.some((p) => p.key === query.okres) ? query.okres : "30";
  const since = period === "all" ? null : new Date(Date.now() - parseInt(period, 10) * 24 * 3600 * 1000);
  const { searchLog } = dbSchema;

  // Wolumen po throttlingu jest mały - jedna agregacja, resztę liczymy w JS.
  // Odporne na brak/awarię tabeli: zamiast crashować całą stronę, pokazujemy pusto.
  let rows: Row[] = [];
  try {
    rows = await db
      .select({
        phrase: searchLog.phrase,
        hits: sql<number>`count(*)::int`,
        zero: sql<number>`count(*) filter (where ${searchLog.results} = 0)::int`,
        lastSeen: sql<string>`max(${searchLog.createdAt})`,
      })
      .from(searchLog)
      .where(since ? sql`${searchLog.createdAt} >= ${since}` : undefined)
      .groupBy(searchLog.phrase)
      .orderBy(sql`count(*) desc`)
      .limit(5000);
  } catch (e) {
    console.error("szukania: zapytanie search_log nie powiodło się:", (e as Error).message);
  }

  return {
    props: {
      period,
      top: JSON.parse(JSON.stringify(rows.slice(0, 50))),
      // "zero" pokazuje tylko frazy, których WSZYSTKIE wyszukiwania były puste
      zero: JSON.parse(
        JSON.stringify(rows.filter((r) => r.hits === r.zero).slice(0, 50))
      ),
    },
  };
};
