import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { desc, eq } from "drizzle-orm";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { db, dbSchema } from "../../lib/db";

// Propozycje zmian z jednorazowego audytu przepisów (docs/audyt-przepisow-runbook.md).
// Każda to diff przed/po z powodem i pewnością; operator stosuje je pojedynczo
// albo wszystkie „high” w przepisie. Zastosowane da się cofnąć.

type Proposal = {
  id: number;
  recipeId: number;
  path: string;
  before: unknown;
  after: unknown;
  reason: string;
  severity: "error" | "warning" | "polish";
  confidence: "high" | "medium" | "low";
  basis: string;
  source: string;
  status: "pending" | "applied" | "rejected" | "reverted" | "failed";
  note: string | null;
  createdAt: string | null;
  appliedAt: string | null;
};
type RecipeGroup = { id: number; title: string; uri: string; status: string; proposals: Proposal[] };

const SEV: Record<Proposal["severity"], string> = { error: "bg-red-100 text-red-700", warning: "bg-amber-100 text-amber-800", polish: "bg-gray-100 text-gray-600" };
const CONF: Record<Proposal["confidence"], string> = { high: "bg-green-100 text-green-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-red-100 text-red-700" };
const STATUS: Record<Proposal["status"], string> = { pending: "do decyzji", applied: "zastosowana", rejected: "odrzucona", reverted: "cofnięta", failed: "nieudana" };

