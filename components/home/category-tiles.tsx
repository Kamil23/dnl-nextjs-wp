import Image from "next/image";
import { absUrl } from "../../lib/seo";
import Link from "next/link";

function przepisow(n: number) {
  if (n === 1) return "przepis";
  const t = n % 10;
  const h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? "przepisy" : "przepisów";
}

export default function CategoryTiles({ tiles }) {
  if (!tiles?.length) return null;
  return (
    <section className="mb-14">
      <h2 className="text-2xl font-bold tracking-tight mb-5">Czego szukasz?</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Link
            key={t.uri}
            href={t.uri}
            className="group relative aspect-square rounded-2xl overflow-hidden shadow-bottomSmall"
          >
            {t.image ? (
              <Image
                src={absUrl(t.image)}
                alt={t.name}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover contrast-125 group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="absolute inset-0 bg-amber-100" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-3 text-white">
              <div className="font-bold leading-tight">{t.name}</div>
              <div className="text-xs text-white/70">
                {t.count} {przepisow(t.count)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
