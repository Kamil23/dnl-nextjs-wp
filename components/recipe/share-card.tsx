import { useState } from "react";
import {
  EmailShareButton,
  EmailIcon,
  FacebookShareButton,
  FacebookIcon,
  PinterestShareButton,
  PinterestIcon,
  WhatsappShareButton,
  WhatsappIcon,
} from "react-share";

// Share section designed into the recipe layout: native share (mobile)
// + round social buttons + copy-link, inside a warm gradient card.
export default function ShareCard({ url, mediaUrl, title }) {
  const [copied, setCopied] = useState(false);

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {}
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="mt-8 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-6 text-center print:hidden">
      <h2 className="text-xl font-bold tracking-tight mb-1">
        Smakowało? Podziel się! 🧡
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Wyślij ten przepis komuś, kto powinien go ugotować.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {canNativeShare && (
          <button
            onClick={nativeShare}
            className="h-12 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition"
          >
            Udostępnij
          </button>
        )}
        <WhatsappShareButton
          title={`dietanaluzie | ${title}. Przepis dostępny jest na blogu Roksany: ${url}`}
          url={url}
        >
          <WhatsappIcon size={48} round className="hover:opacity-80 transition" />
        </WhatsappShareButton>
        <PinterestShareButton
          media={mediaUrl}
          description={`${title}. Przepis z bloga dietanaluzie, dostępny na stronie: ${url}`}
          url={url}
        >
          <PinterestIcon size={48} round className="hover:opacity-80 transition" />
        </PinterestShareButton>
        <FacebookShareButton hashtag="#dietanaluzie" url={url}>
          <FacebookIcon size={48} round className="hover:opacity-80 transition" />
        </FacebookShareButton>
        <EmailShareButton
          subject={`Przepis dietanaluzie: ${title}`}
          body={`Hej! Sprawdź przepis Roksany z dietanaluzie: ${url}`}
          url={url}
        >
          <EmailIcon size={48} round className="hover:opacity-80 transition" />
        </EmailShareButton>
        <button
          onClick={copyLink}
          className="h-12 w-12 rounded-full bg-white border border-gray-200 hover:border-gray-400 transition text-lg"
          title="Kopiuj link"
          aria-label="Kopiuj link do przepisu"
        >
          {copied ? "✓" : "🔗"}
        </button>
      </div>
      {copied && <p className="text-xs text-green-600 mt-3">Link skopiowany!</p>}
    </div>
  );
}
