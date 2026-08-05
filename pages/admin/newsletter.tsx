import { GetServerSideProps } from "next";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import type { EditionContent, EditionItem } from "../../lib/server/edition-composer";

type Edition = {
  id: number;
  number: number;
  subject: string;
  status: "draft" | "sent";
  content: EditionContent;
  sentAt: string | null;
  recipientCount: number | null;
};

const SOURCE_LABELS: Record<string, string> = {
  "recipe-slodkie": "przepisy (słodkie)",
  "recipe-slone": "przepisy (słone)",
  kalkulator: "kalkulator/Planer",
  "cook-mode": "tryb gotowania",
  stopka: "stopka",
};

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="font-semibold text-gray-900">{label}</span>
    </label>
  );
}

function ItemRow({ item, onRemove }: { item: EditionItem; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      {item.heroImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.heroImage} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-xs text-gray-400 truncate">
          {item.kcal ? `${item.kcal} kcal · ` : ""}
          {item.uri}
        </p>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm px-2" title="Usuń z wydania">
          ✕
        </button>
      )}
    </div>
  );
}

export default function AdminNewsletter() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [stats, setStats] = useState<{ status: string; n: number }[]>([]);
  const [bySource, setBySource] = useState<{ source: string; n: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/newsletter");
    if (!res.ok) return;
    const data = await res.json();
    setEditions(data.editions ?? []);
    setStats(data.stats ?? []);
    setBySource(data.bySource ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const draft = editions.find((e) => e.status === "draft") ?? null;
  const sent = editions.filter((e) => e.status === "sent");

  // Live preview: re-render the mail from the UNSAVED editor state (debounced)
  useEffect(() => {
    if (!draft) {
      setPreviewHtml("");
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/newsletter/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", content: draft.content }),
      });
      if (res.ok) setPreviewHtml((await res.json()).html ?? "");
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft?.content]);
  const confirmed = stats.find((s) => s.status === "confirmed")?.n ?? 0;
  const pending = stats.find((s) => s.status === "pending")?.n ?? 0;
  const unsub = stats.find((s) => s.status === "unsubscribed")?.n ?? 0;

  function patchDraft(fn: (c: EditionContent) => EditionContent) {
    if (!draft) return;
    setEditions((eds) =>
      eds.map((e) => (e.id === draft.id ? { ...e, content: fn(e.content) } : e))
    );
  }
  function setSubject(subject: string) {
    if (!draft) return;
    setEditions((eds) => eds.map((e) => (e.id === draft.id ? { ...e, subject } : e)));
  }

  async function compose() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/newsletter", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error || "Błąd składania" });
    await load();
    setMsg({ ok: true, text: data.reused ? "Wracasz do istniejącego szkicu" : "Szkic złożony z bazy ✓" });
  }

  async function saveDraft(silent = false) {
    if (!draft) return false;
    const res = await fetch(`/api/admin/newsletter/${draft.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: draft.subject, content: draft.content }),
    });
    if (!silent) {
      setMsg(res.ok ? { ok: true, text: "Szkic zapisany ✓" } : { ok: false, text: "Błąd zapisu" });
    }
    return res.ok;
  }

  async function sendTest() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    await saveDraft(true);
    const res = await fetch(`/api/admin/newsletter/${draft.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", to: testTo }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: `Testowy poszedł na ${testTo} ✓` }
        : { ok: false, text: data.error || "Błąd wysyłki testowej" }
    );
  }

  async function sendReal() {
    if (!draft) return;
    if (!confirm(`Wysłać wydanie #${draft.number} do ${confirmed} potwierdzonych subskrybentów?`)) return;
    setBusy(true);
    setMsg(null);
    await saveDraft(true);
    const res = await fetch(`/api/admin/newsletter/${draft.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error || "Błąd wysyłki" });
    await load();
    setMsg({ ok: true, text: `Wysłano do ${data.sentTo} osób 🎉` });
  }

  async function removeDraft() {
    if (!draft || !confirm("Usunąć ten szkic?")) return;
    await fetch(`/api/admin/newsletter/${draft.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <AdminShell title="Newsletter">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Newsletter</h1>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
          )}
          <a
            href="/api/admin/newsletter/export"
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-4 py-2"
          >
            Eksport CSV
          </a>
        </div>
      </div>

      {/* Subskrybenci */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <div className="text-3xl font-bold tabular-nums">{confirmed}</div>
          <div className="text-xs text-gray-400 mt-1">potwierdzonych</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <div className="text-3xl font-bold tabular-nums text-gray-400">{pending}</div>
          <div className="text-xs text-gray-400 mt-1">czeka na potwierdzenie</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <div className="text-3xl font-bold tabular-nums text-gray-300">{unsub}</div>
          <div className="text-xs text-gray-400 mt-1">wypisanych</div>
        </div>
      </div>
      {bySource.length > 0 && (
        <p className="text-xs text-gray-400 -mt-4 mb-8">
          Źródła zapisów:{" "}
          {bySource.map((s) => `${SOURCE_LABELS[s.source] ?? s.source}: ${s.n}`).join(" · ")}
        </p>
      )}

      {/* Szkic / kompozytor */}
      {!draft ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-8">
          <p className="text-gray-500 mb-4">
            Brak szkicu. Złożę wydanie automatycznie: nowe przepisy od ostatniej wysyłki,
            nadchodzący sezon i hit ostatnich dni. Ty tylko zatwierdzasz.
          </p>
          <button
            onClick={compose}
            disabled={busy}
            className="bg-gray-900 text-white rounded-lg px-6 py-2.5 text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? "Składam…" : "Przygotuj wydanie"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8 items-start">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h2 className="font-semibold">Szkic wydania #{draft.number}</h2>
            <div className="flex gap-2">
              <a
                href={`/api/admin/newsletter/${draft.id}`}
                target="_blank"
                className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5"
              >
                Podgląd ↗
              </a>
              <button onClick={removeDraft} className="text-sm text-red-500 hover:text-red-700 px-2">
                Usuń szkic
              </button>
            </div>
          </div>

          <label className="block text-sm text-gray-700 mb-5">
            Temat maila
            <input
              value={draft.subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 border border-gray-300 rounded-lg px-3 py-2 w-full text-sm"
            />
          </label>

          <div className="space-y-5">
            <section className="border border-gray-100 rounded-lg p-4">
              <Toggle
                on={draft.content.nowosci.enabled}
                onChange={(v) => patchDraft((c) => ({ ...c, nowosci: { ...c.nowosci, enabled: v } }))}
                label={`Nowości z rolek (${draft.content.nowosci.items.length})`}
              />
              {draft.content.nowosci.enabled &&
                draft.content.nowosci.items.map((item, i) => (
                  <ItemRow
                    key={item.uri}
                    item={item}
                    onRemove={() =>
                      patchDraft((c) => ({
                        ...c,
                        nowosci: { ...c.nowosci, items: c.nowosci.items.filter((_, j) => j !== i) },
                      }))
                    }
                  />
                ))}
              {draft.content.nowosci.items.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">Brak nowych przepisów od ostatniej wysyłki.</p>
              )}
            </section>

            {draft.content.sezon && (
              <section className="border border-gray-100 rounded-lg p-4">
                <Toggle
                  on={draft.content.sezon.enabled}
                  onChange={(v) =>
                    patchDraft((c) => ({ ...c, sezon: c.sezon ? { ...c.sezon, enabled: v } : null }))
                  }
                  label={`Sezon: ${draft.content.sezon.title} (za ${draft.content.sezon.inDays} dni)`}
                />
                {draft.content.sezon.enabled &&
                  draft.content.sezon.items.map((item, i) => (
                    <ItemRow
                      key={item.uri}
                      item={item}
                      onRemove={() =>
                        patchDraft((c) => ({
                          ...c,
                          sezon: c.sezon
                            ? { ...c.sezon, items: c.sezon.items.filter((_, j) => j !== i) }
                            : null,
                        }))
                      }
                    />
                  ))}
              </section>
            )}

            {draft.content.hit.item && (
              <section className="border border-gray-100 rounded-lg p-4">
                <Toggle
                  on={draft.content.hit.enabled}
                  onChange={(v) => patchDraft((c) => ({ ...c, hit: { ...c.hit, enabled: v } }))}
                  label={`Hit ostatnich dni${draft.content.hit.views ? ` (${draft.content.hit.views.toLocaleString("pl-PL")} odsłon)` : ""}`}
                />
                {draft.content.hit.enabled && <ItemRow item={draft.content.hit.item} />}
              </section>
            )}

            <section className="border border-gray-100 rounded-lg p-4">
              <p className="font-semibold text-gray-900 mb-2">Od Roksany (2–3 zdania)</p>
              <textarea
                value={draft.content.odRoksany}
                onChange={(e) => patchDraft((c) => ({ ...c, odRoksany: e.target.value }))}
                rows={3}
                placeholder="np. W tym tygodniu spaliłam pierwszą partię granoli. Przepis w drodze, nie pytajcie."
                className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm"
              />
            </section>

            <section className="border border-gray-100 rounded-lg p-4">
              <Toggle
                on={draft.content.pytanie.enabled}
                onChange={(v) => patchDraft((c) => ({ ...c, pytanie: { ...c.pytanie, enabled: v } }))}
                label="Pytanie od Was (z komentarzy)"
              />
              {draft.content.pytanie.enabled && (
                <div className="mt-2 space-y-2">
                  <input
                    value={draft.content.pytanie.q}
                    onChange={(e) => patchDraft((c) => ({ ...c, pytanie: { ...c.pytanie, q: e.target.value } }))}
                    placeholder="Pytanie, np. Czym zastąpić ksylitol?"
                    className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm"
                  />
                  <textarea
                    value={draft.content.pytanie.a}
                    onChange={(e) => patchDraft((c) => ({ ...c, pytanie: { ...c.pytanie, a: e.target.value } }))}
                    rows={2}
                    placeholder="Odpowiedź Roksany"
                    className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm"
                  />
                </div>
              )}
            </section>

            <section className="border border-gray-100 rounded-lg p-4">
              <p className="font-semibold text-gray-900 mb-2">Slot promo (max co 3. wydanie)</p>
              <select
                value={draft.content.promo.enabled ? (draft.content.promo.kind ?? "") : ""}
                onChange={(e) =>
                  patchDraft((c) => ({
                    ...c,
                    promo: e.target.value
                      ? { enabled: true, kind: e.target.value as any }
                      : { enabled: false, kind: null },
                  }))
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">brak (samo mięso)</option>
                <option value="slodkie">PDF: Fit słodycze bez pieczenia</option>
                <option value="slone">PDF: Szybkie fit posiłki</option>
                <option value="planer">Waitlista Planera</option>
              </select>
            </section>
          </div>

          <div className="flex items-center gap-3 flex-wrap mt-6 pt-5 border-t border-gray-100">
            <button
              onClick={() => saveDraft()}
              disabled={busy}
              className="border border-gray-900 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              Zapisz szkic
            </button>
            <div className="flex items-center gap-2">
              <input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="twoj@email.pl"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
              />
              <button
                onClick={sendTest}
                disabled={busy || !testTo}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                Wyślij testowy
              </button>
            </div>
            <button
              onClick={sendReal}
              disabled={busy || confirmed === 0}
              className="ml-auto bg-gray-900 text-white rounded-lg px-5 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              {busy ? "Pracuję…" : `Zatwierdź i wyślij do ${confirmed}`}
            </button>
          </div>
        </div>

        {/* Podgląd na żywo — rerenderuje się przy każdej zmianie w edytorze */}
        <div className="xl:sticky xl:top-6">
          <p className="text-xs text-gray-400 font-medium mb-2">
            Podgląd na żywo (temat: <span className="text-gray-600">{draft.subject}</span>)
          </p>
          <iframe
            srcDoc={previewHtml}
            title="Podgląd wydania"
            className="w-full h-[78vh] rounded-xl border border-gray-200 bg-[#faf6f0]"
          />
        </div>
        </div>
      )}

      {/* Wysłane */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <p className="px-5 py-3 text-xs text-gray-400 border-b border-gray-100 font-medium">
          Wysłane wydania
        </p>
        {sent.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Jeszcze nic nie poszło w świat.</p>
        ) : (
          sent.map((e) => (
            <div key={e.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  #{e.number} · {e.subject}
                </p>
                <p className="text-xs text-gray-400">
                  {e.sentAt ? new Date(e.sentAt).toLocaleString("pl-PL") : ""} · {e.recipientCount} odbiorców
                </p>
              </div>
              <a
                href={`/api/admin/newsletter/${e.id}`}
                target="_blank"
                className="text-xs text-gray-500 underline hover:text-gray-900 shrink-0"
              >
                podgląd
              </a>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  return { props: {} };
};
