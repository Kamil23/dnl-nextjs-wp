// "Czym zastąpić?" na stronie przepisu. Dostaje wyłącznie zaakceptowane
// zamienniki (filtrowanie po stronie serwera: listApprovedSubstitutions).
// Płaska lista bez rozwijania, więc bez eventu analytics (treść widoczna
// od razu także dla Google).

export type SubstitutionItem = {
  ingredientText: string;
  substitute: string;
  effect: string | null;
  kcalDelta: number | null;
};

export default function SubstitutionsCard({ items }: { items: SubstitutionItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-bottomSmall p-6 mt-8">
      <h2 className="text-xl font-bold tracking-tight mb-1">Czym zastąpić?</h2>
      <p className="text-xs text-gray-400 mb-4">sprawdzone zamiany</p>
      <ul className="divide-y divide-gray-100">
        {items.map((it, idx) => (
          <li key={`${it.ingredientText}-${idx}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm text-gray-800">
                <span className="font-semibold">{it.ingredientText}</span>
                <span className="mx-1.5 text-gray-300">→</span>
                <span className="font-semibold">{it.substitute}</span>
              </p>
              <KcalBadge delta={it.kcalDelta} />
            </div>
            {it.effect && <p className="mt-1 text-xs text-gray-400">{it.effect}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KcalBadge({ delta }: { delta: number | null }) {
  const d = delta ?? 0;
  const cls =
    d > 0
      ? "bg-amber-50 text-amber-700"
      : d < 0
        ? "bg-emerald-50 text-emerald-700"
        : "bg-gray-50 text-gray-400";
  const label = d > 0 ? `+${d} kcal` : d < 0 ? `${d} kcal` : "±0";
  return (
    <span
      title="Orientacyjna zmiana kalorii na porcję"
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
