import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SOCIAL_TIKTOK_URL } from "../../lib/constants";
import { TikTokIcon } from "../icons";

export type TikTokFeedItem = {
  id: number;
  title: string;
  uri: string;
  heroImage: string | null;
  videoUrl: string;
  videoViews?: number | null;
};

// Polish short numbers: 2 800 000 -> "2,8 mln", 279 300 -> "279 tys."
export function formatViews(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("pl-PL")} mln`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("pl-PL")} tys.`;
  return n.toLocaleString("pl-PL");
}

function PlayGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8 5.14v13.72c0 .77.83 1.25 1.5.86l10.6-6.86c.62-.4.62-1.32 0-1.72L9.5 4.28c-.67-.39-1.5.09-1.5.86z" />
    </svg>
  );
}

function CardInner({ v, showViews }: { v: TikTokFeedItem; showViews: boolean }) {
  return (
    <>
      {v.heroImage && (
        <Image
          src={v.heroImage}
          alt={v.title}
          fill
          sizes="176px"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {showViews && v.videoViews != null && (
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 text-white text-[11px] font-semibold px-2 py-0.5">
          <PlayGlyph className="w-2.5 h-2.5" />
          {formatViews(v.videoViews)}
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-12 h-12 rounded-full bg-white/85 group-hover:bg-amber-500 group-hover:text-white text-gray-900 flex items-center justify-center transition shadow-medium">
          <PlayGlyph className="w-5 h-5 ml-0.5" />
        </span>
      </span>
      <span className="absolute top-2 right-2 text-white/90">
        <TikTokIcon className="w-4 h-4" />
      </span>
      <span className="absolute bottom-0 inset-x-0 p-3 text-white text-xs font-semibold leading-snug line-clamp-2">
        {v.title}
      </span>
    </>
  );
}

// In-page lightbox with TikTok's Player v1 (autoplay) and a CTA to the
// recipe - the visitor watches without leaving the site
function VideoModal({ video, onClose }: { video: TikTokFeedItem; onClose: () => void }) {
  const videoId = video.videoUrl.match(/video\/(\d+)/)?.[1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!videoId) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Wideo: ${video.title}`}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.tiktok.com/player/v1/${videoId}?autoplay=1&rel=0&description=0`}
          className="w-[325px] h-[578px] max-h-[80vh] rounded-2xl border-0 bg-black"
          allow="autoplay; encrypted-media; fullscreen"
          title={`TikTok: ${video.title}`}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href={video.uri}
            className="rounded-full bg-amber-500 text-white px-5 py-2 text-sm font-semibold hover:bg-amber-600 transition"
          >
            Zobacz przepis →
          </Link>
          <button
            onClick={onClose}
            className="rounded-full bg-white/15 text-white px-4 py-2 text-sm hover:bg-white/25 transition"
          >
            ✕ Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

// Lightweight TikTok strip: our own recipe photos as 9:16 cards with a
// play overlay. Nothing external loads until interaction. Two modes:
// - "recipe": the card goes to the recipe page, straight to its video
//   section (latest videos = recipes we published)
// - "modal": the card opens an in-page player with a recipe CTA (hits)
export default function TikTokFeed({
  title,
  videos,
  showViews = false,
  mode = "recipe",
}: {
  title: string;
  videos: TikTokFeedItem[];
  showViews?: boolean;
  mode?: "recipe" | "modal";
}) {
  const [playing, setPlaying] = useState<TikTokFeedItem | null>(null);
  if (videos.length === 0) return null;

  const cardCls =
    "group relative shrink-0 w-40 sm:w-44 aspect-[9/16] rounded-2xl overflow-hidden snap-start bg-gray-100";

  return (
    <section className="mb-14">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <a
          href={SOCIAL_TIKTOK_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-gray-500 hover:text-amber-600 transition whitespace-nowrap"
        >
          @roksanacieplicka →
        </a>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 snap-x">
        {videos.map((v) =>
          mode === "recipe" ? (
            <Link
              key={v.id}
              href={`${v.uri}#wideo`}
              aria-label={`Przepis „${v.title}" z wideo`}
              className={cardCls}
            >
              <CardInner v={v} showViews={showViews} />
            </Link>
          ) : (
            <button
              key={v.id}
              onClick={() => setPlaying(v)}
              aria-label={`Odtwórz „${v.title}"`}
              className={cardCls}
            >
              <CardInner v={v} showViews={showViews} />
            </button>
          )
        )}
      </div>
      {playing && <VideoModal video={playing} onClose={() => setPlaying(null)} />}
    </section>
  );
}
