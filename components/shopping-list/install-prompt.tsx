import { useEffect, useState } from "react";

const DISMISSED_KEY = "dnl-pwa-prompt-dismissed";

// Suggests pinning the shopping list to the home screen. Android/Chrome
// exposes beforeinstallprompt so we can trigger the native dialog; iOS
// Safari has no API, so we show a one-line instruction instead. Hidden
// once installed (standalone) or after dismissal.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      return;
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setShowIosHint(true);
      setVisible(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 mt-6 text-sm text-gray-700">
      <span className="text-xl shrink-0" aria-hidden>
        📲
      </span>
      {showIosHint ? (
        <p className="flex-1">
          Miej listę zawsze pod ręką. Stuknij{" "}
          <span className="font-semibold">Udostępnij</span> i wybierz{" "}
          <span className="font-semibold">„Do ekranu początkowego"</span>.
        </p>
      ) : (
        <>
          <p className="flex-1">Miej listę zawsze pod ręką na ekranie głównym.</p>
          <button
            onClick={install}
            className="rounded-full bg-amber-500 text-white px-4 py-1.5 font-semibold hover:bg-amber-600 transition shrink-0"
          >
            Dodaj skrót
          </button>
        </>
      )}
      <button
        onClick={dismiss}
        aria-label="Zamknij"
        className="text-gray-400 hover:text-gray-600 shrink-0 px-1"
      >
        ✕
      </button>
    </div>
  );
}
