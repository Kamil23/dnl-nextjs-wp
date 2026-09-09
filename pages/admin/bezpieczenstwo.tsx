import { GetServerSideProps } from "next";
import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { db, dbSchema } from "../../lib/db";

// Klucze sprzętowe / passkeys dla panelu. Gdy istnieje choć jeden klucz,
// logowanie wymaga hasła ORAZ potwierdzenia kluczem (ochrona przed phishingiem
// hasła). Awaryjne wejście bez klucza: patrz DEPLOY.md (sekcja Bezpieczeństwo).

type KeyRow = { id: number; name: string; createdAt: string | null; lastUsedAt: string | null };

export default function Security({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/webauthn/keys");
    const data = await res.json();
    if (res.ok) setKeys(data.keys);
  }

  async function addKey() {
    setBusy(true);
    setMessage(null);
    try {
      const optRes = await fetch("/api/admin/webauthn/register-options", { method: "POST" });
      const optData = await optRes.json();
      if (!optRes.ok) throw new Error(optData.error || "Nie udało się rozpocząć rejestracji");
      const attestation = await startRegistration({ optionsJSON: optData.options });
      const verRes = await fetch("/api/admin/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation, name }),
      });
      const verData = await verRes.json();
      if (!verRes.ok) throw new Error(verData.error || "Rejestracja nie powiodła się");
      setName("");
      setMessage({ ok: true, text: "Klucz dodany. Od teraz logowanie wymaga hasła i klucza." });
      await refresh();
    } catch (e: any) {
      setMessage({
        ok: false,
        text:
          e?.name === "NotAllowedError"
            ? "Anulowano albo nie wykryto klucza."
            : e.message || "Rejestracja nie powiodła się",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeKey(k: KeyRow) {
    const last = keys.length === 1;
    const warning = last
      ? `Usunąć klucz "${k.name}"? To OSTATNI klucz: logowanie wróci do samego hasła.`
      : `Usunąć klucz "${k.name}"?`;
    if (!confirm(warning)) return;
    const res = await fetch("/api/admin/webauthn/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: k.id }),
    });
    if (res.ok) await refresh();
  }

  return (
    <AdminShell title="Bezpieczeństwo">
      <h1 className="text-2xl font-bold mb-1">Bezpieczeństwo</h1>
      <p className="text-sm text-gray-500 mb-8">
        Klucze sprzętowe (np. YubiKey) i passkeys (Touch ID, Face ID, Windows Hello). Gdy dodasz
        pierwszy klucz, logowanie do panelu wymaga hasła oraz potwierdzenia kluczem.
      </p>

      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8 max-w-2xl">
        <h2 className="font-bold mb-3">Dodaj klucz</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Nazwa, np. "YubiKey czarny" albo "MacBook Touch ID"'
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <button
            onClick={addKey}
            disabled={busy}
            className="rounded-lg bg-gray-900 text-white px-5 py-2 font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? "Czekam na klucz..." : "🔐 Dodaj klucz"}
          </button>
        </div>
        {message && (
          <p className={`text-sm mt-3 ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>
        )}
      </section>

      <section className="max-w-2xl">
        <h2 className="font-bold mb-3">Zarejestrowane klucze ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Brak kluczy. Logowanie działa samym hasłem. Dodaj klucz, żeby włączyć drugi składnik.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nazwa</th>
                  <th className="px-4 py-3 font-medium">Dodany</th>
                  <th className="px-4 py-3 font-medium">Ostatnio użyty</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">🔑 {k.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {k.createdAt ? new Date(k.createdAt).toLocaleDateString("pl-PL") : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("pl-PL") : "nigdy"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => removeKey(k)} className="text-red-500 hover:text-red-700 text-xs">
                        usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">
          Wskazówka: dodaj co najmniej dwa klucze (np. YubiKey + Touch ID), żeby zgubienie jednego
          nie odcięło Cię od panelu. Awaryjne odzyskanie dostępu opisane w DEPLOY.md.
        </p>
      </section>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const { webauthnCredentials } = dbSchema;
  const keys = await db
    .select({
      id: webauthnCredentials.id,
      name: webauthnCredentials.name,
      createdAt: webauthnCredentials.createdAt,
      lastUsedAt: webauthnCredentials.lastUsedAt,
    })
    .from(webauthnCredentials);
  return { props: { initialKeys: JSON.parse(JSON.stringify(keys)) } };
};
