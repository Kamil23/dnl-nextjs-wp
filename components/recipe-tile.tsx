import Image from "next/image";
import Link from "next/link";

// Big clickable recipe tile for instant-search results: photo-first,
// with the three facts that drive the choice (time, kcal, rating).
export type RecipeTileData = {
  title: string;
  uri: string;
  heroImage?: string | null;
  lead?: string | null;
  kcal?: number | null;
  totalTimeMin?: number | null;
  ratingValue?: number | null;
};

export default function RecipeTile({ recipe }: { recipe: RecipeTileData }) {
  const chips = [
    recipe.totalTimeMin && `⏱ ${recipe.totalTimeMin} min`,
    recipe.kcal && `🔥 ${recipe.kcal} kcal`,
    recipe.ratingValue && `⭐ ${Number(recipe.ratingValue).toFixed(1)}`,
  ].filter(Boolean) as string[];

  return (
    <Link href={recipe.uri} className="group block">
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-bottomSmall bg-amber-50">
        {recipe.heroImage && (
          <Image
            src={recipe.heroImage}
            alt={recipe.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover contrast-125 group-hover:scale-105 transition-transform duration-300"
          />
        )}
        {chips.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-bottomSmall"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
      <h3 className="mt-3 font-bold text-gray-900 leading-snug group-hover:text-amber-600 transition-colors">
        {recipe.title}
      </h3>
      {recipe.lead && (
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{recipe.lead}</p>
      )}
    </Link>
  );
}
