import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      router.push("/admin");
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
    </div>
  );
}
