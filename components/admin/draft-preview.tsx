import { useEffect, useMemo, useState } from "react";
import { frameInfos, type AiFilled, type ImportDraft } from "../../lib/import-draft";
import { itemMacro, type NutritionItem } from "../../lib/nutrition-calc";
import type { QcIssue } from "../../lib/recipe-qc";
import InstructBox from "./instruct-box";
import type { RecipeChange, RecipeText } from "../../lib/recipe-ops";

// Podgląd draftu z importu TikTok (/admin/tiktok). Operator widzi tu wszystko,
// co trzeba sprawdzić przed akceptacją: uwagi audytu, pola dopełnione przez
// AI, klatki per krok (z możliwością zmiany), parametry i tabelę odżywczą
// z gramaturą każdego składnika. Poprawki idą jako {action:"patch"} do
// /api/admin/imports/[id]; przeliczenia z AI jako refine / recalc-nutrition.

type Props = {
  importId: number;
  draft: ImportDraft;
  heroFrame: string | null;
  onPickFrame: (url: string) => void;
  onEnhance: (frame: string) => void;
  enhancing: boolean;
  onReassign: () => void;
  reassigning: boolean;
  onZoom: (url: string) => void;
  onDraftChange: (draft: ImportDraft) => void;
  models: { refine: string; nutrition: string; available: string[] } | null;
};

const label = "font-medium text-gray-500 text-xs uppercase mb-1";
const chipAi = "inline-block ml-1 align-middle text-[10px] font-semibold bg-amber-200 text-amber-900 rounded px-1 py-0.5 cursor-help";
const inputSm = "border border-gray-300 rounded px-2 py-1 text-sm w-20 bg-white";

function Dot({ severity }: { severity: QcIssue["severity"] }) {
  return (
    <span
      className={`mt-1 inline-block h-2 w-2 rounded-full shrink-0 ${severity === "error" ? "bg-red-500" : "bg-amber-400"}`}
      title={severity === "error" ? "Błąd (blokuje akceptację)" : "Ostrzeżenie"}
    />
  );
}

