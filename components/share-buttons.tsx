import { FacebookIcon, MailIcon, PinterestIcon, WhatsAppIcon } from "./icons";

// Round social share buttons - plain intent links (what react-share did
// under the hood, minus the package). Brand colors per each platform's
// current guidelines; icons inherit white via currentColor.
export default function SocialShareButtons({
  url,
  mediaUrl,
  title,
}: {
  url: string;
  mediaUrl?: string;
  title: string;
}) {
  const shareText = `dietanaluzie | ${title}. Przepis dostępny jest na blogu Roksany: ${url}`;
  const targets = [
    {
      label: "Udostępnij na WhatsApp",
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`,
      color: "#25D366",
      Icon: WhatsAppIcon,
    },
    {
      label: "Przypnij na Pintereście",
      href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(mediaUrl || "")}&description=${encodeURIComponent(`${title}. Przepis z bloga dietanaluzie, dostępny na stronie: ${url}`)}`,
      color: "#E60023",
      Icon: PinterestIcon,
    },
    {
      label: "Udostępnij na Facebooku",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&hashtag=${encodeURIComponent("#dietanaluzie")}`,
      color: "#0866FF",
      Icon: FacebookIcon,
    },
    {
      label: "Wyślij mailem",
      href: `mailto:?subject=${encodeURIComponent(`Przepis dietanaluzie: ${title}`)}&body=${encodeURIComponent(`Hej! Sprawdź przepis Roksany z dietanaluzie: ${url}`)}`,
      color: "#6b7280",
      Icon: MailIcon,
    },
  ];

  return (
    <>
      {targets.map(({ label, href, color, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={label}
          style={{ backgroundColor: color }}
          className="h-12 w-12 rounded-full flex items-center justify-center text-white hover:opacity-80 transition"
        >
          <Icon className="w-6 h-6" />
        </a>
      ))}
    </>
  );
}
