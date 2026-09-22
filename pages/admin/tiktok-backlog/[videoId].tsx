import { GetServerSideProps } from "next";
import Link from "next/link";
import { useState } from "react";
import AdminShell from "../../../components/admin/admin-shell";
import { isAdminRequest } from "../../../lib/admin-auth";
import { getPathStats, type PathStats } from "../../../lib/server/ga";
import { getVideoDetail, type VideoDetail } from "../../../lib/tiktok-backlog";

// Szczegóły filmu z katalogu TikTok: osadzony odtwarzacz, pełne statystyki
// z pochodnymi (ER, tempo, vs mediana profilu), wykres i tabela historii
// snapshotów z przyrostami. Wejście z tabeli w /admin/tiktok-backlog.

function fmtNum(v: number | null | undefined) {
  return v == null ? "—" : v.toLocaleString("pl-PL");
}

function fmtCompact(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} mln`;
  if (v >= 10_000) return `${Math.round(v / 1_000)} tys.`;
  return v.toLocaleString("pl-PL");
}

function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function fmtDuration(sec: number | null) {
  if (sec == null) return "—";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function pct(part: number | null, whole: number | null, digits = 2) {
  if (part == null || !whole) return null;
  return `${((part / whole) * 100).toFixed(digits).replace(".", ",")}%`;
}

// Prosty wykres liniowy (SVG, bez bibliotek) - historia wyświetleń.
function ViewsChart({ history }: { history: VideoDetail["history"] }) {
  const points = history.filter((h) => h.viewCount != null);
  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-400">
        Wykres pojawi się, gdy będą co najmniej dwa snapshoty z różnych dni.
      </p>
    );
  }
  const W = 640;
  const H = 180;
  const PAD = 8;
  const min = Math.min(...points.map((p) => p.viewCount!));
  const max = Math.max(...points.map((p) => p.viewCount!));
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.viewCount!).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
        <path d={path} fill="none" stroke="#059669" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={p.capturedOn} cx={x(i)} cy={y(p.viewCount!)} r="3.5" fill="#059669">
            <title>{`${p.capturedOn}: ${p.viewCount!.toLocaleString("pl-PL")}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{fmtDate(points[0].capturedOn)} · {fmtCompact(points[0].viewCount)}</span>
        <span>{fmtDate(points[points.length - 1].capturedOn)} · {fmtCompact(points[points.length - 1].viewCount)}</span>
      </div>
    </div>
  );
}

