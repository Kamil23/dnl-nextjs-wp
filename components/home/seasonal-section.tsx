import Link from "next/link";

// Wrapper for the "Kalendarz smaków" section: a soft gradient card whose
// colors follow the active theme, so the homepage subtly changes with the
// calendar. Full class strings live here (not in lib/seasonal.ts) because
// Tailwind only scans pages/ and components/.
const TONES: Record<string, string> = {
  "zdrowy-start": "from-sky-50 to-emerald-50 border-sky-100",
  "tlusty-czwartek": "from-pink-50 to-amber-50 border-pink-100",
  walentynki: "from-rose-50 to-pink-50 border-rose-100",
  wielkanoc: "from-lime-50 to-yellow-50 border-lime-100",
  wiosna: "from-green-50 to-emerald-50 border-green-100",
  truskawki: "from-rose-50 to-red-50 border-rose-100",
  "lekkie-lato": "from-sky-50 to-amber-50 border-sky-100",
  "do-pudelka": "from-indigo-50 to-sky-50 border-indigo-100",
  jesien: "from-orange-50 to-amber-50 border-orange-100",
  swieta: "from-red-50 to-emerald-50 border-red-100",
  sylwester: "from-violet-50 to-amber-50 border-violet-100",
};

export function seasonalToneClasses(themeKey: string): string {
  return TONES[themeKey] ?? "from-amber-50 to-orange-50 border-amber-100";
}

export default function SeasonalSection({
  themeKey,
  title,
  subtitle,
  moreHref,
  children,
}: {
  themeKey: string;
  title: string;
  subtitle?: string;
  moreHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`mb-14 rounded-3xl border bg-gradient-to-br ${seasonalToneClasses(themeKey)} p-5 md:p-7`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight mb-1">{title}</h2>
        {moreHref && (
          <Link
            href={moreHref}
            className="text-sm font-semibold text-gray-500 hover:text-amber-600 transition whitespace-nowrap"
          >
            Zobacz wszystkie →
          </Link>
        )}
      </div>
      {subtitle && <p className="text-gray-500 mb-5">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </section>
  );
}