const fmt = (v: unknown) => (v == null ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default function AdminProposals({ groups, sources }: { groups: RecipeGroup[]; sources: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [conf, setConf] = useState<string>("all");
  const [sev, setSev] = useState<string>("all");
  const [msg, setMsg] = useState<string>("");

  const visible = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          proposals: g.proposals.filter(
            (p) => (status === "all" || p.status === status) && (conf === "all" || p.confidence === conf) && (sev === "all" || p.severity === sev)
          ),
        }))
        .filter((g) => g.proposals.length),
    [groups, status, conf, sev]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const g of groups) for (const p of g.proposals) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [groups]);

  async function act(id: number, action: "apply" | "reject" | "revert") {
    setBusy(id);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/proposals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok && !data.status) throw new Error(data.error || "Błąd");
      if (data.note) setMsg(data.note);
      router.replace(router.asPath);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function applyAllHigh(g: RecipeGroup) {
    const targets = g.proposals.filter((p) => p.status === "pending" && p.confidence === "high");
    setBusy(`r-${g.id}`);
    setMsg("");
    let failed = 0;
    for (const p of targets) {
      const res = await fetch(`/api/admin/proposals/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply" }),
      }).catch(() => null);
      if (!res || !res.ok) failed++;
    }
    setBusy(null);
    setMsg(failed ? `${failed} z ${targets.length} propozycji nie zastosowano (szczegóły przy propozycji).` : `Zastosowano ${targets.length} propozycji.`);
    router.replace(router.asPath);
  }

  const selectCls = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white";

  return (
    <AdminShell title="Propozycje zmian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Propozycje zmian w przepisach</h1>
        <p className="text-sm text-gray-500">
          Z audytu ({sources.join(", ") || "brak"}): {counts.pending ?? 0} do decyzji, {counts.applied ?? 0} zastosowanych,{" "}
          {counts.rejected ?? 0} odrzuconych, {counts.failed ?? 0} nieudanych. Każda zmiana przechodzi kontrolę QC; zastosowane
          można cofnąć.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="pending">do decyzji</option>
          <option value="applied">zastosowane</option>
          <option value="rejected">odrzucone</option>
          <option value="failed">nieudane</option>
          <option value="reverted">cofnięte</option>
          <option value="all">wszystkie</option>
        </select>
        <select value={conf} onChange={(e) => setConf(e.target.value)} className={selectCls}>
          <option value="all">każda pewność</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        <select value={sev} onChange={(e) => setSev(e.target.value)} className={selectCls}>
          <option value="all">każda waga</option>
          <option value="error">błąd</option>
          <option value="warning">ostrzeżenie</option>
          <option value="polish">kosmetyka</option>
        </select>
        {msg && <span className="text-sm text-gray-700">{msg}</span>}
      </div>

      {visible.length === 0 ? (
        <p className="text-gray-500">Brak propozycji dla tych filtrów.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((g) => {
            const pendingHigh = g.proposals.filter((p) => p.status === "pending" && p.confidence === "high").length;
            return (
              <section key={g.id} className="bg-white rounded-xl border border-gray-200">
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-gray-100">
                  <div className="min-w-0">
                    <Link href={`/admin/przepisy/${g.id}`} className="font-medium text-gray-900 hover:underline">
                      {g.title}
                    </Link>
                    <span className="text-xs text-gray-400 ml-2">{g.status}</span>
                    <Link href={g.uri} target="_blank" className="text-xs text-gray-400 hover:text-gray-700 ml-2">
                      podgląd ↗
                    </Link>
                  </div>
                  {pendingHigh > 0 && (
                    <button
                      onClick={() => applyAllHigh(g)}
                      disabled={busy !== null}
                      className="rounded-full bg-gray-900 text-white px-3 py-1 text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
                    >
                      {busy === `r-${g.id}` ? "Stosuję…" : `Zastosuj wszystkie high (${pendingHigh})`}
                    </button>
                  )}
                </div>
                <ul className="divide-y divide-gray-100">
                  {g.proposals.map((p) => (
                    <li key={p.id} className="px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{p.path}</code>
                            <span className={`text-[11px] rounded-full px-2 py-0.5 ${SEV[p.severity]}`}>{p.severity}</span>
                            <span className={`text-[11px] rounded-full px-2 py-0.5 ${CONF[p.confidence]}`}>pewność: {p.confidence}</span>
                            <span className="text-[11px] text-gray-400">{p.basis}</span>
                            {p.status !== "pending" && <span className="text-[11px] text-gray-500">· {STATUS[p.status]}</span>}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2 text-xs">
                            <div className="bg-red-50 border border-red-100 rounded p-2 whitespace-pre-wrap">
                              <span className="text-red-400">przed: </span>
                              {fmt(p.before)}
                            </div>
                            <div className="bg-green-50 border border-green-100 rounded p-2 whitespace-pre-wrap">
                              <span className="text-green-600">po: </span>
                              {fmt(p.after)}
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{p.reason}</p>
                          {p.note && <p className="text-xs text-red-600 mt-1">{p.note}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {(p.status === "pending" || p.status === "failed") && (
                            <>
                              <button
                                onClick={() => act(p.id, "apply")}
                                disabled={busy !== null}
                                className="rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {busy === p.id ? "…" : "Zastosuj"}
                              </button>
                              {p.status === "pending" && (
                                <button
                                  onClick={() => act(p.id, "reject")}
                                  disabled={busy !== null}
                                  className="rounded-full border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Odrzuć
                                </button>
                              )}
                            </>
                          )}
                          {p.status === "applied" && (
                            <button
                              onClick={() => act(p.id, "revert")}
                              disabled={busy !== null}
                              className="rounded-full border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              Cofnij
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const { recipeProposals, recipes } = dbSchema;
  const rows = await db
    .select({
      p: recipeProposals,
      title: recipes.title,
      uri: recipes.uri,
      rstatus: recipes.status,
    })
    .from(recipeProposals)
    .innerJoin(recipes, eq(recipes.id, recipeProposals.recipeId))
    .orderBy(desc(recipeProposals.createdAt));

  const byRecipe = new Map<number, RecipeGroup>();
  const sources = new Set<string>();
  for (const r of rows) {
    sources.add(r.p.source);
    if (!byRecipe.has(r.p.recipeId)) {
      byRecipe.set(r.p.recipeId, { id: r.p.recipeId, title: r.title, uri: r.uri, status: r.rstatus, proposals: [] });
    }
    byRecipe.get(r.p.recipeId)!.proposals.push(JSON.parse(JSON.stringify(r.p)));
  }
  const order = { error: 0, warning: 1, polish: 2 } as const;
  const groups = Array.from(byRecipe.values()).map((g) => ({
    ...g,
    proposals: g.proposals.sort((a, b) => order[a.severity] - order[b.severity]),
  }));
  return { props: { groups, sources: Array.from(sources) } };
};
