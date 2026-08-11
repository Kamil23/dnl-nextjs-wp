import { GetServerSideProps } from "next";
import { useState } from "react";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { listBackups } from "../../lib/server/backup";
import type { BackupFile } from "../../lib/server/backup";

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}

export default function Backupy({ initial }: { initial: BackupFile[] }) {
  const [backups, setBackups] = useState(initial);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function runBackup() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd backupu");
      setBackups(data.backups ?? []);
      setMsg({ ok: true, text: `Backup gotowy: ${data.db} + ${data.media}` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || "Błąd backupu" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <AdminShell title="Backupy">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Backupy</h1>
          <p className="text-sm text-gray-500 mt-1">
            Baza danych i pliki mediów. Automatyczny backup co 3 dni; tutaj możesz
            zrobić go ręcznie i pobrać dowolny plik. Retencja: baza 14 kopii
            (ok. 6 tygodni historii), media 2 kopie (poprzednia + świeża).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
          )}
          <button
            onClick={runBackup}
            disabled={running}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            {running ? "Robię backup…" : "Zrób backup teraz"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {backups.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Brak backupów. Kliknij „Zrób backup teraz".</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Rodzaj</th>
                <th className="px-5 py-3 font-medium">Plik</th>
                <th className="px-5 py-3 font-medium">Rozmiar</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium text-right">Pobierz</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        b.kind === "db" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {b.kind === "db" ? "Baza" : "Media"}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{b.name}</td>
                  <td className="px-5 py-3 tabular-nums text-gray-600">{fmtSize(b.size)}</td>
                  <td className="px-5 py-3 text-gray-600">{fmtDate(b.mtime)}</td>
                  <td className="px-5 py-3 text-right">
                    <a
                      href={`/api/admin/backups/download?file=${encodeURIComponent(b.name)}`}
                      className="text-gray-700 hover:text-gray-900 underline"
                    >
                      pobierz ↓
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Backupy leżą na serwerze (ochrona przed pomyłką). Dla pełnego bezpieczeństwa
        pobieraj co jakiś czas przynajmniej plik bazy poza serwer.
      </p>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  return { props: { initial: listBackups() } };
};
