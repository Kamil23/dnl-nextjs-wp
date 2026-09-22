import { GetServerSideProps } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { listCatalogForStats, type CatalogStatsRow } from "../../lib/tiktok-backlog";

// Zbiorcze statystyki profilu TikTok: kiedy publikować (dzień tygodnia,
// godzina - liczone w strefie Europe/Warsaw z timestampu zakodowanego w ID)
// i które hashtagi współwystępują z zasięgami. Mediana zamiast średniej -
// pojedynczy viral nie zawyża wyniku.

const DAYS = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const DAYPARTS = [
  { label: "rano (6-11)", from: 6, to: 11 },
  { label: "dzień (11-16)", from: 11, to: 16 },
  { label: "wieczór (16-21)", from: 16, to: 21 },
  { label: "noc (21-6)", from: 21, to: 6 },
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function fmtCompact(v: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} mln`;
  if (v >= 10_000) return `${Math.round(v / 1_000)} tys.`;
  return v.toLocaleString("pl-PL");
}

// Dzień tygodnia (0=pon) i godzina publikacji w strefie polskiej.
function warsawSlot(ts: number): { day: number; hour: number } {
  const d = new Date(ts * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")!.value;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd);
  return { day, hour };
}

function daypartIndex(hour: number): number {
  const i = DAYPARTS.findIndex((p) => (p.from < p.to ? hour >= p.from && hour < p.to : hour >= p.from || hour < p.to));
  return i === -1 ? 3 : i;
}

type Bucket = { n: number; median: number | null };

function bucketize(rows: CatalogStatsRow[], key: (slot: { day: number; hour: number }) => number, size: number): Bucket[] {
  const groups: number[][] = Array.from({ length: size }, () => []);
  for (const r of rows) {
    if (r.uploadedTs == null || r.viewCount == null) continue;
    groups[key(warsawSlot(r.uploadedTs))].push(r.viewCount);
  }
  return groups.map((g) => ({ n: g.length, median: median(g) }));
}

function HBar({ value, max, label, n }: { value: number | null; max: number; label: string; n: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className="h-full bg-emerald-500/80 rounded-full"
          style={{ width: value && max ? `${Math.max(2, (value / max) * 100)}%` : "0%" }}
        />
      </div>
      <span className="w-20 text-right font-medium text-gray-800">{fmtCompact(value)}</span>
      <span className="w-14 text-right text-xs text-gray-400">n={n}</span>
    </div>
  );
}

export default function TikTokStats({ rows }: { rows: CatalogStatsRow[] }) {
  const [onlyRecipes, setOnlyRecipes] = useState(true);

  const data = useMemo(
    () => (onlyRecipes ? rows.filter((r) => r.kind === "przepis") : rows),
    [rows, onlyRecipes]
  );

  const byDay = useMemo(() => bucketize(data, (s) => s.day, 7), [data]);
  const byHour = useMemo(() => bucketize(data, (s) => s.hour, 24), [data]);
  const heat = useMemo(
    () => bucketize(data, (s) => s.day * DAYPARTS.length + daypartIndex(s.hour), 7 * DAYPARTS.length),
    [data]
  );

  const hashtags = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of data) {
      if (r.viewCount == null) continue;
      const tags = new Set((r.caption?.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.toLowerCase()));
      for (const t of tags) {
        if (!map.has(t)) map.set(t, []);
        map.get(t)!.push(r.viewCount);
      }
    }
    return [...map.entries()]
      .filter(([, v]) => v.length >= 3)
      .map(([tag, v]) => ({ tag, n: v.length, median: median(v)!, max: Math.max(...v) }))
      .sort((a, b) => b.median - a.median)
      .slice(0, 15);
  }, [data]);

  const maxDay = Math.max(...byDay.map((b) => b.median ?? 0), 1);
  const maxHour = Math.max(...byHour.map((b) => b.median ?? 0), 1);
  const maxHeat = Math.max(...heat.map((b) => b.median ?? 0), 1);

  return (
    <AdminShell title="Statystyki profilu TikTok">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/admin/tiktok-backlog" className="text-sm text-gray-500 hover:underline">
            ← Backlog TikTok
          </Link>
          <h1 className="text-2xl font-bold mt-1 mb-1">Statystyki profilu</h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            {data.length} filmów z danymi. Mediana wyświetleń wg momentu publikacji (czas polski,
            odczytany z ID filmu). Uwaga: to korelacja, nie gwarancja - starsze filmy miały więcej
            czasu na zbieranie wyświetleń, a małe n = mało wiarygodny słupek.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
          <input type="checkbox" checked={onlyRecipes} onChange={(e) => setOnlyRecipes(e.target.checked)} />
          Tylko przepisy
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Dzień tygodnia publikacji → mediana wyświetleń</h2>
          <div className="space-y-2">
            {byDay.map((b, i) => (
              <HBar key={DAYS[i]} label={DAYS[i]} value={b.median} max={maxDay} n={b.n} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Godzina publikacji → mediana wyświetleń</h2>
          <div className="flex items-end gap-[3px] h-40">
            {byHour.map((b, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-emerald-500/80 rounded-t"
                  style={{ height: `${b.median ? Math.max(3, (b.median / maxHour) * 130) : 0}px` }}
                  title={`${h}:00-${h + 1}:00 · mediana ${fmtCompact(b.median)} · n=${b.n}`}
                />
                <span className="text-[10px] text-gray-400">{h % 3 === 0 ? h : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Mapa: dzień × pora dnia (mediana wyświetleń)</h2>
        <table className="text-sm min-w-[560px]">
          <thead>
            <tr>
              <th className="pr-3 py-1 text-left font-medium text-gray-500"></th>
              {DAYPARTS.map((p) => (
                <th key={p.label} className="px-2 py-1 text-left font-medium text-gray-500 whitespace-nowrap">{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={day}>
                <td className="pr-3 py-1 text-gray-500">{day}</td>
                {DAYPARTS.map((p, pi) => {
                  const b = heat[di * DAYPARTS.length + pi];
                  return (
                    <td key={p.label} className="px-1 py-1">
                      <div
                        className="rounded-lg px-2 py-1.5 text-center whitespace-nowrap"
                        style={{ backgroundColor: `rgba(16,185,129,${b.median ? 0.08 + 0.55 * (b.median / maxHeat) : 0.04})` }}
                        title={`n=${b.n}`}
                      >
                        <span className="font-medium text-gray-800">{fmtCompact(b.median)}</span>{" "}
                        <span className="text-[10px] text-gray-500">n={b.n}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 px-4 pt-4">
          Hashtagi vs zasięg (min. 3 filmy, top 15 po medianie)
        </h2>
        <table className="w-full text-sm mt-2">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Hashtag</th>
              <th className="px-4 py-2 font-medium whitespace-nowrap">Mediana wyświetleń</th>
              <th className="px-4 py-2 font-medium whitespace-nowrap">Najlepszy film</th>
              <th className="px-4 py-2 font-medium whitespace-nowrap">Filmów</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hashtags.map((h) => (
              <tr key={h.tag}>
                <td className="px-4 py-2 text-gray-800">{h.tag}</td>
                <td className="px-4 py-2 text-gray-700">{fmtCompact(h.median)}</td>
                <td className="px-4 py-2 text-gray-500">{fmtCompact(h.max)}</td>
                <td className="px-4 py-2 text-gray-500">{h.n}</td>
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
  const rows = await listCatalogForStats();
  return { props: { rows: JSON.parse(JSON.stringify(rows)) } };
};
