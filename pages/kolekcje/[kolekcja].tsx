import Head from 'next/head'
import Link from 'next/link'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import MoreStories from '../../components/more-stories'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import NewsletterSignup from '../../components/newsletter-signup'
import { toListingEdge, listHighProteinRecipes, listGlp1FriendlyRecipes } from '../../lib/queries'
import { getCollection, COLLECTION_SLUGS, type CollectionDef } from '../../lib/collections'
import { MENU_EDGES } from '../../lib/menu'
import { SITE_TITLE, SITE_URL } from '../../lib/constants'

// Definicje kolekcji (treść, SEO, FAQ) żyją w lib/collections.ts - jedno źródło
// prawdy dla tej strony i sitemapy. Tu zostają tylko loadery: który zestaw
// przepisów należy do danej kolekcji (makra per porcja decydują).
const LOADERS: Record<string, () => Promise<any[]>> = {
  'wysokie-bialko': () => listHighProteinRecipes(),
  glp1: () => listGlp1FriendlyRecipes(),
}

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
            Containera - jak na stronie głównej (wcześniej całość dusił max-w-2xl). */}
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
            Kolekcja dopiero się zbiera - nowe przepisy z odpowiednimi makrami
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
  const def = getCollection(slug)
  const loader = LOADERS[slug]
  if (!def || !loader) return { notFound: true }

  const recipes = await loader()

  return {
    props: {
      slug,
      def,
      posts: recipes.map(toListingEdge),
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: COLLECTION_SLUGS.map((k) => ({ params: { kolekcja: k } })),
    fallback: 'blocking',
  }
}
