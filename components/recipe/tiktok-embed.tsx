import { useState } from "react";

// Click-to-load TikTok embed — no third-party script until the user asks,
// which keeps LCP/CLS clean and trackers away from casual readers.
export default function TikTokEmbed({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const videoId = url.match(/video\/(\d+)/)?.[1];
  if (!videoId) return null;

  return (
    <div className="mt-8 rounded-3xl border border-gray-100 bg-white shadow-bottomSmall p-6 print:hidden">
      <h2 className="text-xl font-bold tracking-tight mb-4">Zobacz na wideo 🎬</h2>
      {loaded ? (
        <iframe
          src={`https://www.tiktok.com/embed/v2/${videoId}`}
          className="w-full max-w-[325px] h-[578px] mx-auto rounded-2xl border-0"
          allow="encrypted-media; fullscreen"
          title={`TikTok: ${title}`}
        />
      ) : (
        <button
          onClick={() => setLoaded(true)}
          className="w-full max-w-[325px] h-[240px] mx-auto flex flex-col items-center justify-center gap-3 rounded-2xl bg-gray-900 text-white hover:bg-gray-700 transition"
        >
          <span className="text-4xl" aria-hidden>▶️</span>
          <span className="font-semibold">Odtwórz wideo z TikToka</span>
          <span className="text-xs text-gray-400">kliknięcie załaduje odtwarzacz TikTok</span>
        </button>
      )}
    </div>
  );
}
