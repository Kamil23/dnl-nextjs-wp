import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { scaleIngredient } from "../../lib/quantity";
import { useWakeLock } from "../../lib/use-wake-lock";

// Fullscreen step-by-step cooking mode: one step per screen, big type,
// keyboard/tap navigation, auto wake lock and timers detected in step text
// ("gotować 6 minut" -> a live 6:00 countdown with a gong).

function detectTimerSeconds(text: string): number | null {
  const m = text.match(/(\d+)\s*(godzin|godz)/i);
  const h = m ? parseInt(m[1], 10) : 0;
  const m2 = text.match(/(\d+)(?:\s*[-–]\s*\d+)?\s*min/i);
  const min = m2 ? parseInt(m2[1], 10) : 0;
  const total = h * 3600 + min * 60;
  return total >= 60 ? total : null;
}

function gong() {
  try {
    const ctx = new AudioContext();
    [0, 0.3, 0.6].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.3);
    });
  } catch {}
}

function Timer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const done = left === 0;

  useEffect(() => {
    if (!running || done) return;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          gong();
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, done]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <button
      onClick={() => (done ? (setLeft(seconds), setRunning(true)) : setRunning(!running))}
      className={`mt-6 inline-flex items-center gap-3 rounded-full px-6 py-3 text-xl font-mono font-bold transition ${
        done
          ? "bg-green-500 text-white animate-pulse"
          : running
            ? "bg-amber-500 text-white"
            : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {done ? "✓ Czas minął! (restart)" : `${running ? "⏸" : "▶"} ${mm}:${ss}`}
    </button>
  );
}

export default function CookMode({ recipe, factor, onClose }) {
  const [idx, setIdx] = useState(-1); // -1 = ingredients screen
  const steps = recipe.steps;
  const total = steps.length;
  const touchX = useRef<number | null>(null);

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, total)), [total]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, -1)), []);

  // Keyboard: arrows/space navigate, Esc exits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Screen stays awake for the whole session (Wake Lock + video fallback)
  useWakeLock();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const step = idx >= 0 && idx < total ? steps[idx] : null;
  const timerSeconds = useMemo(() => (step ? detectTimerSeconds(step.body) : null), [step]);
  const ingredients = recipe.ingredientGroups.flatMap((g) => g.items);

  // Portal to <body>: this component mounts inside the lg:sticky
  // ingredients column, and position:sticky creates a stacking context, so
  // z-[100] alone still painted under later siblings (the video iframe)
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-gray-950 text-white flex flex-col print:hidden"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -50) next();
        if (dx > 50) prev();
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="text-sm text-white/50 truncate pr-4">{recipe.title}</div>
        <button onClick={onClose} className="text-white/70 hover:text-white text-sm shrink-0">
          ✕ Zamknij (Esc)
        </button>
      </div>

      <div className="flex justify-center gap-1.5 px-5 mb-4">
        {[-1, ...steps.map((_, i) => i)].map((i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={i === -1 ? "Składniki" : `Krok ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-8 bg-amber-400" : "w-4 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
        <button
          onClick={() => setIdx(total)}
          aria-label="Koniec"
          className={`h-1.5 rounded-full transition-all ${
            idx === total ? "w-8 bg-green-400" : "w-4 bg-white/20"
          }`}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 flex items-center justify-center">
        {idx === -1 && (
          <div className="max-w-lg w-full">
            <h2 className="text-3xl font-bold mb-6 text-center">Składniki 🧺</h2>
            <ul className="space-y-3 text-xl leading-relaxed">
              {ingredients.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-amber-400">•</span>
                  {scaleIngredient(item, factor)}
                </li>
              ))}
            </ul>
            <p className="text-center text-white/40 text-sm mt-8">
              Przesuń / strzałka w prawo, aby zacząć →
            </p>
          </div>
        )}

        {step && (
          <div className="max-w-2xl w-full text-center">
            <div className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-3">
              Krok {idx + 1} z {total}
            </div>
            {step.title && <h2 className="text-3xl font-bold mb-4">{step.title}</h2>}
            <p className="text-2xl md:text-3xl leading-relaxed">{step.body}</p>
            {step.tip && (
              <p className="mt-6 text-lg text-amber-200/90 bg-amber-500/10 rounded-2xl px-5 py-3 inline-block">
                💡 {step.tip}
              </p>
            )}
            {timerSeconds && (
              <div>
                <Timer key={idx} seconds={timerSeconds} />
              </div>
            )}
          </div>
        )}

        {idx === total && (
          <div className="text-center">
            <div className="text-7xl mb-6">🎉</div>
            <h2 className="text-4xl font-bold mb-3">Smacznego!</h2>
            <p className="text-white/60 text-lg mb-8">
              Udało się? Oceń przepis, pomożesz innym go znaleźć.
            </p>
            <button
              onClick={onClose}
              className="rounded-full bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-8 py-3 text-lg transition"
            >
              Wróć i oceń ⭐
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between px-5 pb-6 gap-3">
        <button
          onClick={prev}
          disabled={idx === -1}
          className="rounded-full border border-white/20 px-6 py-3 disabled:opacity-30 hover:border-white/50 transition"
        >
          ← Wstecz
        </button>
        <button
          onClick={next}
          disabled={idx === total}
          className="rounded-full bg-white text-gray-950 font-semibold px-8 py-3 disabled:opacity-30 hover:bg-amber-400 transition"
        >
          Dalej →
        </button>
      </div>
    </div>,
    document.body
  );
}
