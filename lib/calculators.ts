// Registry of the calculator pages - one place that the hub (/kalkulatory),
// the per-page "inne kalkulatory" cross-links and the nav all read from, so
// internal linking (an SEO signal) stays consistent when a calculator is added.

export type CalculatorMeta = {
  slug: string; // path under /
  title: string; // H1 / nav label
  emoji: string;
  blurb: string; // one-line teaser for the hub + cross-links
};

export const CALCULATORS: CalculatorMeta[] = [
  {
    slug: "kalkulator-kalorii",
    title: "Kalkulator kalorii (BMR i CPM)",
    emoji: "🔥",
    blurb: "Policz podstawową przemianę materii i dzienne zapotrzebowanie kaloryczne wzorem Mifflina-St Jeor.",
  },
  {
    slug: "kalkulator-deficytu-kalorycznego",
    title: "Kalkulator deficytu kalorycznego",
    emoji: "📉",
    blurb: "Ile jeść, żeby chudnąć w bezpiecznym tempie - z prognozą kilogramów na tydzień.",
  },
  {
    slug: "kalkulator-makro",
    title: "Kalkulator makroskładników",
    emoji: "🍗",
    blurb: "Rozłóż kalorie na białko, tłuszcze i węglowodany pod swój cel.",
  },
  {
    slug: "kalkulator-bmi",
    title: "Kalkulator BMI",
    emoji: "⚖️",
    blurb: "Wskaźnik masy ciała i zakres wagi prawidłowej dla Twojego wzrostu.",
  },
  {
    slug: "kalkulator-indeksu-glikemicznego",
    title: "Kalkulator ładunku glikemicznego",
    emoji: "🩸",
    blurb: "Policz ładunek glikemiczny (GL) porcji - przydatne przy insulinooporności.",
  },
];

export function otherCalculators(slug: string) {
  return CALCULATORS.filter((c) => c.slug !== slug);
}
