import { useState } from "react";
import { describePath, type RecipeChange, type RecipeText } from "../../lib/recipe-ops";

// "Popraw wg instrukcji": pole tekstowe dla operatora, model proponuje zestaw
// operacji (krok, składnik, opis...), operator widzi listę zmian przed/po
// i zatwierdza zaznaczone. Sam zapis robi rodzic przez onApply (import: API
// apply-ops; edytor: stan formularza + estymacja). Nic nie zapisuje się tu.

type Props = {
  recipe: RecipeText;
  importId?: number;
  models: { refine: string; available: string[] } | null;
  onApply: (ops: RecipeChange[], instruction: string) => Promise<string | null>; // komunikat po zapisie
};

const fmt = (v: unknown) => {
  if (v == null || v === "") return "∅";
  if (typeof v === "object") {
    const o = v as any;
    if (typeof o.body === "string") return `${o.title ? o.title + ": " : ""}${o.body}${o.tip ? ` (tip: ${o.tip})` : ""}`;
    if (Array.isArray(o.items)) return `${o.title ? o.title + ": " : ""}${o.items.join("; ")}`;
    return JSON.stringify(v);
  }
  return String(v);
};

export default function InstructBox({ recipe, importId, models, onApply }: Props) {
  const [text, setText] = useState("");
  const [model, setModel] = useState<string>("");
  const [busy, setBusy] = useState<"ask" | "apply" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ changes: RecipeChange[]; note: string | null; model: string; rejected: { op: RecipeChange; why: string }[] } | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [done, setDone] = useState("");

  const effectiveModel = model || models?.refine || "";

  async function ask() {
    setBusy("ask");
    setError("");
    setDone("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/recipes/instruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe, instruction: text, model: effectiveModel || undefined, importId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Błąd (${res.status})`);
      setResult(data);
      setPicked(data.changes.map(() => true));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!result) return;
    const ops = result.changes.filter((_, i) => picked[i]);
    if (!ops.length) return;
    setBusy("apply");
    setError("");
    try {
      const msg = await onApply(ops, text);
      setDone(msg ?? `Zastosowano ${ops.length} zmian.`);
      setResult(null);
      setText("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const n = picked.filter(Boolean).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
      <div className="font-medium text-gray-900 mb-1">✍️ Popraw wg instrukcji</div>
      <p className="text-xs text-gray-500 mb-2">
        Napisz, co jest nie tak. AI zaproponuje spójny zestaw zmian we wszystkich polach (krok, składnik z ilością, opis), a Ty
        zatwierdzisz wybrane. Kalorie przeliczą się po zatwierdzeniu.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        rows={2}
        placeholder="np. brakuje kroku: na wierzch kawałek Kinder Bueno"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button
          type="button"
          onClick={ask}
          disabled={busy !== null || !text.trim()}
          className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {busy === "ask" ? "⏳ Analizuję…" : "Zaproponuj zmiany"}
        </button>
        {models && (
          <select
            value={effectiveModel}
            onChange={(e) => setModel(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white"
          >
            {Array.from(new Set([effectiveModel, ...models.available].filter(Boolean))).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
        <span className="text-[11px] text-gray-400">{text.length}/1000</span>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {done && <p className="text-xs text-green-700 mt-2">✓ {done}</p>}

      {result && (
        <div className="mt-3">
          {result.changes.length === 0 ? (
            <p className="text-xs text-gray-600">Model nie zaproponował zmian.{result.note ? ` ${result.note}` : ""}</p>
          ) : (
            <>
              <ul className="space-y-2">
                {result.changes.map((c, i) => (
                  <li key={i} className={`flex items-start gap-2 rounded-lg border p-2 ${picked[i] ? "border-gray-200 bg-gray-50" : "border-gray-100 opacity-60"}`}>
                    <input
                      type="checkbox"
                      checked={!!picked[i]}
                      onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-gray-900">{describePath(recipe, c)}</span>
                        <span className={`rounded-full px-2 py-0.5 ${c.kind === "requested" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-900"}`}>
                          {c.kind === "requested" ? "wprost" : "konsekwencja"}
                        </span>
                        <span className="text-gray-400">{c.op === "add" ? "dodanie" : c.op === "remove" ? "usunięcie" : "zmiana"}</span>
                      </div>
                      {c.op !== "add" && (
                        <div className={`rounded px-2 py-1 mb-1 ${c.op === "remove" ? "bg-red-50 line-through text-red-800" : "bg-red-50 text-red-900"}`}>
                          {fmt(c.before)}
                        </div>
                      )}
                      {c.op !== "remove" && <div className="rounded px-2 py-1 bg-green-50 text-green-900">{fmt((c as any).value)}</div>}
                      {c.reason && <p className="text-gray-500 mt-1">{c.reason}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              {result.rejected.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-2">
                  Pominięte przez walidację: {result.rejected.map((r) => `${r.op.path} (${r.why})`).join("; ")}
                </p>
              )}
              {result.note && <p className="text-xs text-gray-600 mt-2">{result.note}</p>}
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={apply}
                  disabled={busy !== null || n === 0}
                  className="bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === "apply" ? "⏳ Zapisuję…" : `Zastosuj zaznaczone (${n})`}
                </button>
                <button type="button" onClick={() => setResult(null)} className="text-xs text-gray-500 hover:text-gray-900 underline">
                  Odrzuć
                </button>
                <span className="text-[11px] text-gray-400">model: {result.model}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
