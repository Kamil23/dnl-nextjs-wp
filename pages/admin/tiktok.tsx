import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { desc } from "drizzle-orm";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { db, dbSchema } from "../../lib/db";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "W kolejce", cls: "bg-gray-200 text-gray-700" },
  processing: { label: "Przetwarzanie...", cls: "bg-blue-100 text-blue-800" },
  ready: { label: "Do akceptacji", cls: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Zaakceptowany", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Odrzucony", cls: "bg-red-100 text-red-700" },
  failed: { label: "Błąd", cls: "bg-red-100 text-red-700" },
};

function DraftPreview({ draft, heroFrame, onPickFrame }: { draft: any; heroFrame: string | null; onPickFrame: (url: string) => void }) {
  if (!draft) return null;
  return (
    <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm space-y-2">
      {draft.frames?.length > 0 && (
        <div>
          <div className="font-medium text-gray-500 text-xs uppercase mb-2">
            Zdjęcie główne — kliknij klatkę, aby wybrać
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {draft.frames.map((f: string) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f}
                src={f}
                alt=""
                onClick={() => onPickFrame(f)}
                className={`h-32 rounded-lg cursor-pointer border-4 transition ${
                  (heroFrame ?? draft.frames[0]) === f ? "border-amber-500" : "border-transparent hover:border-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <strong>{draft.title}</strong>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          draft.confidence === "high" ? "bg-green-100 text-green-800"
          : draft.confidence === "medium" ? "bg-yellow-100 text-yellow-800"
          : "bg-red-100 text-red-700"
        }`}>
          pewność: {draft.confidence}
        </span>
      </div>
      <p className="text-gray-600">{draft.lead}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="font-medium text-gray-500 text-xs uppercase mb-1">Składniki</div>
          <ul className="list-disc ml-4 text-gray-700">
            {(draft.ingredientGroups ?? []).flatMap((g: any) => g.items ?? []).map((i: string, n: number) => (
              <li key={n}>{i}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-medium text-gray-500 text-xs uppercase mb-1">Kroki</div>
          <ol className="list-decimal ml-4 text-gray-700">
            {(draft.steps ?? []).map((s: any, n: number) => (
              <li key={n}>{s.body}</li>
            ))}
          </ol>
        </div>
      </div>
      <div className="text-xs text-gray-500">
        ⏱ {draft.totalTimeMin ?? "?"} min · 🍽 {draft.servings ?? "?"} porcji · 🔥 {draft.kcal ?? "?"} kcal
      </div>
      {draft.notes && (
        <p className="text-xs bg-amber-50 border border-amber-100 text-amber-900 rounded p-2">
          ⚠️ {draft.notes}
        </p>
      )}
    </div>
  );
}

export default function AdminTikTok({ imports: initial }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [heroFrames, setHeroFrames] = useState<Record<number, string>>({});

  // Auto-refresh while anything is queued or processing, so the progress
  // bar written by the worker shows up live
  const hasActive = rows.some((r) => r.status === "pending" || r.status === "processing");
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(async () => {
      const res = await fetch("/api/admin/imports/");
      if (res.ok) setRows(await res.json());
    }, 2500);
    return () => clearInterval(t);
  }, [hasActive]);

  async function addImport(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/imports/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setBusy(false);
    if (res.ok) {
      setUrl("");
      router.replace(router.asPath);
      const { id } = await res.json();
      setRows((r) => [{ id, tiktokUrl: url, status: "pending", createdAt: new Date().toISOString() }, ...r]);
    } else {
      setError((await res.json()).error || "Błąd");
    }
  }

  async function act(id: number, action: string) {
    const res = await fetch(`/api/admin/imports/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, heroImage: heroFrames[id] ?? null }),
    });
    if (res.ok) {
      const data = await res.json();
      if (action === "accept" && data.recipeId) {
        router.push(`/admin/przepisy/${data.recipeId}`);
        return;
      }
      setRows((rs) =>
        rs.map((r) =>
          r.id === id
            ? { ...r, status: action === "reject" ? "rejected" : action === "retry" ? "pending" : r.status }
            : r
        )
      );
    }
  }

  return (
    <AdminShell title="Import TikTok">
      <h1 className="text-2xl font-bold mb-2">Import z TikToka</h1>
      <p className="text-sm text-gray-500 mb-6">
        Wklej link do rolki — worker pobierze wideo, odsłucha i obejrzy materiał,
        i przygotuje szkic przepisu do Twojej akceptacji.
      </p>

      <form onSubmit={addImport} className="flex gap-2 mb-8">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.tiktok.com/@dietanaluzie/video/..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-xl focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="bg-gray-900 text-white rounded-lg px-5 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
        >
          Dodaj do kolejki
        </button>
      </form>
      {error && <p className="text-sm text-red-600 -mt-6 mb-6">{error}</p>}

      <div className="space-y-3">
        {rows.length === 0 && <p className="text-gray-400 text-sm">Brak importów. Wklej pierwszy link! 🎬</p>}
        {rows.map((imp) => (
          <div key={imp.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <a href={imp.tiktokUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-900 hover:underline truncate block max-w-md">
                  {imp.tiktokUrl}
                </a>
                <div className="text-xs text-gray-400">
                  {imp.createdAt ? new Date(imp.createdAt).toLocaleString("pl-PL") : ""}
                  {imp.status === "failed" && imp.operatorNotes && (
                    <span className="text-red-500 ml-2">{imp.operatorNotes}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_LABELS[imp.status]?.cls}`}>
                  {STATUS_LABELS[imp.status]?.label ?? imp.status}
                </span>
                {imp.status === "ready" && (
                  <>
                    <button onClick={() => setExpanded(expanded === imp.id ? null : imp.id)} className="text-sm text-gray-600 hover:text-gray-900">
                      {expanded === imp.id ? "Zwiń" : "Podgląd"}
                    </button>
                    <button onClick={() => act(imp.id, "accept")} className="text-sm text-green-600 hover:text-green-800 font-medium">
                      ✓ Akceptuj → edytor
                    </button>
                    <button onClick={() => act(imp.id, "reject")} className="text-sm text-red-500 hover:text-red-700">
                      ✕ Odrzuć
                    </button>
                  </>
                )}
                {imp.status === "failed" && (
                  <button onClick={() => act(imp.id, "retry")} className="text-sm text-gray-600 hover:text-gray-900">
                    ↻ Ponów
                  </button>
                )}
                {imp.status === "approved" && imp.recipeId && (
                  <Link href={`/admin/przepisy/${imp.recipeId}`} className="text-sm text-gray-600 hover:text-gray-900">
                    Otwórz przepis →
                  </Link>
                )}
              </div>
            </div>
            {imp.status === "processing" && imp.progress && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{imp.progress.label}</span>
                  <span>krok {imp.progress.step}/{imp.progress.total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${(imp.progress.step / imp.progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {imp.status === "pending" && (
              <div className="mt-2 text-xs text-gray-400">
                Czeka na workera (<code>npm run imports:process</code>)
              </div>
            )}
            {expanded === imp.id && (
              <DraftPreview
                draft={imp.aiDraft}
                heroFrame={heroFrames[imp.id] ?? null}
                onPickFrame={(url) => setHeroFrames((h) => ({ ...h, [imp.id]: url }))}
              />
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-8">
        Worker: <code>npm run imports:process</code> (na serwerze odpala go cron co kilka minut).
        Silnik AI: <code>OPENAI_API_KEY</code> (gpt-4o + Whisper) — alternatywnie Gemini, Claude
        lub dowolne API zgodne z OpenAI (szczegóły w .env.example).
      </p>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const rows = await db
    .select()
    .from(dbSchema.imports)
    .orderBy(desc(dbSchema.imports.createdAt))
    .limit(200);
  return { props: { imports: JSON.parse(JSON.stringify(rows)) } };
};