function fmtT(t: number | null | undefined) {
  if (t == null) return "";
  const s = Math.round(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function DraftPreview(p: Props) {
  const { draft, importId } = p;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const [modelPick, setModelPick] = useState<{ refine: string; nutrition: string } | null>(null);
  useEffect(() => {
    if (p.models && !modelPick) setModelPick({ refine: p.models.refine, nutrition: p.models.nutrition });
  }, [p.models, modelPick]);

  const frames = useMemo(() => frameInfos(draft), [draft]);
  const frameT = useMemo(() => new Map(frames.map((f) => [f.url, f.t])), [frames]);
  const filledByField = useMemo(() => {
    const m = new Map<string, AiFilled>();
    for (const f of draft.aiFilled ?? []) m.set(f.field, f);
    return m;
  }, [draft.aiFilled]);
  const issues = draft.review?.issues ?? [];
  const nutrition = draft.nutrition ?? null;

  async function call(action: string, body: Record<string, unknown> = {}, key = action) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(`/api/admin/imports/${importId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Błąd serwera (${res.status})`);
      if (data.draft) p.onDraftChange(data.draft);
      return data;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(null);
    }
  }
  const patch = (patchBody: Record<string, unknown>, key = "patch") => call("patch", { patch: patchBody }, key);

  const AiChip = ({ field }: { field: string }) => {
    const f = filledByField.get(field);
    if (!f) return null;
    return (
      <span className={chipAi} title={`${f.basis === "inferred" ? "Wywnioskowane przez AI" : `Źródło: ${f.basis}`}: ${f.reason}`}>
        🤖 AI
      </span>
    );
  };

  const stripUrls = [...(draft.heroEnhanced ? [draft.heroEnhanced] : []), ...frames.map((f) => f.url)];
  const heroCands = new Set(draft.heroCandidates ?? (draft.heroFrame ? [draft.heroFrame] : []));

  return (
    <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm space-y-4">
      {/* --- Uwagi audytu --- */}
      {issues.length > 0 && (
        <div className={`rounded-lg border p-3 ${draft.review?.blocking ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-medium text-gray-900">
              {draft.review?.blocking ? "⛔ Błędy blokują akceptację" : "⚠️ Do sprawdzenia przed akceptacją"}
            </span>
            <span className="text-xs text-gray-500">
              pewność modelu:{" "}
              <span className={`px-1.5 py-0.5 rounded-full ${
                draft.confidence === "high" ? "bg-green-100 text-green-800" : draft.confidence === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700"
              }`}>
                {draft.confidence}
              </span>
            </span>
          </div>
          <ul className="space-y-1">
            {issues.map((i, n) => (
              <li key={n} className="flex items-start gap-2 text-gray-800">
                <Dot severity={i.severity} />
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {issues.length === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-900">
          ✓ Audyt nie znalazł braków. Pewność modelu: {draft.confidence}.
        </div>
      )}

      {/* --- Pola dopełnione przez AI --- */}
      {(draft.aiFilled?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-200 bg-white p-3">
          <div className="font-medium text-gray-900 mb-1">
            🤖 Pola uzupełnione przez AI ({draft.aiFilled!.length})
            {draft.refinedWith && <span className="text-xs text-gray-400 font-normal ml-2">model: {draft.refinedWith}</span>}
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Wartości, których nie było w materiale źródłowym. Sprawdź je uważniej niż resztę; w edytorze zostaną oznaczone do publikacji.
          </p>
          <ul className="space-y-1 text-xs">
            {draft.aiFilled!.map((f, n) => (
              <li key={n} className="flex gap-2">
                <code className="shrink-0 bg-amber-100 text-amber-900 rounded px-1">{f.field}</code>
                <span className="text-gray-800">
                  <strong>{typeof f.value === "string" || typeof f.value === "number" ? String(f.value) : JSON.stringify(f.value)}</strong>
                  <span className="text-gray-500"> · {f.reason}</span>
                  <span className={`ml-1 ${f.basis === "inferred" ? "text-red-600" : "text-gray-400"}`}>[{f.basis}]</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Hero --- */}
      {frames.length > 0 && (
        <div>
          <div className={label}>
            Zdjęcie główne - kliknij klatkę, aby wybrać
            {draft.heroEnhanced && <span className="normal-case font-normal"> (✨ = klatka poprawiona przez AI)</span>}
            <span className="normal-case font-normal"> (★ = propozycje AI)</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {stripUrls.map((f) => (
              <div key={f} className="relative shrink-0 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f}
                  alt=""
                  loading="lazy"
                  onClick={() => p.onPickFrame(f)}
                  className={`h-32 rounded-lg cursor-pointer border-4 transition ${
                    (p.heroFrame ?? draft.heroEnhanced ?? draft.heroFrame ?? frames[0]?.url) === f
                      ? "border-amber-500"
                      : "border-transparent hover:border-gray-300"
                  }`}
                />
                {draft.heroEnhanced === f && (
                  <span className="absolute top-1 left-1 text-[10px] font-semibold bg-black/60 text-white rounded px-1.5 py-0.5">✨ AI</span>
                )}
                {heroCands.has(f) && <span className="absolute top-1 right-1 text-amber-500 drop-shadow">★</span>}
                {frameT.get(f) != null && (
                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white rounded px-1">{fmtT(frameT.get(f))}</span>
                )}
                <button
                  type="button"
                  onClick={() => p.onZoom(f)}
                  title="Podejrzyj w pełnym rozmiarze"
                  className="absolute bottom-1 right-1 bg-black/60 text-white rounded px-1.5 py-0.5 text-[11px] opacity-0 group-hover:opacity-100 transition"
                >
                  🔍
                </button>
              </div>
            ))}
          </div>
          {(() => {
            const pick = p.heroFrame ?? draft.heroFrame ?? frames[0]?.url;
            const urls = frames.map((f) => f.url);
            const target = pick && urls.includes(pick) ? pick : draft.heroFrame ?? frames[0]?.url;
            return (
              <button
                type="button"
                onClick={() => target && p.onEnhance(target)}
                disabled={p.enhancing || !target}
                className="mt-1 inline-flex items-center gap-1.5 bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                {p.enhancing ? "⏳ Generuję zdjęcie..." : "✨ Generuj AI hero z zaznaczonej klatki"}
              </button>
            );
          })()}
          <p className="text-[11px] text-gray-400">
            Koszt ~$0.07 (Gemini). Bez tego przepis dostanie surową klatkę jako zdjęcie główne. {frames.length} unikalnych klatek z rolki.
          </p>
        </div>
      )}

      {/* --- Tekst --- */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <strong>{draft.title}</strong>
          <AiChip field="title" />
          {(draft.categorySlugs ?? []).map((s) => (
            <span key={s} className="bg-gray-900 text-white rounded-full px-2.5 py-0.5 text-xs">{s}</span>
          ))}
          {(draft.categorySlugs ?? []).length === 0 && (
            <span className="bg-red-100 text-red-700 rounded-full px-2.5 py-0.5 text-xs">brak kategorii!</span>
          )}
          {draft.difficulty && (
            <span className="bg-gray-200 text-gray-700 rounded-full px-2.5 py-0.5 text-xs">
              trudność: {draft.difficulty}
              <AiChip field="difficulty" />
            </span>
          )}
        </div>
        <p className="text-gray-600 mt-1">{draft.lead}</p>
      </div>
      {draft.about && (
        <details>
          <summary className={`${label} cursor-pointer`}>Kilka słów o tym przepisie</summary>
          <p className="text-gray-600 whitespace-pre-line mt-1">{draft.about}</p>
        </details>
      )}

      {/* --- Składniki + kroki --- */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className={label}>Składniki</div>
          {(draft.ingredientGroups ?? []).map((g, gi) => (
            <div key={gi} className="mb-2">
              {g.title && <div className="text-xs font-medium text-gray-700">{g.title}</div>}
              <ul className="list-disc ml-4 text-gray-700">
                {(g.items ?? []).map((it, ii) => {
                  const field = `ingredientGroups[${gi}].items[${ii}]`;
                  const filled = filledByField.get(field);
                  return (
                    <li key={ii} className={filled ? "bg-amber-100 rounded px-1 -mx-1" : ""}>
                      {it}
                      <AiChip field={field} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <div className={label}>Kroki i klatki</div>
            <button
              type="button"
              onClick={p.onReassign}
              disabled={p.reassigning || frames.length === 0}
              className="text-xs text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
              title="Model dobierze klatki do kroków od nowa (ok. 0,005 $)"
            >
              {p.reassigning ? "⏳ dobieram klatki..." : "🖼 dobierz klatki ponownie (AI)"}
            </button>
          </div>
          {draft.reassignError && <p className="text-xs text-red-600">{draft.reassignError}</p>}
          <ol className="list-decimal ml-4 text-gray-700 space-y-3">
            {(draft.steps ?? []).map((s, n) => {
              const cands = Array.from(new Set([...(s.image ? [s.image] : []), ...(s.frameCandidates ?? [])]));
              const open = !!openSteps[n];
              const pool = open ? frames.map((f) => f.url) : cands;
              return (
                <li key={n}>
                  <div className={filledByField.get(`steps[${n}].body`) ? "bg-amber-100 rounded px-1 -mx-1" : ""}>
                    {s.title && <span className="font-medium">{s.title}: </span>}
                    {s.body}
                    <AiChip field={`steps[${n}].body`} />
                    {(s.startSec != null || s.endSec != null) && (
                      <span className="text-[10px] text-gray-400 ml-1">
                        {fmtT(s.startSec)}–{fmtT(s.endSec)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap items-center mt-1">
                    {pool.map((u) => (
                      <div key={u} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u}
                          alt=""
                          loading="lazy"
                          onClick={() => patch({ steps: [{ i: n, image: u }] }, `step-${n}`)}
                          onDoubleClick={() => p.onZoom(u)}
                          className={`h-14 rounded cursor-pointer border-2 ${s.image === u ? "border-amber-500" : "border-transparent hover:border-gray-300"}`}
                          title={`${fmtT(frameT.get(u))} · klik = wybierz, dwuklik = powiększ`}
                        />
                      </div>
                    ))}
                    {!s.image && !open && <span className="text-xs text-gray-400 italic">bez zdjęcia</span>}
                    <button
                      type="button"
                      onClick={() => setOpenSteps((o) => ({ ...o, [n]: !open }))}
                      className="text-[11px] text-gray-500 hover:text-gray-900 underline"
                    >
                      {open ? "zwiń" : "inne…"}
                    </button>
                    {s.image && (
                      <button
                        type="button"
                        onClick={() => patch({ steps: [{ i: n, image: null }] }, `step-${n}`)}
                        className="text-[11px] text-gray-500 hover:text-red-600 underline"
                      >
                        bez zdjęcia
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* --- Parametry --- */}
      <div className="flex flex-wrap items-end gap-4 bg-white rounded-lg border border-gray-200 p-3">
        <label className="text-xs text-gray-600">
          Porcje <AiChip field="servings" />
          <input
            key={`s-${draft.servings}`}
            defaultValue={draft.servings ?? ""}
            inputMode="numeric"
            onBlur={(e) => String(draft.servings ?? "") !== e.target.value.trim() && patch({ servings: e.target.value.trim() || null }, "servings")}
            className={`${inputSm} block mt-0.5`}
          />
        </label>
        <label className="text-xs text-gray-600">
          Przygotowanie (min) <AiChip field="prepTimeMin" />
          <input
            key={`p-${draft.prepTimeMin}`}
            defaultValue={draft.prepTimeMin ?? ""}
            inputMode="numeric"
            onBlur={(e) => String(draft.prepTimeMin ?? "") !== e.target.value.trim() && patch({ prepTimeMin: e.target.value.trim() || null }, "prep")}
            className={`${inputSm} block mt-0.5`}
          />
        </label>
        <label className="text-xs text-gray-600">
          Łącznie (min) <AiChip field="totalTimeMin" />
          <input
            key={`t-${draft.totalTimeMin}`}
            defaultValue={draft.totalTimeMin ?? ""}
            inputMode="numeric"
            onBlur={(e) => String(draft.totalTimeMin ?? "") !== e.target.value.trim() && patch({ totalTimeMin: e.target.value.trim() || null }, "total")}
            className={`${inputSm} block mt-0.5`}
          />
        </label>
        <div className="text-xs text-gray-600 ml-auto">
          🔥 <strong>{draft.kcal ?? "?"}</strong> kcal · B {draft.protein ?? "?"} · T {draft.fat ?? "?"} · W {draft.carbs ?? "?"} <span className="text-gray-400">na porcję</span>
        </div>
      </div>

      {/* --- Popraw wg instrukcji --- */}
      <InstructBox
        recipe={{
          title: draft.title ?? "",
          lead: draft.lead ?? "",
          about: draft.about ?? "",
          ingredientGroups: (draft.ingredientGroups ?? []).map((g) => ({ title: g.title ?? null, items: g.items ?? [] })),
          steps: (draft.steps ?? []).map((s) => ({ title: s.title ?? null, body: s.body, tip: s.tip ?? null })),
          servings: draft.servings ?? null,
          prepTimeMin: draft.prepTimeMin ?? null,
          totalTimeMin: draft.totalTimeMin ?? null,
          difficulty: draft.difficulty ?? null,
        } satisfies RecipeText}
        importId={importId}
        models={p.models ? { refine: p.models.refine, available: p.models.available } : null}
        onApply={async (ops: RecipeChange[], instruction: string) => {
          const data = await call("apply-ops", { ops, instruction }, "apply-ops");
          if (!data) throw new Error("Nie udało się zapisać zmian");
          return data.message ?? null;
        }}
      />

      {/* --- Dopełnianie --- */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => call("refine", { model: modelPick?.refine })}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 border border-gray-300 bg-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
        >
          {busy === "refine" ? "⏳ Dopełniam..." : "🤖 Dopełnij braki z AI"}
        </button>
        {p.models && modelPick && (
          <select
            value={modelPick.refine}
            onChange={(e) => setModelPick({ ...modelPick, refine: e.target.value })}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white"
          >
            {Array.from(new Set([modelPick.refine, ...p.models.available])).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
        <span className="text-[11px] text-gray-400">
          Model dostaje materiał źródłowy i listę braków; każdą wywnioskowaną wartość oznacza.
        </span>
      </div>

      {/* --- Wartości odżywcze --- */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="font-medium text-gray-900">
            Wartości odżywcze
            {nutrition && <span className="text-xs text-gray-400 font-normal ml-2">model: {nutrition.model}</span>}
          </div>
          <div className="flex items-center gap-2">
            {p.models && modelPick && (
              <select
                value={modelPick.nutrition}
                onChange={(e) => setModelPick({ ...modelPick, nutrition: e.target.value })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white"
              >
                {Array.from(new Set([modelPick.nutrition, ...p.models.available])).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => call("recalc-nutrition", { model: modelPick?.nutrition })}
              disabled={busy !== null}
              className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {busy === "recalc-nutrition" ? "⏳ Liczę..." : nutrition ? "↻ Policz ponownie z AI" : "✨ Policz z AI"}
            </button>
          </div>
        </div>

        {nutrition ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500 text-left">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Składnik</th>
                    <th className="py-1 pr-2 font-medium">g</th>
                    <th className="py-1 pr-2 font-medium">źródło</th>
                    <th className="py-1 pr-2 font-medium text-right">kcal</th>
                    <th className="py-1 pr-2 font-medium text-right">B</th>
                    <th className="py-1 pr-2 font-medium text-right">T</th>
                    <th className="py-1 pr-2 font-medium text-right">W</th>
                    <th className="py-1 font-medium">per 100 g</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nutrition.items.map((it: NutritionItem, i: number) => {
                    const m = itemMacro(it);
                    const src =
                      it.gramsSource === "stated" ? { t: "z przepisu", c: "bg-green-100 text-green-800" }
                      : it.gramsSource === "measure-table" ? { t: "tabela miar", c: "bg-blue-100 text-blue-800" }
                      : it.gramsSource === "operator" ? { t: "ręcznie", c: "bg-gray-200 text-gray-700" }
                      : { t: "🤖 szacunek", c: "bg-amber-100 text-amber-900" };
                    return (
                      <tr key={i} className={it.excluded ? "text-gray-400" : ""}>
                        <td className="py-1 pr-2">
                          <div>{it.name}</div>
                          <div className="text-[10px] text-gray-400">{it.line}</div>
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            key={`g-${i}-${it.grams}`}
                            defaultValue={it.grams ?? ""}
                            inputMode="decimal"
                            onBlur={(e) =>
                              String(it.grams ?? "") !== e.target.value.trim() &&
                              patch({ nutrition: { items: [{ i, grams: e.target.value.trim() || null }] } }, `g-${i}`)
                            }
                            className={`${inputSm} w-16 ${it.grams == null && !it.excluded ? "border-red-400" : ""}`}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <span className={`rounded px-1 py-0.5 cursor-help ${src.c}`} title={it.assumption ?? ""}>{src.t}</span>
                          <label className="ml-1 text-[10px] text-gray-400 cursor-pointer whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={!!it.excluded}
                              onChange={(e) => patch({ nutrition: { items: [{ i, excluded: e.target.checked }] } }, `x-${i}`)}
                              className="mr-0.5 align-middle"
                            />
                            pomiń
                          </label>
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">{m ? Math.round(m.kcal) : "–"}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{m ? m.protein.toFixed(1) : "–"}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{m ? m.fat.toFixed(1) : "–"}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{m ? m.carbs.toFixed(1) : "–"}</td>
                        <td className="py-1 text-gray-400 whitespace-nowrap">
                          {it.per100 ? `${it.per100.kcal} kcal · ${it.per100.protein}/${it.per100.fat}/${it.per100.carbs}` : "brak"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="font-medium text-gray-900">
                  <tr className="border-t border-gray-200">
                    <td className="py-1 pr-2" colSpan={3}>Cały przepis</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{nutrition.totals.kcal}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{nutrition.totals.protein}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{nutrition.totals.fat}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{nutrition.totals.carbs}</td>
                    <td />
                  </tr>
                  <tr>
                    <td className="py-1 pr-2" colSpan={3}>
                      Na porcję ({nutrition.servings ?? "?"} porcji
                      <span className="text-gray-400 font-normal">
                        {" "}· {nutrition.servingsSource === "operator" ? "ustawione ręcznie" : nutrition.servingsSource === "ai-estimate" ? "ocena AI" : `z materiału (${nutrition.servingsSource})`}
                        {nutrition.servingsEstimate && nutrition.servingsEstimate !== nutrition.servings && (
                          <> · AI ocenia na {nutrition.servingsEstimate}{nutrition.servingsReason ? `: ${nutrition.servingsReason}` : ""}</>
                        )}
                      </span>
                      )
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">{nutrition.perServing?.kcal ?? "?"}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{nutrition.perServing?.protein ?? "?"}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{nutrition.perServing?.fat ?? "?"}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{nutrition.perServing?.carbs ?? "?"}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {nutrition.draftPerServing?.kcal != null && (
              <p className="text-[11px] text-gray-400 mt-2">
                Dla porównania model z wideo podał „na oko”: {nutrition.draftPerServing.kcal} kcal · B {nutrition.draftPerServing.protein ?? "?"} · T {nutrition.draftPerServing.fat ?? "?"} · W {nutrition.draftPerServing.carbs ?? "?"}.
              </p>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Zmiana gramów lub porcji przelicza sumy od razu (bez modelu). „Policz ponownie z AI” buduje rozbicie od nowa.
            </p>
          </>
        ) : (
          <div className="text-xs text-gray-600">
            <p className="mb-2">Brak rozbicia na składniki. Kliknij „Policz z AI” albo wpisz wartości na porcję ręcznie:</p>
            <div className="flex flex-wrap gap-3">
              {(["kcal", "protein", "fat", "carbs"] as const).map((k) => (
                <label key={k} className="text-xs text-gray-600">
                  {k}
                  <input
                    key={`${k}-${draft[k]}`}
                    defaultValue={draft[k] ?? ""}
                    inputMode="decimal"
                    onBlur={(e) => String(draft[k] ?? "") !== e.target.value.trim() && patch({ manualNutrition: { [k]: e.target.value.trim() || null } }, k)}
                    className={`${inputSm} block mt-0.5`}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {busy && busy !== "refine" && busy !== "recalc-nutrition" && <p className="text-[11px] text-gray-400">Zapisuję…</p>}
    </div>
  );
}