// Dzienne odsłony strony przepisu (GA4) jako słupki - czy hit na TikToku
// przekłada się na ruch na stronie.
function GaBars({ daily }: { daily: PathStats["daily"] }) {
  if (daily.length === 0) return <p className="text-sm text-gray-400">Brak odsłon w tym okresie.</p>;
  const max = Math.max(...daily.map((d) => d.views), 1);
  return (
    <div className="flex items-end gap-[3px] h-24">
      {daily.map((d) => (
        <div
          key={d.date}
          className="flex-1 bg-emerald-500/70 rounded-t min-w-[4px]"
          style={{ height: `${Math.max(4, (d.views / max) * 100)}%` }}
          title={`${fmtDate(d.date)}: ${d.views.toLocaleString("pl-PL")} odsłon`}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-emerald-600">{sub}</div>}
    </div>
  );
}

export default function TikTokVideoDetail({
  detail,
  gaStats,
}: {
  detail: VideoDetail;
  gaStats: PathStats | null;
}) {
  const { video, history, medianViews, importRow, recipe } = detail;
  const [queued, setQueued] = useState<"idle" | "sending" | "ok" | "error">("idle");

  const first = history.find((h) => h.viewCount != null) ?? null;
  const growthTotal = first && video.viewCount != null ? video.viewCount - first.viewCount! : null;
  const uploadedAt = video.uploadedTs != null ? new Date(video.uploadedTs * 1000) : null;
  const ageDays = uploadedAt
    ? Math.max(1, Math.round((Date.now() - uploadedAt.getTime()) / 86_400_000))
    : null;
  const engagement =
    (video.likeCount ?? 0) + (video.commentCount ?? 0) + (video.saveCount ?? 0) + (video.repostCount ?? 0);
  const hashtags = video.caption?.match(/#[\p{L}\p{N}_]+/gu) ?? [];

  async function enqueue() {
    setQueued("sending");
    try {
      const res = await fetch("/api/admin/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: video.url }),
      });
      setQueued(res.ok || res.status === 409 ? "ok" : "error");
    } catch {
      setQueued("error");
    }
  }

  return (
    <AdminShell title="Film TikTok">
      <div className="mb-5">
        <Link href="/admin/tiktok-backlog" className="text-sm text-gray-500 hover:underline">
          ← Backlog TikTok
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-snug break-words max-w-3xl">
            {video.caption || `(bez opisu) ${video.videoId}`}
          </h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                video.kind === "przepis"
                  ? "bg-emerald-100 text-emerald-700"
                  : video.kind === "inne"
                    ? "bg-gray-100 text-gray-500"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {video.kind ?? "niejasne"}
            </span>
            {recipe ? (
              <Link href={`/admin/przepisy/${recipe.id}`} className="text-emerald-700 underline text-xs">
                ✓ ma przepis: {recipe.title ?? recipe.slug}
              </Link>
            ) : importRow ? (
              <Link href="/admin/tiktok" className="text-blue-700 underline text-xs">
                w kolejce importu ({importRow.status})
              </Link>
            ) : (
              <span className="text-xs text-gray-400">w backlogu (bez przepisu)</span>
            )}
            <a href={video.url} target="_blank" rel="noreferrer" className="text-xs text-gray-500 underline">
              otwórz na TikToku ↗
            </a>
          </div>
        </div>
        {!recipe && !importRow && (
          <button
            onClick={enqueue}
            disabled={queued === "sending" || queued === "ok"}
            className="rounded-full bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {queued === "ok"
              ? "✓ w kolejce"
              : queued === "sending"
                ? "Dodaję..."
                : queued === "error"
                  ? "Ponów"
                  : "Do kolejki importu"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <div>
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
            <iframe
              src={`https://www.tiktok.com/embed/v2/${video.videoId}`}
              className="w-full"
              style={{ height: 580 }}
              allow="encrypted-media; fullscreen"
              title="Podgląd filmu TikTok"
            />
          </div>
          <dl className="mt-4 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
            {[
              ["Opublikowany", uploadedAt ? fmtDate(uploadedAt.toISOString(), true) : "—"],
              ["Wiek filmu", ageDays != null ? `${ageDays} dni` : "—"],
              ["Długość", fmtDuration(video.durationSec)],
              ["Sklasyfikowany", fmtDate(video.classifiedAt, true)],
              ["Ostatnie odświeżenie", fmtDate(video.refreshedAt, true)],
              ["ID filmu", video.videoId],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-gray-900 text-right break-all">{v}</dd>
              </div>
            ))}
          </dl>
          {hashtags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hashtags.map((h) => (
                <span key={h} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <StatCard
              label="Wyświetlenia"
              value={fmtNum(video.viewCount)}
              sub={growthTotal ? `+${fmtNum(growthTotal)} od ${fmtDate(first!.capturedOn)}` : null}
            />
            <StatCard label="Polubienia" value={fmtNum(video.likeCount)} sub={pct(video.likeCount, video.viewCount) && `${pct(video.likeCount, video.viewCount)} wyświetleń`} />
            <StatCard label="Komentarze" value={fmtNum(video.commentCount)} />
            <StatCard label="Zapisy" value={fmtNum(video.saveCount)} sub={pct(video.saveCount, video.viewCount) && `${pct(video.saveCount, video.viewCount)} wyświetleń`} />
            <StatCard label="Udostępnienia" value={fmtNum(video.repostCount)} />
            <StatCard
              label="ER (zaangażowanie)"
              value={video.viewCount && engagement ? pct(engagement, video.viewCount, 1)! : "—"}
              sub="(polubienia+komentarze+zapisy+udost.) / wyświetlenia"
            />
            <StatCard
              label="Tempo"
              value={video.viewCount && ageDays ? `${fmtCompact(Math.round(video.viewCount / ageDays))}/dzień` : "—"}
              sub="średnio od publikacji"
            />
            <StatCard
              label="Vs mediana profilu"
              value={
                video.viewCount && medianViews
                  ? `×${(video.viewCount / medianViews).toFixed(1).replace(".", ",")}`
                  : "—"
              }
              sub={medianViews ? `mediana: ${fmtCompact(Math.round(medianViews))}` : null}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Historia wyświetleń</h2>
            <ViewsChart history={history} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-700 px-4 pt-4">Snapshoty (przyrost vs poprzedni)</h2>
            <table className="w-full text-sm mt-2">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  {["Data", "Wyświetlenia", "Polubienia", "Komentarze", "Zapisy", "Udostępnienia"].map((h) => (
                    <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...history].reverse().map((s, idx, arr) => {
                  const prev = arr[idx + 1] ?? null;
                  const cell = (cur: number | null, pr: number | null | undefined) => {
                    const d = cur != null && pr != null ? cur - pr : null;
                    return (
                      <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                        {fmtNum(cur)}
                        {d != null && d !== 0 && (
                          <span className={`ml-1.5 text-xs ${d > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                            {d > 0 ? "+" : "−"}{fmtNum(Math.abs(d))}
                          </span>
                        )}
                      </td>
                    );
                  };
                  return (
                    <tr key={s.capturedOn}>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-500">{fmtDate(s.capturedOn)}</td>
                      {cell(s.viewCount, prev?.viewCount)}
                      {cell(s.likeCount, prev?.likeCount)}
                      {cell(s.commentCount, prev?.commentCount)}
                      {cell(s.saveCount, prev?.saveCount)}
                      {cell(s.repostCount, prev?.repostCount)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {recipe && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Ruch na stronie przepisu (28 dni)
                </h2>
                {gaStats && (
                  <span className="text-sm text-gray-500">
                    łącznie <span className="font-semibold text-gray-900">{fmtNum(gaStats.total)}</span> odsłon
                    {gaStats.daily.length >= 7 && (
                      <>
                        , ostatnie 7 dni:{" "}
                        <span className="font-semibold text-gray-900">
                          {fmtNum(gaStats.daily.slice(-7).reduce((s, d) => s + d.views, 0))}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
              {gaStats ? (
                <GaBars daily={gaStats.daily} />
              ) : (
                <p className="text-sm text-gray-400">
                  GA4 nieskonfigurowane albo chwilowo niedostępne.
                </p>
              )}
            </div>
          )}

          {importRow?.transcript && (
            <details className="bg-white rounded-xl border border-gray-200 mt-6 group">
              <summary className="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer select-none">
                Transkrypcja filmu (Whisper, z importu)
              </summary>
              <p className="px-4 pb-4 text-sm text-gray-600 whitespace-pre-wrap">{importRow.transcript}</p>
            </details>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, params }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const videoId = String(params?.videoId ?? "");
  if (!/^\d+$/.test(videoId)) return { notFound: true };
  const detail = await getVideoDetail(videoId);
  if (!detail) return { notFound: true };
  const gaStats = detail.recipe?.slug ? await getPathStats(`/przepisy/${detail.recipe.slug}/`) : null;
  return { props: { detail: JSON.parse(JSON.stringify(detail)), gaStats } };
};
