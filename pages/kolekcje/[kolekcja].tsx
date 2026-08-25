import Head from 'next/head'
import Link from 'next/link'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import MoreStories from '../../components/more-stories'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import NewsletterSignup from '../../components/newsletter-signup'
import { toListingEdge, listHighProteinRecipes, listGlp1FriendlyRecipes } from '../../lib/queries'
import { MENU_EDGES } from '../../lib/menu'
import { SITE_TITLE, SITE_URL } from '../../lib/constants'

// Kolekcje edytorskie pod trendy wyszukiwań: wysokobiałkowe (mainstream
// "protein rush") i GLP-1 friendly (rosnąca nisza Ozempic/Mounjaro w PL).
// Treść generowana z DB — makra per porcja decydują o przynależności.

type CollectionDef = {
  h1: string;
  seoTitle: string;
  description: string;
  intro: string[];
  notes?: string[];
  faq?: { q: string; a: string }[];
};

// Definicje serwerowe: load() nie może trafić do propsów (JSON-only),
// więc na stronę idzie tylko CollectionDef bez loadera.
const COLLECTIONS: Record<string, CollectionDef & { load: () => Promise<{ uri: string }[]> }> = {
  'wysokie-bialko': {
    h1: 'Przepisy wysokobiałkowe',
    seoTitle: 'Przepisy wysokobiałkowe – min. 25 g białka na porcję',
    description:
      'Przepisy z co najmniej 25 g białka na porcję — syte śniadania, obiady i słodycze, które trzymają głód z daleka.',
    intro: [
      'Białko to najczęściej sprawdzany makroskładnik w polskich wyszukiwarkach — i nie bez powodu: syci najmocniej przy najmniejszej kaloryczności, wspiera budowę mięśni i pomaga nie podjadać między posiłkami.',
      'Poniżej przepisy, które mają co najmniej 25 g białka w porcji. Progi pilnuję sama — makra liczymy dla każdego przepisu, a sortowanie stawia najbardziej białkowe na górze.',
    ],
    faq: [
      {
        q: 'Ile białka dziennie potrzeba?',
        a: 'Dla większości osób dobre punktem odniesienia jest ok. 1,2–1,6 g białka na kilogram masy ciała dziennie, więcej przy intensywnych treningach siłowych lub w starszym wieku. To orientacyjne wartości — indywidualne zapotrzebowanie policzy Ci nasz kalkulator kalorii, a w kwestiach zdrowotnych warto skonsultować się z dietetykiem.',
      },
      {
        q: 'Czy wysokie białko znaczy "na dietcie"?',
        a: 'Nie. Białko pomaga w redukcji, bo syci, ale równie dobrze wspiera budowanie masy i zwykłe gotowanie na co dzień — te przepisy są po prostu syte.',
      },
    ],
    load: () => listHighProteinRecipes(),
  },
  glp1: {
    h1: 'Przepisy GLP-1 friendly',
    seoTitle: 'Przepisy GLP-1 friendly – sytość przy małej porcji',
    description:
      'Przepisy przyjazne osobom na leczeniu GLP-1 (np. Ozempic, Mounjaro): dużo białka w umiarkowanej kaloryczności, do 500 kcal na porcję.',
    intro: [
      'Leki z grupy GLP-1 (semaglutyd, tirzepatyd) zmieniają apetyt: je się mniej, ale każdy kęs musi dostarczać więcej wartości. Kluczowe staje się białko — chroni mięśnie podczas redukcji — oraz lekkostrawność i małe, treściwe porcje.',
      'Ta kolekcja zbiera przepisy z co najmniej 25 g białka w porcji i do 500 kcal. To kryteria kulinarne, nie medyczne.',
    ],
    notes: [
      'Treści na tej stronie mają charakter informacyjny i nie zastępują porady lekarza ani dietetyka klinicznego. Dawkowanie, dobór leku i dietę przy GLP-1 ustalaj ze swoim lekarzem prowadzącym.',
    ],
    faq: [
      {
        q: 'Co jeść przy GLP-1?',
        a: 'Najlepiej sprawdzą się małe porcje bogate w białko (chude mięso, ryby, jaja, nabiał, strączki), z warzywami gotowanymi i źródłami błonnika rozpuszczalnego — a tłuste i smażone potrawy warto ograniczyć, bo mogą nasilać nudności. Stąd kryteria tej kolekcji: ≥25 g białka i ≤500 kcal na porcję.',
      },
      {
        q: 'Dlaczego białko jest takie ważne na GLP-1?',
        a: 'Bo przy mniejszym apetycie łatwo o niedobór — a białko chroni masę mięśniową podczas chudnięcia i dodatkowo syci. W praktyce oznacza to, że każda porcja powinna mieć swoje "kotwiczne" źródło białka.',
      },
    ],
    load: () => listGlp1FriendlyRecipes(),
  },
};

export default function CollectionPage({ slug, def, posts }: { slug: string; def: CollectionDef; posts: any[] }) {
  const canonical = `${SITE_URL}/kolekcje/${slug}/`

  const faqSchema = def.faq
    ? {
        '@context': 'https://schema.org/',
        '@type': 'FAQPage',
        mainEntity: def.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`${def.seoTitle} - ${SITE_TITLE}`}</title>
        <meta name="description" content={def.description} />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`${def.h1} - ${SITE_TITLE}`} />
        <meta property="og:description" content={def.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content={SITE_TITLE} />
        {faqSchema && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        )}
      </Head>
      <Container>
        {/* Tekst czytelnej szerokości, ale siatka przepisów na pełną szerokość
            Containera — jak na stronie głównej (wcześniej całość dusił max-w-2xl). */}
        <div className="max-w-2xl mx-auto">
          <PostTitle>{def.h1}</PostTitle>
          {def.intro.map((p) => (
            <p key={p.slice(0, 24)} className="text-gray-600 mb-4">
              {p}
            </p>
          ))}
          {def.notes?.map((n) => (
            <p key={n.slice(0, 24)} className="text-sm text-gray-400 border-l-2 border-gray-200 pl-3 my-6">
              {n}
            </p>
          ))}
        </div>

        {posts.length > 0 ? (
          <div className="mt-10">
            <p className="text-sm text-gray-400 mb-4">Znaleziono: {posts.length}</p>
            <MoreStories posts={posts} />
          </div>
        ) : (
          <p className="max-w-2xl mx-auto text-gray-500 mt-10 mb-24">
            Kolekcja dopiero się zbiera — nowe przepisy z odpowiednimi makrami
            trafiają tu automatycznie. Zobacz wszystkie{' '}
            <Link href="/kategoria/przepisy/" className="underline underline-offset-2">
              przepisy
            </Link>
            .
          </p>
        )}

        <div className="max-w-2xl mx-auto mb-24">
          {def.faq && (
            <>
              <h2 className="font-bold text-lg mt-4 mb-4">Częste pytania</h2>
              <div className="space-y-6">
                {def.faq.map((f) => (
                  <div key={f.q}>
                    <h3 className="font-bold mb-1">{f.q}</h3>
                    <p className="text-gray-600">{f.a}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-12 border-t border-gray-100 pt-8">
            <NewsletterSignup source="kolekcje" />
          </div>
        </div>
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.kolekcja as string
  const def = COLLECTIONS[slug]
  if (!def) return { notFound: true }

  const recipes = await def.load()
  const { load: _load, ...serializableDef } = def

  return {
    props: {
      slug,
      def: serializableDef,
      posts: recipes.map(toListingEdge),
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: Object.keys(COLLECTIONS).map((k) => ({ params: { kolekcja: k } })),
    fallback: 'blocking',
  }
}
