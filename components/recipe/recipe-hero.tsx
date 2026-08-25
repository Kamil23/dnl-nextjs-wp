import Image from "next/image";
import Link from "next/link";

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400 tracking-tight" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (i < Math.round(value) ? "★" : "☆")).join("")}
    </span>
  );
}

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur border border-gray-100 shadow-bottomSmall px-3 py-2.5 min-w-[5.5rem]">
      <span className="text-lg leading-none mb-1" aria-hidden>{icon}</span>
      <span className="text-[11px] uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

// Kompaktowy pasek makro na porcję — białko wyróżnione (główny hak diety).
function Macro({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-sm border ${
        highlight ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-gray-50 border-gray-100 text-gray-700"
      }`}
    >
      <span className="font-bold">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </span>
  );
}

const g = (v: unknown) => `${Math.round(Number(v))} g`;

const DIFFICULTY_LABELS = { latwy: "Łatwy", sredni: "Średni", trudny: "Trudny" };

export default function RecipeHero({ recipe }) {
  const facts = [
    recipe.totalTimeMin && { icon: "⏱️", label: "Czas", value: `${recipe.totalTimeMin} min` },
    (recipe.servingsText || recipe.servings) && {
      icon: "🍽️",
      label: "Porcje",
      value: String(recipe.servings ?? recipe.servingsText),
    },
    recipe.difficulty && { icon: "📊", label: "Trudność", value: DIFFICULTY_LABELS[recipe.difficulty] },
    recipe.kcal && { icon: "🔥", label: "Kcal / porcję", value: `${recipe.kcal} kcal` },
  ].filter(Boolean);

  const categories = recipe.categories.filter((c) => c.name !== "Przepisy");

  return (
    <section className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-12">
      {recipe.heroImage && (
        <div className="relative aspect-[4/3] md:aspect-square rounded-3xl overflow-hidden shadow-medium">
          {/* Relative /uploads/* paths stay relative so next/image reads them
              from the origin being browsed (localhost in dev, the app in prod);
              absolutizing them pointed dev at files that live only locally */}
          <Image
            src={recipe.heroImage}
            alt={`Zdjęcie: ${recipe.title}`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover contrast-125"
          />
        </div>
      )}
      <div>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((c) => (
            <Link
              key={c.uri}
              href={c.uri}
              className="text-xs uppercase tracking-widest bg-gray-900 text-white rounded-full px-3 py-1 hover:bg-gray-700"
            >
              {c.name}
            </Link>
          ))}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter leading-tight mb-4">
          {recipe.title}
        </h1>
        {recipe.rating && (
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
            <Stars value={recipe.rating.value} />
            <strong>{Number(recipe.rating.value).toFixed(1)}</strong>
            <span className="text-gray-400">({recipe.rating.count} ocen)</span>
          </div>
        )}
        {recipe.lead && (
          <p className="text-gray-600 leading-relaxed mb-6 line-clamp-4">{recipe.lead}</p>
        )}
        {facts.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {facts.map((f) => (
              <Fact key={f.label} {...f} />
            ))}
          </div>
        )}
        {(recipe.protein || recipe.fat || recipe.carbs) && (
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <span className="text-[11px] uppercase tracking-wide text-gray-400 mr-1">Makro / porcję</span>
            {recipe.protein && <Macro label="białka" value={g(recipe.protein)} highlight />}
            {recipe.fat && <Macro label="tłuszczu" value={g(recipe.fat)} />}
            {recipe.carbs && <Macro label="węgli" value={g(recipe.carbs)} />}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <a
            href="#przepis"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full px-6 py-3 transition shadow-small"
          >
            Przejdź do przepisu ↓
          </a>
          {recipe.videoUrl && (
            <a
              href="#wideo"
              className="inline-flex items-center gap-2 border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-semibold rounded-full px-6 py-[10px] transition"
            >
              <span aria-hidden>▶</span> Obejrzyj wideo
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
