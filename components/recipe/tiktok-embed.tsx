import Image from "next/image";
import { useState } from "react";
import { absUrl } from "../../lib/seo";

// Facade embed: looks like a ready player (real video frame as the poster),
// but TikTok's heavy iframe + cookies load only on click — good Core Web
// Vitals and the click doubles as consent (GDPR).
export default function TikTokEmbed({
  url,
  title,
  poster,
}: {
  url: string;
  title: string;
  poster?: string | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const videoId = url.match(/video\/(\d+)/)?.[1];
  if (!videoId) return null;

  return (
    // id + scroll margin: homepage TikTok cards deep-link straight here
    <div
      id="wideo"
      className="mt-8 scroll-mt-24 rounded-3xl border border-gray-100 bg-white shadow-bottomSmall p-6 print:hidden"
    >
      <h2 className="text-xl font-bold tracking-tight mb-4">Zobacz na wideo 🎬</h2>
      {loaded ? (
        // Player v1 honors autoplay (embed/v2 does not), so the poster
        // click starts playback right away instead of showing a second
        // play button; the allow attribute is required for it to work
        <iframe
          src={`https://www.tiktok.com/player/v1/${videoId}?autoplay=1&rel=0&description=0`}
          className="w-full max-w-[325px] h-[578px] mx-auto rounded-2xl border-0"
          allow="autoplay; encrypted-media; fullscreen"
          title={`TikTok: ${title}`}
        />
      ) : (
        <button
          onClick={() => setLoaded(true)}
          className="group relative block w-full max-w-[325px] h-[578px] mx-auto rounded-2xl overflow-hidden bg-gray-900"
          aria-label="Odtwórz wideo z TikToka"
        >
          {poster && (
            <Image
              src={absUrl(poster)}
              alt=""
              fill
              sizes="325px"
              className="object-cover opacity-90 group-hover:opacity-75 transition"
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-white/95 shadow-medium flex items-center justify-center text-2xl pl-1 group-hover:scale-110 transition-transform">
              ▶
            </span>
          </span>
          <span className="absolute bottom-4 inset-x-4 text-center text-white text-xs">
            Kliknięcie uruchomi odtwarzacz TikTok
            <span className="block text-white/60">(TikTok może zapisać pliki cookie)</span>
          </span>
        </button>
      )}
    </div>
  );
}
