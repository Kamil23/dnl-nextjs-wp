import { useEffect, useState } from "react";

// Serce "Zapisz przepis". Zalogowani togglują zapis przez POST /api/zapisane
// (optymistycznie, bez czekania na serwer). Niezalogowanym klik rozwija mały
// box z mailem: wysyłamy magic link i po powrocie użytkownik ląduje z powrotem
// na tej samej stronie. Przycisk renderuje się od razu w stanie domyślnym,
// a prawdziwy stan dociąga się po hydracji - zero skoku layoutu.
export default function SaveRecipeButton({
  recipeId,
  className = "",
}: {
  recipeId: number;
  className?: string;
}) {
  // null = jeszcze nie wiemy (GET w drodze); klik i tak zadziała sensownie
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [mailState, setMailState] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/zapisane?recipeId=${recipeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLoggedIn(!!data.loggedIn);
        setSaved(!!data.saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  async function toggle() {
    if (busy) return;
    if (loggedIn === false) {
      setPanelOpen((v) => !v);
      return;
    }
    // loggedIn === true albo jeszcze nieznany: strzelamy POST-em,
    // ewentualne 401 otworzy box logowania
    const optimistic = loggedIn === true;
    const prev = saved;
    if (optimistic) setSaved(!prev);
    setBusy(true);
    try {
      const res = await fetch("/api/zapisane", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      });
      if (res.status === 401) {
        if (optimistic) setSaved(prev);
        setLoggedIn(false);
        setPanelOpen(true);
        return;
      }
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      setLoggedIn(true);
      setSaved(!!data.saved);
      if (data.saved) {
        (window as any).gtag?.("event", "recipe_saved", { recipe_id: recipeId });
      }
    } catch {
      if (optimistic) setSaved(prev);
    } finally {
      setBusy(false);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || mailState === "sending") return;
    setMailState("sending");
    try {
      const res = await fetch("/api/konto/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), next: window.location.pathname }),
      });
      if (!res.ok) throw new Error("send failed");
      setMailState("done");
    } catch {
      setMailState("error");
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition min-w-[10rem] disabled:opacity-60 ${
          saved
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"
        }`}
      >
        <span aria-hidden="true" className={`text-base leading-none ${saved ? "text-amber-500" : "text-gray-400"}`}>
          {saved ? "♥" : "♡"}
        </span>
        {saved ? "Zapisano" : "Zapisz przepis"}
      </button>

      {panelOpen && loggedIn === false && (
        <div className="mt-3 max-w-md rounded-2xl bg-amber-50 border border-amber-100 p-4">
          {mailState === "done" ? (
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Sprawdź skrzynkę:</span> wysłaliśmy link do
              logowania.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-2">
                Podaj email, a wyślemy Ci link do logowania. Bez hasła i bez zakładania konta.
              </p>
              <form onSubmit={sendLink} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj@email.pl"
                  className="flex-1 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <button
                  type="submit"
                  disabled={mailState === "sending"}
                  className="rounded-full bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {mailState === "sending" ? "Wysyłam…" : "Wyślij link"}
                </button>
              </form>
              {mailState === "error" && (
                <p className="text-sm text-red-600 mt-2">Nie udało się wysłać. Spróbuj ponownie.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
