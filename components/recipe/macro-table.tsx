export default function MacroTable({ recipe }) {
  const rows = [
    recipe.kcal && { label: "Kalorie", value: `${recipe.kcal} kcal` },
    recipe.protein && { label: "Białko", value: `${recipe.protein} g` },
    recipe.fat && { label: "Tłuszcz", value: `${recipe.fat} g` },
    recipe.carbs && { label: "Węglowodany", value: `${recipe.carbs} g` },
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-bottomSmall p-6 mt-8">
      <h2 className="text-xl font-bold tracking-tight mb-1">Wartości odżywcze</h2>
      <p className="text-xs text-gray-400 mb-4">na porcję</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {rows.map((r) => (
          <div key={r.label} className="text-center rounded-2xl bg-gray-50 py-3">
            <dt className="text-xs uppercase tracking-wide text-gray-400">{r.label}</dt>
            <dd className="text-lg font-bold text-gray-800">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
