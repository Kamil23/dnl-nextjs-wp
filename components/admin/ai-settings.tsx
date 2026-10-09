import { useEffect, useState } from "react";

// Sekcja "Ustawienia AI" na /admin/tiktok: model per etap importu, z listą
// modeli dostępnych na kluczu OpenAI (albo pole tekstowe, gdy listy nie ma).
// Zapis od razu po zmianie; worker podejmie nowe ustawienie przy następnym
// przebiegu kolejki (co 10 s).

type Stage = "draft" | "refine" | "nutrition";
type Models = Record<Stage, string>;

const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "draft", label: "Draft z wideo", hint: "Ogląda klatki i czyta transkrypcję. Tani model wystarcza, ok. 0,01 $ za import." },
  { key: "refine", label: "Dopełnianie braków", hint: "Uzupełnia ilości, porcje i czasy, gdy pewność nie jest wysoka. Mocny model, ok. 0,02 $." },
  { key: "nutrition", label: "Wartości odżywcze", hint: "Gramy składników i tabela per 100 g. Tu liczy się dokładność: mocny model, ok. 0,03 $." },
];

export default function AiSettings() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Models | null>(null);
  const [defaults, setDefaults] = useState<Models | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [hasKey, setHasKey] = useState(true);
  const [saving, setSaving] = useState<Stage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/ai-settings")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models);
        setDefaults(d.defaults);
        setAvailable(d.available ?? []);
        setHasKey(d.hasKey !== false);
      })
      .catch(() => setError("Nie udało się wczytać ustawień AI"));
  }, []);

  async function save(stage: Stage, value: string) {
    if (!models) return;
    const v = value.trim();
    if (!v) return;
    setSaving(stage);
    setError("");
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: { [stage]: v } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      setModels(data.models);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  const summary = models
    ? `${models.draft} · ${models.refine} · ${models.nutrition}`
    : "wczytywanie…";

  return (
    <section className="bg-white rounded-xl border border-gray-200 mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-900">⚙️ Ustawienia AI</span>
        <span className="text-xs text-gray-400 truncate ml-3">{open ? "zwiń" : summary}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {!hasKey && (
            <p className="text-sm text-red-600 mb-3">
              Brak OPENAI_API_KEY w środowisku web. Ustawienia zapiszą się, ale przeliczenia z panelu nie zadziałają.
            </p>
          )}
          <div className="grid sm:grid-cols-3 gap-4">
            {STAGES.map((s) => {
              const value = models?.[s.key] ?? "";
              const inList = available.includes(value);
              return (
                <label key={s.key} className="block text-sm text-gray-700">
                  <span className="font-medium">{s.label}</span>
                  {available.length > 0 ? (
                    <select
                      value={inList ? value : "__custom"}
                      onChange={(e) => {
                        if (e.target.value === "__custom") return;
                        save(s.key, e.target.value);
                      }}
                      disabled={!models || saving === s.key}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                    >
                      {!inList && <option value="__custom">{value || "(własny)"}</option>}
                      {available.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    defaultValue={value}
                    key={value}
                    onBlur={(e) => e.target.value.trim() !== value && save(s.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    disabled={!models || saving === s.key}
                    placeholder="id modelu"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono text-gray-600"
                  />
                  <span className="block text-[11px] text-gray-400 mt-1">
                    {s.hint}
                    {defaults && defaults[s.key] !== value && (
                      <>
                        {" "}
                        <button type="button" onClick={() => save(s.key, defaults[s.key])} className="underline">
                          domyślny: {defaults[s.key]}
                        </button>
                      </>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
          <p className="text-[11px] text-gray-400 mt-3">
            Domyślne wartości pochodzą z OPENAI_MODEL (draft) i OPENAI_STRONG_MODEL (dopełnianie, odżywcze).
            Zmiana działa od następnego importu; przeliczenia z podglądu draftu używają ich od razu.
          </p>
        </div>
      )}
    </section>
  );
}
