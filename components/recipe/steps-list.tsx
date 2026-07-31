import { useState } from "react";

// Numbered preparation steps; tapping a number marks the step as done.
export default function StepsList({ steps }) {
  const [done, setDone] = useState<Record<number, boolean>>({});

  return (
    <div className="print-recipe">
      <h2 className="text-xl font-bold tracking-tight mb-5">Przygotowanie</h2>
      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li
            key={i}
            className={`rounded-3xl border p-5 transition ${
              done[i]
                ? "border-gray-100 bg-gray-50 opacity-60"
                : "border-gray-100 bg-white shadow-bottomSmall"
            }`}
          >
            <div className="flex gap-4">
              <button
                onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                className={`shrink-0 w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center transition ${
                  done[i]
                    ? "bg-amber-500 text-white"
                    : "bg-gray-900 text-white hover:bg-amber-500"
                }`}
                aria-label={done[i] ? `Krok ${i + 1} — zrobiony` : `Oznacz krok ${i + 1} jako zrobiony`}
              >
                {done[i] ? "✓" : i + 1}
              </button>
              <div className="pt-1">
                {step.title && (
                  <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                )}
                <p className={`leading-relaxed ${done[i] ? "text-gray-400" : "text-gray-700"}`}>
                  {step.body}
                </p>
                {step.tip && (
                  <p className="mt-3 text-sm bg-amber-50 border border-amber-100 text-amber-900 rounded-xl px-3 py-2">
                    💡 {step.tip}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
