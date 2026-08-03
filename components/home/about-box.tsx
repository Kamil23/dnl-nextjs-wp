import Image from "next/image";
import { AUTHOR_AVATAR_URL } from "../../lib/constants";

export default function AboutBox() {
  return (
    <section className="mb-14 rounded-3xl bg-gray-900 text-white p-8 md:p-10 flex flex-col md:flex-row items-center gap-6">
      <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0">
        <Image
          src={AUTHOR_AVATAR_URL}
          alt="Roksana — autorka bloga Dieta na luzie"
          fill
          sizes="112px"
          className="rounded-full object-cover ring-4 ring-amber-400"
        />
      </div>
      <div className="text-center md:text-left">
        <h2 className="text-2xl font-bold tracking-tight mb-2">
          Cześć, jestem Roksana! 👋
        </h2>
        <p className="text-gray-300 leading-relaxed mb-4 max-w-2xl">
          Pokazuję, że zdrowe jedzenie nie musi być nudne ani skomplikowane.
          Gotuję fit wersje ulubionych smaków — serniki, ciasta jednoporcjowe
          i szybkie obiady — i dzielę się nimi tu oraz na TikToku.
        </p>
        <div className="flex gap-3 justify-center md:justify-start">
          <a
            href="https://www.tiktok.com/@roksanacieplicka"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white text-gray-900 px-5 py-2 text-sm font-semibold hover:bg-amber-400 transition"
          >
            TikTok
          </a>
          <a
            href="https://www.instagram.com/roksanaptaszek/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold hover:border-amber-400 hover:text-amber-400 transition"
          >
            Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
