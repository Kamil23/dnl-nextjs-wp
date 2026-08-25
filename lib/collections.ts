// Central registry of editorial collections. Single source of truth for the
// /kolekcje/[slug] pages AND the sitemap (lib/site-routes.ts) — dodaj kolekcję
// tutaj i pojawi się w obu miejscach automatycznie. Loader (które przepisy
// należą do kolekcji) zostaje w stronie, kluczowany po slugu.

export type CollectionDef = {
  slug: string;
  h1: string;
  seoTitle: string;
  description: string;
  intro: string[];
  notes?: string[];
  faq?: { q: string; a: string }[];
};

export const COLLECTIONS: CollectionDef[] = [
  {
    slug: "wysokie-bialko",
    h1: "Przepisy wysokobiałkowe",
    seoTitle: "Przepisy wysokobiałkowe – min. 25 g białka na porcję",
    description:
      "Przepisy z co najmniej 25 g białka na porcję - syte śniadania, obiady i słodycze, które trzymają głód z daleka.",
    intro: [
      "Białko to najczęściej sprawdzany makroskładnik w polskich wyszukiwarkach - i nie bez powodu: syci najmocniej przy najmniejszej kaloryczności, wspiera budowę mięśni i pomaga nie podjadać między posiłkami.",
      "Poniżej przepisy, które mają co najmniej 25 g białka w porcji. Progi pilnuję sama - makra liczymy dla każdego przepisu, a sortowanie stawia najbardziej białkowe na górze.",
    ],
    faq: [
      {
        q: "Ile białka dziennie potrzeba?",
        a: "Dla większości osób dobre punktem odniesienia jest ok. 1,2–1,6 g białka na kilogram masy ciała dziennie, więcej przy intensywnych treningach siłowych lub w starszym wieku. To orientacyjne wartości - indywidualne zapotrzebowanie policzy Ci nasz kalkulator kalorii, a w kwestiach zdrowotnych warto skonsultować się z dietetykiem.",
      },
      {
        q: 'Czy wysokie białko znaczy "na dietcie"?',
        a: "Nie. Białko pomaga w redukcji, bo syci, ale równie dobrze wspiera budowanie masy i zwykłe gotowanie na co dzień - te przepisy są po prostu syte.",
      },
    ],
  },
  {
    slug: "glp1",
    h1: "Przepisy GLP-1 friendly",
    seoTitle: "Przepisy GLP-1 friendly – sytość przy małej porcji",
    description:
      "Przepisy przyjazne osobom na leczeniu GLP-1 (np. Ozempic, Mounjaro): dużo białka w umiarkowanej kaloryczności, do 500 kcal na porcję.",
    intro: [
      "Leki z grupy GLP-1 (semaglutyd, tirzepatyd) zmieniają apetyt: je się mniej, ale każdy kęs musi dostarczać więcej wartości. Kluczowe staje się białko - chroni mięśnie podczas redukcji - oraz lekkostrawność i małe, treściwe porcje.",
      "Ta kolekcja zbiera przepisy z co najmniej 25 g białka w porcji i do 500 kcal. To kryteria kulinarne, nie medyczne.",
    ],
    notes: [
      "Treści na tej stronie mają charakter informacyjny i nie zastępują porady lekarza ani dietetyka klinicznego. Dawkowanie, dobór leku i dietę przy GLP-1 ustalaj ze swoim lekarzem prowadzącym.",
    ],
    faq: [
      {
        q: "Co jeść przy GLP-1?",
        a: "Najlepiej sprawdzą się małe porcje bogate w białko (chude mięso, ryby, jaja, nabiał, strączki), z warzywami gotowanymi i źródłami błonnika rozpuszczalnego - a tłuste i smażone potrawy warto ograniczyć, bo mogą nasilać nudności. Stąd kryteria tej kolekcji: ≥25 g białka i ≤500 kcal na porcję.",
      },
      {
        q: "Dlaczego białko jest takie ważne na GLP-1?",
        a: 'Bo przy mniejszym apetycie łatwo o niedobór - a białko chroni masę mięśniową podczas chudnięcia i dodatkowo syci. W praktyce oznacza to, że każda porcja powinna mieć swoje "kotwiczne" źródło białka.',
      },
    ],
  },
];

export const COLLECTION_SLUGS = COLLECTIONS.map((c) => c.slug);

export function getCollection(slug: string): CollectionDef | null {
  return COLLECTIONS.find((c) => c.slug === slug) ?? null;
}
