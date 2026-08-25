import Head from "next/head";
import Link from "next/link";
import { GetStaticProps } from "next";
import { useMemo, useState } from "react";
import { eq, inArray } from "drizzle-orm";
import Container from "../components/container";
import Layout from "../components/layout";
import PostTitle from "../components/post-title";
import NewsletterSignup from "../components/newsletter-signup";
import RecipeTile, { type RecipeTileData } from "../components/recipe-tile";
import { db, dbSchema } from "../lib/db";
import { getCategoryByUri, listRecipesInCategoryTree } from "../lib/queries";
import { dietsFromTags, DIET_FACETS } from "../lib/diets";
import { MENU_EDGES } from "../lib/menu";
import { SITE_TITLE, SITE_URL } from "../lib/constants";

// „Co na obiad?" — natychmiastowy losownik obiadów. Pula (kategoria Obiad) jest
// prekomputowana do strony (SSG/ISR), a losowanie dzieje się po stronie klienta,
// więc klik daje wynik w ułamku sekundy, bez API i bez rate-limitów.

const HIGH_PROTEIN_MIN = 25;
const PICKS = 3;

type Dinner = RecipeTileData & { diets: string[] };
type DietOpt = { key: string; label: string };

const FAQ = [
  {
    q: "Co na szybki obiad?",
    a: 'Kliknij „Wylosuj obiad" i włącz chip „do 20 minut" — pokażemy do 3 gotowych pomysłów na obiad w kwadrans z naszych sprawdzonych przepisów.',
  },
  {
    q: "Co na obiad dietetyczny?",
    a: 'Każdy przepis ma podane kalorie i białko na porcję. Włącz „wysokobiałkowy", żeby losować syte obiady z co najmniej 25 g białka — dobre na redukcji.',
  },
  {
    q: "Pomysł na obiad w 15 minut?",
    a: 'Ustaw filtr czasu na „do 20 minut" i losuj — podpowiemy szybkie obiady, które zrobisz po pracy, z czasem przygotowania podanym na karcie.',
  },
  {
    q: "Co na obiad wysokobiałkowy?",
    a: 'Włącz chip „wysokobiałkowy (≥25 g)" — losownik pokaże obiady z wysoką zawartością białka, sycące i idealne po treningu.',
  },
];

const faqSchema = {
  "@context": "https://schema.org/",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
const breadcrumbSchema = {
  "@context": "https://schema.org/",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: SITE_TITLE, item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Co na obiad?", item: `${SITE_URL}/co-na-obiad/` },
  ],
};

