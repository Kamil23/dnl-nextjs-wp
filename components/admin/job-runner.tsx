import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

// Panel zlecenia dla workera: przycisk "uruchom teraz", status ostatniego biegu
// i (opcjonalnie) interwał automatycznego uruchamiania. Zlecenie wykonuje
// serwis worker (poll co 10 s), więc wynik pojawia się po kilkudziesięciu
// sekundach; komponent odpytuje status i odświeża stronę po zakończeniu.

type Job = {
  id: number;
  status: "pending" | "running" | "done" | "error";
  log: string | null;
  createdAt: string | null;
  finishedAt: string | null;
};

const INTERVALS = [
  { days: 0, label: "Wyłączone" },
  { days: 1, label: "Codziennie" },
  { days: 2, label: "Co 2 dni" },
  { days: 7, label: "Co tydzień" },
];

export default function JobRunner({
  kind,
  runLabel,
  description,
  withInterval = false,
  limitOption = false,
}: {
  kind: "tiktok_backlog" | "substitutions";
  runLabel: string;
  description: string;
  withInterval?: boolean;
  limitOption?: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  const [limit, setLimit] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wasActive = useRef(false);
  const [showLog, setShowLog] = useState(false);

  const active = job?.status === "pending" || job?.status === "running";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/jobs?kind=${kind}`);
      const data = await res.json();
      if (res.ok) {
        setJob(data.job);
        if (data.intervalDays != null) setIntervalDays(data.intervalDays);
      }
    } catch {}
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  // Podczas aktywnego zlecenia odpytuj co 5 s; po zakończeniu odśwież dane strony
  useEffect(() => {
    if (!active) {
      if (wasActive.current) {
        wasActive.current = false;
        router.replace(router.asPath);
      }
      return;
    }
    wasActive.current = true;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active, load, router]);

  async function runNow() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, action: "run", limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nie udało się dodać zlecenia");
      setJob(data.job);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveInterval(days: number) {
    setIntervalDays(days);
    await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, action: "interval", days }),
    }).catch(() => {});
  }

  const statusLine = !job
    ? "Jeszcze nie uruchamiano."
    : job.status === "pending"
      ? "W kolejce: worker podejmie zlecenie w ciągu ~10 s..."
      : job.status === "running"
        ? "Trwa wykonywanie..."
        : `${job.status === "done" ? "Ostatni bieg zakończony" : "Ostatni bieg z błędem"}${
            job.finishedAt ? `: ${new Date(job.finishedAt).toLocaleString("pl-PL")}` : ""
          }`;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm text-gray-600 mb-1">{description}</p>
          <p className={`text-xs ${job?.status === "error" ? "text-red-600" : "text-gray-400"}`}>
            {statusLine}
            {job?.log && (job.status === "done" || job.status === "error") && (
              <>
                {" "}
                <button onClick={() => setShowLog(!showLog)} className="underline hover:text-gray-600">
                  {showLog ? "ukryj log" : "pokaż log"}
                </button>
              </>
            )}
          </p>
          {showLog && job?.log && (
            <pre className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {job.log}
            </pre>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {limitOption && (
            <label className="text-sm text-gray-500 flex items-center gap-2">
              Przepisów:
              <input
                inputMode="numeric"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
          )}
          {withInterval && intervalDays != null && (
            <label className="text-sm text-gray-500 flex items-center gap-2">
              Automatycznie:
              <select
                value={intervalDays}
                onChange={(e) => saveInterval(parseInt(e.target.value, 10))}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
              >
                {INTERVALS.map((i) => (
                  <option key={i.days} value={i.days}>
                    {i.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={runNow}
            disabled={busy || active}
            className="rounded-full bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {active ? "W toku..." : runLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
