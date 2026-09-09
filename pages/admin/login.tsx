import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

// Dwustopniowe logowanie: hasło, a gdy zarejestrowano klucz sprzętowy /
// passkey, dodatkowo potwierdzenie kluczem (WebAuthn).
export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"password" | "key">("password");

  async function verifyWithKey() {
    setBusy(true);
    setError("");
    try {
      const optRes = await fetch("/api/admin/webauthn/login-options", { method: "POST" });
      const optData = await optRes.json();
      if (!optRes.ok) throw new Error(optData.error || "Nie udało się rozpocząć weryfikacji");
      const assertion = await startAuthentication({ optionsJSON: optData.options });
      const verRes = await fetch("/api/admin/webauthn/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const verData = await verRes.json();
      if (!verRes.ok) throw new Error(verData.error || "Weryfikacja nie powiodła się");
      router.push("/admin");
    } catch (e: any) {
      // NotAllowedError = anulowano / timeout dotknięcia klucza
      setError(
        e?.name === "NotAllowedError"
          ? "Nie wykryto klucza. Spróbuj ponownie."
          : e.message || "Weryfikacja nie powiodła się"
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.webauthn) {
        setStep("key");
        // od razu odpal dialog klucza
        verifyWithKey();
      } else {
        router.push("/admin");
      }
    } else if (res.status === 429) {
      setError("Zbyt wiele prób. Spróbuj ponownie później.");
    } else {
      setError("Nieprawidłowe hasło");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Head>
        <title>Logowanie - Panel Dieta na luzie</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {step === "password" ? (
        <form onSubmit={submit} className="bg-white rounded-xl shadow-small border border-gray-200 p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-6 text-center font-Pacifico">dieta na luzie</h1>
          <label className="block mb-4">
            <span className="text-sm text-gray-700">Hasło administratora</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-gray-400"
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full bg-gray-900 text-white rounded-lg py-2 hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? "Logowanie..." : "Zaloguj"}
          </button>
        </form>
      ) : (
        <div className="bg-white rounded-xl shadow-small border border-gray-200 p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold mb-2 font-Pacifico">dieta na luzie</h1>
          <div className="text-4xl my-4" aria-hidden>🔐</div>
          <p className="text-gray-700 mb-1 font-medium">Potwierdź kluczem</p>
          <p className="text-sm text-gray-500 mb-5">
            Dotknij klucza sprzętowego albo użyj odcisku palca / Face ID.
          </p>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <button
            onClick={verifyWithKey}
            disabled={busy}
            className="w-full bg-gray-900 text-white rounded-lg py-2 hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? "Czekam na klucz..." : "Użyj klucza"}
          </button>
          <button
            onClick={() => {
              setStep("password");
              setError("");
            }}
            className="mt-3 text-sm text-gray-500 hover:text-gray-800"
          >
            Wróć do hasła
          </button>
        </div>
      )}
    </div>
  );
}
