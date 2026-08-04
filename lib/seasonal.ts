// "Kalendarz smaków": the homepage's thematic collection and the /sezon/
// landing pages. Each theme has its own curated tag (sezon-*) assigned in
// the admin; tag matches always come first, the category/keyword
// heuristics only fill the remaining slots. Movable feasts are computed;
// the first matching rule wins, so holiday windows are listed before the
// broad seasonal ones.

export type SeasonalTheme = {
  key: string;
  title: string;
  subtitle: string;
  // Longer intro shown (and indexed) on the /sezon/<key>/ landing page
  description: string;
  // The theme's own curated tag, e.g. sezon-lato
  tagSlug: string;
  // Heuristic fallbacks (OR semantics): legacy tags, categories, title words
  tagSlugs: string[];
  categorySlugs: string[];
  keywords: string[];
};

type PeriodCtx = {
  today: Date;
  easter: Date;
  fatThursday: Date;
  shroveTuesday: Date;
  daysSince: (d: Date) => number;
  inRange: (from: [number, number], to: [number, number]) => boolean;
};

const theme = (t: SeasonalTheme) => t;

export const THEMES: (SeasonalTheme & { period: (ctx: PeriodCtx) => boolean })[] = [
  {
    ...theme({
      key: "tlusty-czwartek",
      title: "Tłusty Czwartek na luzie 🍩",
      subtitle: "Fit pączki i drożdżówki, żeby nie żałować ani jednego gryza",
      description:
        "Tłusty Czwartek nie musi kończyć się wyrzutami sumienia. Tu znajdziesz pączki, drożdżówki i inne karnawałowe wypieki w lżejszej wersji, ze zwykłych składników i z pełnymi makro.",
      tagSlug: "sezon-tlusty-czwartek",
      tagSlugs: ["drozdzowki", "kruszonka"],
      categorySlugs: ["wypieki"],
      keywords: ["pączk", "drożdżówk", "faworki", "oponki", "racuch"],
    }),
    period: (c) => c.daysSince(c.fatThursday) >= -12 && c.daysSince(c.shroveTuesday) <= 0,
  },
  {
    ...theme({
      key: "wielkanoc",
      title: "Wielkanoc bez wyrzutów 🐣",
      subtitle: "Mazurki, serniki i babki w lżejszym wydaniu",
      description:
        "Wielkanocne klasyki w wersji fit: mazurki, babki i serniki, które spokojnie postawisz na świątecznym stole. Lżejsze składniki, ten sam smak.",
      tagSlug: "sezon-wielkanoc",
      tagSlugs: ["wielkanoc", "swieta", "przepisy-swiateczne"],
      categorySlugs: [],
      keywords: ["mazurek", "babka", "sernik", "wielkanoc"],
    }),
    period: (c) => c.daysSince(c.easter) >= -14 && c.daysSince(c.easter) <= 1,
  },
  {
    ...theme({
      key: "walentynki",
      title: "Walentynkowe słodkości ❤️",
      subtitle: "Słodkości na wieczór we dwoje",
      description:
        "Desery na randkę w domu: czekoladowe, kremowe i takie w sam raz na dwie łyżeczki. Proste do zrobienia, a robią wrażenie.",
      tagSlug: "sezon-walentynki",
      tagSlugs: ["czekolada", "desery", "deser", "nutella"],
      categorySlugs: ["jednoporcjowe"],
      keywords: ["czekolad", "krem", "deser"],
    }),
    period: (c) => c.inRange([2, 1], [2, 14]),
  },
  {
    ...theme({
      key: "zdrowy-start",
      title: "Zdrowy start roku 💪",
      subtitle: "Lekkie obiady i śniadania na dobry początek roku",
      description:
        "Postanowienia łatwiej utrzymać, kiedy jedzenie smakuje. Lekkie obiady i sycące śniadania, które pomagają zacząć rok bez głodówek i bez nudy na talerzu.",
      tagSlug: "sezon-zdrowy-start",
      tagSlugs: ["szybki-obiad", "sniadanie"],
      categorySlugs: ["obiad", "sniadania"],
      keywords: ["fit", "lekk"],
    }),
    period: (c) => c.inRange([1, 1], [1, 31]),
  },
  {
    ...theme({
      key: "truskawki",
      title: "Sezon na truskawki 🍓",
      subtitle: "Truskawki, maliny i rabarbar w roli głównej",
      description:
        "Krótki i najlepszy sezon w roku. Truskawki, maliny i rabarbar w ciastach, deserach i śniadaniach, póki są najsłodsze i najtańsze.",
      tagSlug: "sezon-truskawki",
      tagSlugs: ["maliny"],
      categorySlugs: [],
      keywords: ["truskawk", "malin", "rabarbar", "owoc"],
    }),
    period: (c) => c.inRange([5, 1], [6, 30]),
  },
  {
    ...theme({
      key: "lekkie-lato",
      title: "Lekkie lato 🌞",
      subtitle: "Desery bez pieczenia i letnie owoce, w sam raz na upały",
      description:
        "Kiedy za oknem upał, piekarnik ma wolne. Serniki na zimno, desery bez pieczenia i letnie owoce w roli głównej.",
      tagSlug: "sezon-lato",
      tagSlugs: ["bez-pieczenia", "sernik-na-zimno", "maliny"],
      categorySlugs: [],
      keywords: ["lody", "bez pieczenia", "jagod", "borówk", "owoc"],
    }),
    period: (c) => c.inRange([7, 1], [8, 31]),
  },
  {
    ...theme({
      key: "do-pudelka",
      title: "Śniadania do pudełka 🎒",
      subtitle: "Szybkie śniadania i przekąski do pracy i szkoły",
      description:
        "Wrzesień to powrót do planowania. Śniadania i przekąski, które przygotujesz wieczorem albo w kwadrans rano i zabierzesz w pudełku do pracy lub szkoły.",
      tagSlug: "sezon-do-pudelka",
      tagSlugs: ["sniadanie", "przekaski", "przekaska"],
      categorySlugs: ["sniadania"],
      keywords: ["owsiank", "tost", "kanapk"],
    }),
    period: (c) => c.inRange([9, 1], [9, 30]),
  },
  {
    ...theme({
      key: "jesien",
      title: "Jesień comfort food 🍂",
      subtitle: "Dynia, jabłka i cynamon, czyli jesienne klasyki w wersji fit",
      description:
        "Szarlotka, dynia, cynamon i jednogarnkowe obiady na chłodne wieczory. Jesienne klasyki w wersji, po której nie trzeba drzemki.",
      tagSlug: "sezon-jesien",
      tagSlugs: ["dania-jednogarnkowe"],
      categorySlugs: ["wypieki", "obiad"],
      keywords: ["dyni", "jabłk", "szarlotk", "cynamon", "rozgrzew"],
    }),
    period: (c) => c.inRange([10, 1], [11, 30]),
  },
  {
    ...theme({
      key: "swieta",
      title: "Święta na luzie 🎄",
      subtitle: "Pierniki i świąteczne serniki bez wyrzutów sumienia",
      description:
        "Pierniki, makowce i świąteczne serniki w lżejszym wydaniu. Żeby przy wigilijnym stole dokładka nie była grzechem.",
      tagSlug: "sezon-swieta",
      tagSlugs: ["swieta", "przepisy-swiateczne"],
      categorySlugs: [],
      keywords: ["piernik", "sernik", "świąteczn", "makow"],
    }),
    period: (c) => c.inRange([12, 1], [12, 26]),
  },
  {
    ...theme({
      key: "sylwester",
      title: "Sylwester i imprezy 🥂",
      subtitle: "Przekąski, które znikają ze stołu pierwsze",
      description:
        "Finger food na domówkę i sylwestra: przekąski, które robi się szybko, a znikają jeszcze szybciej.",
      tagSlug: "sezon-sylwester",
      tagSlugs: ["przepisy-na-sylwestra", "przepisy-imprezowe", "przekaski-na-impreze", "przepisy-na-impreze"],
      categorySlugs: [],
      keywords: ["przekąsk", "imprez"],
    }),
    period: (c) => c.inRange([12, 27], [12, 31]),
  },
  {
    ...theme({
      key: "wiosna",
      title: "Wiosenne przebudzenie 🌱",
      subtitle: "Więcej warzyw i świeżości po zimie",
      description:
        "Po zimie talerz robi się lżejszy i bardziej zielony. Szpinak, świeże warzywa i szybkie dania na dłuższe dni.",
      tagSlug: "sezon-wiosna",
      tagSlugs: ["szpinak", "szybki-obiad"],
      categorySlugs: ["obiad", "sniadania"],
      keywords: ["szpinak", "warzyw", "wiosenn"],
    }),
    // March–April outside the Easter/carnival windows (catch-all, last)
    period: () => true,
  },
];

// Anonymous Gregorian algorithm (Meeus): Easter Sunday for a given year
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const DAY = 24 * 60 * 60 * 1000;

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY);
}

export function getSeasonalTheme(now: Date = new Date()): SeasonalTheme {
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const easter = easterSunday(today.getUTCFullYear());
  const ctx: PeriodCtx = {
    today,
    easter,
    fatThursday: new Date(easter.getTime() - 52 * DAY),
    shroveTuesday: new Date(easter.getTime() - 47 * DAY),
    daysSince: (d) => Math.round((today.getTime() - d.getTime()) / DAY),
    inRange: (from, to) => {
      const n = dayOfYear(today);
      const y = today.getUTCFullYear();
      const a = dayOfYear(new Date(Date.UTC(y, from[0] - 1, from[1])));
      const b = dayOfYear(new Date(Date.UTC(y, to[0] - 1, to[1])));
      return n >= a && n <= b;
    },
  };
  const { period: _period, ...match } = THEMES.find((t) => t.period(ctx))!;
  return match;
}

export function getThemeByKey(key: string): SeasonalTheme | null {
  const found = THEMES.find((t) => t.key === key);
  if (!found) return null;
  const { period: _period, ...rest } = found;
  return rest;
}