function shuffleTake<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export default function CoNaObiad({
  dinners,
  availableDiets,
  initialPicks,
}: {
  dinners: Dinner[];
  availableDiets: DietOpt[];
  initialPicks: Dinner[];
}) {
  const [czas, setCzas] = useState("");
  const [bialko, setBialko] = useState(false);
  const [dieta, setDieta] = useState("");
  const [picks, setPicks] = useState<Dinner[]>(initialPicks);

  const filtered = useMemo(
    () =>
      dinners.filter((d) => {
        if (czas && !(d.totalTimeMin != null && d.totalTimeMin <= parseInt(czas, 10))) return false;
        if (bialko && !(d.protein != null && Number(d.protein) >= HIGH_PROTEIN_MIN)) return false;
        if (dieta && !d.diets.includes(dieta)) return false;
        return true;
      }),
    [dinners, czas, bialko, dieta]
  );

  function roll(pool = filtered) {
    setPicks(shuffleTake(pool, PICKS));
  }

  // zmiana filtra od razu przelicza propozycje
  function apply(next: { czas?: string; bialko?: boolean; dieta?: string }) {
    const nc = next.czas ?? czas;
    const nb = next.bialko ?? bialko;
    const nd = next.dieta ?? dieta;
    setCzas(nc);
    setBialko(nb);
    setDieta(nd);
    const pool = dinners.filter((d) => {
      if (nc && !(d.totalTimeMin != null && d.totalTimeMin <= parseInt(nc, 10))) return false;
      if (nb && !(d.protein != null && Number(d.protein) >= HIGH_PROTEIN_MIN)) return false;
      if (nd && !d.diets.includes(nd)) return false;
      return true;
    });
    roll(pool);
  }

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm border transition ${
      active ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-amber-400"
    }`;

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Co na obiad? Losownik pomysłów na obiad - ${SITE_TITLE}`}</title>
        <meta
          name="description"
          content="Nie wiesz, co na obiad? Kliknij i wylosuj do 3 gotowych pomysłów na obiad z naszych przepisów. Zawęź do szybkich (do 20–30 min) lub wysokobiałkowych. Za darmo."
        />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href={`${SITE_URL}/co-na-obiad/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Co na obiad? Losownik pomysłów na obiad - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/co-na-obiad/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      </Head>
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <PostTitle>Co na obiad? 🍽️</PostTitle>
          <p className="text-gray-600 mb-6">
            Odwieczny problem rozwiązany w sekundę. Kliknij, a wylosujemy do 3 gotowych pomysłów na
            obiad z naszych przepisów — z czasem, kaloriami i białkiem na porcję. Nie pasuje? Losuj dalej.
          </p>

          <button
            onClick={() => roll()}
            className="rounded-full bg-gray-900 text-white px-8 py-4 text-lg font-semibold hover:bg-amber-500 transition shadow-small"
          >
            {picks.length ? "🎲 Losuj ponownie" : "🎲 Wylosuj obiad"}
          </button>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className={chip(czas === "20")} onClick={() => apply({ czas: czas === "20" ? "" : "20" })}>
              do 20 minut
            </button>
            <button className={chip(czas === "30")} onClick={() => apply({ czas: czas === "30" ? "" : "30" })}>
              do 30 minut
            </button>
            <button className={chip(bialko)} onClick={() => apply({ bialko: !bialko })}>
              wysokobiałkowy ≥{HIGH_PROTEIN_MIN}g
            </button>
            {availableDiets.map((d) => (
              <button key={d.key} className={chip(dieta === d.key)} onClick={() => apply({ dieta: dieta === d.key ? "" : d.key })}>
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">{filtered.length} obiadów pasuje do wyboru</p>
        </div>

        <div className="mt-10 mb-16">
          {picks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {picks.map((d) => (
                <RecipeTile key={d.uri} recipe={d} />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">
              Brak obiadów pod te filtry — poluzuj wybór i losuj ponownie.
            </p>
          )}
        </div>

        <div className="max-w-2xl mx-auto mb-24">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-bottomSmall p-6 mb-12">
            <NewsletterSignup source="kolekcje" />
          </div>

          <h2 className="font-bold text-lg mb-4">Częste pytania</h2>
          <div className="space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="font-bold mb-1">{f.q}</h3>
                <p className="text-gray-600">{f.a}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-400 mt-10">
            Szukasz konkretów? Zajrzyj do{" "}
            <Link href="/kategoria/przepisy/obiad/" className="underline underline-offset-2">
              wszystkich obiadów
            </Link>{" "}
            albo do{" "}
            <Link href="/kolekcje/wysokie-bialko/" className="underline underline-offset-2">
              przepisów wysokobiałkowych
            </Link>
            .
          </p>
        </div>
      </Container>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const cat = await getCategoryByUri("/kategoria/przepisy/obiad/");
  if (!cat) {
    return { props: { dinners: [], availableDiets: [], initialPicks: [] }, revalidate: 3600 };
  }

  const recipes = await listRecipesInCategoryTree(cat.id);
  const ids = recipes.map((r) => r.id);

  // Diety per przepis z tagów (jedno zapytanie), przez wspólny mapper lib/diets.
  const { recipeTags, tags } = dbSchema;
  const tagRows = ids.length
    ? await db
        .select({ recipeId: recipeTags.recipeId, slug: tags.slug, name: tags.name })
        .from(recipeTags)
        .innerJoin(tags, eq(tags.id, recipeTags.tagId))
        .where(inArray(recipeTags.recipeId, ids))
    : [];
  const tagsByRecipe = new Map<number, string[]>();
  for (const t of tagRows) {
    const arr = tagsByRecipe.get(t.recipeId) ?? [];
    arr.push(t.slug, t.name);
    tagsByRecipe.set(t.recipeId, arr);
  }

  const dinners: Dinner[] = recipes.map((r) => ({
    title: r.title,
    uri: r.uri,
    heroImage: r.heroImage,
    kcal: r.kcal,
    protein: r.protein != null ? Math.round(Number(r.protein)) : null,
    totalTimeMin: r.totalTimeMin,
    ratingValue: r.legacyRatingValue != null ? Number(r.legacyRatingValue) : null,
    diets: dietsFromTags(tagsByRecipe.get(r.id) ?? []),
  }));

  const availableDiets: DietOpt[] = DIET_FACETS.filter((d) =>
    dinners.some((x) => x.diets.includes(d.key))
  ).map((d) => ({ key: d.key, label: d.label }));

  // 3 najlepiej oceniane — deterministycznie, dla pierwszego paintu (bez hydration mismatch)
  const initialPicks = [...dinners]
    .sort((a, b) => (Number(b.ratingValue) || 0) - (Number(a.ratingValue) || 0))
    .slice(0, PICKS);

  return {
    props: JSON.parse(JSON.stringify({ dinners, availableDiets, initialPicks })),
    revalidate: 3600,
  };
};
