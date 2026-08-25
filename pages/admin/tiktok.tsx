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
  duplicate: { label: "Duplikat", cls: "bg-purple-100 text-purple-700" },
};

function SourceMaterials({ caption, transcript }: { caption?: string | null; transcript?: string | null }) {
  if (!caption && !transcript) return null;
  return (
    <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
      <div className="font-medium text-gray-500 text-xs uppercase">
        Materiały źródłowe (z nich powstał draft)
      </div>
      {caption && (
        <details>
          <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
            📝 Opis spod filmu ({caption.length} znaków)
          </summary>
          <p className="mt-1 whitespace-pre-wrap text-gray-600 bg-white rounded p-3 border border-gray-100">{caption}</p>
        </details>
      )}
      {transcript && (
        <details>
          <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
            🎙 Transkrypcja audio ({transcript.length} znaków)
          </summary>
          <p className="mt-1 whitespace-pre-wrap text-gray-600 bg-white rounded p-3 border border-gray-100">{transcript}</p>
        </details>
      )}
    </div>
  );
}

function DraftPreview({ draft, heroFrame, onPickFrame }: { draft: any; heroFrame: string | null; onPickFrame: (url: string) => void }) {
  if (!draft) return null;
  return (
    <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm space-y-2">
      {draft.frames?.length > 0 && (
        <div>
          <div className="font-medium text-gray-500 text-xs uppercase mb-2">
            Zdjęcie główne - kliknij klatkę, aby wybrać
            {draft.heroEnhanced && <span className="normal-case font-normal"> (✨ = klatka poprawiona przez AI)</span>}
            {draft.heroFrame && <span className="normal-case font-normal"> (★ = propozycja AI)</span>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[...(draft.heroEnhanced ? [draft.heroEnhanced] : []), ...draft.frames].map((f: string) => (
              <div key={f} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f}
                  alt=""
                  onClick={() => onPickFrame(f)}
                  className={`h-32 rounded-lg cursor-pointer border-4 transition ${
                    (heroFrame ?? draft.heroEnhanced ?? draft.heroFrame ?? draft.frames[0]) === f
                      ? "border-amber-500"
                      : "border-transparent hover:border-gray-300"
                  }`}
                />
                {draft.heroEnhanced === f && (
                  <span className="absolute top-1 left-1 text-[10px] font-semibold bg-black/60 text-white rounded px-1.5 py-0.5">
                    ✨ AI
                  </span>
                )}
                {draft.heroFrame === f && (
                  <span className="absolute top-1 right-1 text-amber-500 drop-shadow">★</span>
                )}
              </div>
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
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(draft.categorySlugs ?? []).map((s: string) => (
          <span key={s} className="bg-gray-900 text-white rounded-full px-2.5 py-0.5">{s}</span>
        ))}
        {(draft.categorySlugs ?? []).length === 0 && (
          <span className="bg-red-100 text-red-700 rounded-full px-2.5 py-0.5">brak kategorii!</span>
        )}
        {draft.difficulty && (
          <span className="bg-gray-200 text-gray-700 rounded-full px-2.5 py-0.5">
            trudność: {draft.difficulty}
          </span>
        )}
      </div>
      {draft.about && (
        <div>
          <div className="font-medium text-gray-500 text-xs uppercase mb-1">
            Kilka słów o tym przepisie
          </div>
          <p className="text-gray-600 whitespace-pre-line">{draft.about}</p>
        </div>
      )}
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
          <ol className="list-decimal ml-4 text-gray-700 space-y-2">
            {(draft.steps ?? []).map((s: any, n: number) => (
              <li key={n}>
                <div className="flex items-start gap-2">
                  <span className="flex-1">{s.body}</span>
                  {s.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image} alt="" className="h-14 rounded shrink-0" />
                  )}
                </div>
              </li>
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
  // Set when the submitted link turns out to be a duplicate - the message
  // comes with a link to the existing recipe/import
  const [dupOf, setDupOf] = useState<{ recipeId: number | null } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [heroFrames, setHeroFrames] = useState<Record<number, string>>({});
  const [actErrors, setActErrors] = useState<Record<number, string>>({});
  const [workerRunning, setWorkerRunning] = useState(false);
  const [workerError, setWorkerError] = useState("");

  // Auto-refresh while anything is queued or processing, so the progress
  // bar written by the worker shows up live
  const hasActive = rows.some((r) => r.status === "pending" || r.status === "processing");
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(async () => {
      const res = await fetch("/api/admin/imports/");
      if (res.ok) setRows(await res.json());
      const w = await fetch("/api/admin/imports/process/");
      if (w.ok) setWorkerRunning((await w.json()).running);
    }, 2500);
    return () => clearInterval(t);
  }, [hasActive]);

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  async function runWorker() {
    setWorkerError("");
    setWorkerRunning(true);
    const res = await fetch("/api/admin/imports/process/", { method: "POST" });
    if (!res.ok) {
      setWorkerRunning(res.status === 409);
      if (res.status !== 409) {
        setWorkerError((await res.json()).error || "Nie udało się uruchomić workera");
      }
    }
  }

  async function addImport(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDupOf(null);
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
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Błąd");
      if (res.status === 409 && body.duplicate) {
        setDupOf({ recipeId: body.duplicate.recipeId ?? null });
      }
    }
  }

  async function del(id: number) {
    const res = await fetch(`/api/admin/imports/${id}/`, { method: "DELETE" });
    if (res.ok) setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function act(id: number, action: string) {
    setActErrors((e) => ({ ...e, [id]: "" }));
    const res = await fetch(`/api/admin/imports/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, heroImage: heroFrames[id] ?? null }),
    });
    if (!res.ok) {
      const msg = await res
        .json()
        .then((j) => j.error)
        .catch(() => null);
      setActErrors((e) => ({ ...e, [id]: msg || `Błąd serwera (${res.status})` }));
      return;
    }
    const data = await res.json();
    if (action === "accept" && data.recipeId) {
      router.push(`/admin/przepisy/${data.recipeId}`);
      return;
    }
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              status:
                action === "reject"
                  ? "rejected"
                  : action === "retry" || action === "force"
                    ? "pending"
                    : r.status,
            }
          : r
      )
    );
  }

  return (
    <AdminShell title="Import TikTok">
      <h1 className="text-2xl font-bold mb-2">Import z TikToka</h1>
      <p className="text-sm text-gray-500 mb-6">
        Wklej link do rolki - worker pobierze wideo, odsłucha i obejrzy materiał,
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
      {error && (
        <p className="text-sm text-red-600 -mt-6 mb-6">
          {error}
          {dupOf?.recipeId && (
            <Link href={`/admin/przepisy/${dupOf.recipeId}`} className="ml-2 underline hover:no-underline">
              Otwórz istniejący przepis →
            </Link>
          )}
        </p>
      )}

      {(pendingCount > 0 || workerRunning) && (
        <div className="flex items-center gap-3 mb-8 -mt-2">
          <button
            onClick={runWorker}
            disabled={workerRunning || pendingCount === 0}
            className="bg-amber-500 text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            {workerRunning
              ? "⏳ Worker pracuje..."
              : `▶ Przetwórz kolejkę (${pendingCount})`}
          </button>
          {workerRunning && (
            <span className="text-xs text-gray-500">
              Postęp każdego importu widać poniżej na żywo.
            </span>
          )}
          {workerError && <span className="text-sm text-red-600">{workerError}</span>}
        </div>
      )}

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
                  {imp.status === "duplicate" && imp.operatorNotes && (
                    <span className="text-purple-600 ml-2">{imp.operatorNotes}</span>
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
                {imp.status === "duplicate" && (
                  <>
                    <button onClick={() => act(imp.id, "force")} className="text-sm text-gray-600 hover:text-gray-900">
                      ↻ Importuj mimo to
                    </button>
                    <button onClick={() => del(imp.id)} className="text-sm text-red-500 hover:text-red-700">
                      🗑 Usuń
                    </button>
                  </>
                )}
                {(imp.status === "approved" || imp.status === "duplicate") && imp.recipeId && (
                  <Link href={`/admin/przepisy/${imp.recipeId}`} className="text-sm text-gray-600 hover:text-gray-900">
                    Otwórz przepis →
                  </Link>
                )}
              </div>
            </div>
            {actErrors[imp.id] && (
              <p className="mt-2 text-sm text-red-600">{actErrors[imp.id]}</p>
            )}
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
                Czeka na workera. Na serwerze ruszy sam w ciągu ~10 s; lokalnie
                kliknij „Przetwórz kolejkę" powyżej.
              </div>
            )}
            {expanded === imp.id && (
              <>
                <DraftPreview
                  draft={imp.aiDraft}
                  heroFrame={heroFrames[imp.id] ?? null}
                  onPickFrame={(url) => setHeroFrames((h) => ({ ...h, [imp.id]: url }))}
                />
                <SourceMaterials caption={imp.caption} transcript={imp.transcript} />
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-8">
        Worker: na serwerze kolejkę przetwarza automatycznie serwis <code>worker</code> (docker
        compose); lokalnie przycisk „Przetwórz kolejkę" albo <code>npm run imports:process</code>.
        Silnik AI: <code>OPENAI_API_KEY</code> (gpt-4o + Whisper) - alternatywnie Gemini, Claude
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
