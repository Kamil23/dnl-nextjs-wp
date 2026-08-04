import Head from 'next/head'
import Link from 'next/link'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import Layout from '../../components/layout'
import MoreStories from '../../components/more-stories'
import { seasonalToneClasses } from '../../components/home/seasonal-section'
import { MENU_EDGES } from '../../lib/menu'
import { SITE_TITLE, SITE_URL } from '../../lib/constants'
import { getThemeByKey, THEMES } from '../../lib/seasonal'
import { listThemedRecipes, toListingEdge } from '../../lib/queries'

// Landing page of a "Kalendarz smaków" period: every recipe of the theme,
// curated sezon-* tags first. Indexed on purpose. Seasonal queries
// ("przepisy na tłusty czwartek") build rank all year and peak on time.
export default function SeasonPage({ theme, posts }) {
  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`${theme.title} - ${SITE_TITLE}`}</title>
        <meta name="description" content={theme.description} />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/sezon/${theme.key}/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={theme.title} />
        <meta property="og:description" content={theme.description} />
        <meta property="og:url" content={`${SITE_URL}/sezon/${theme.key}/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
      </Head>
      <Container>
        <article className="mb-24">
          <header
            className={`mt-8 mb-10 rounded-3xl border bg-gradient-to-br ${seasonalToneClasses(theme.key)} p-6 md:p-10`}
          >
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter leading-tight mb-3">
              {theme.title}
            </h1>
            <p className="text-gray-600 max-w-2xl">{theme.description}</p>
          </header>

          {posts.length > 0 ? (
            <MoreStories posts={posts} />
          ) : (
            <p className="text-center text-gray-500 py-12">
              Przepisy na ten okres już wkrótce. Zajrzyj do{' '}
              <Link href="/przepisy/" className="underline hover:text-amber-600">
                wszystkich przepisów
              </Link>
              .
            </p>
          )}
        </article>
      </Container>
    </Layout>
  )
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: THEMES.map((t) => ({ params: { key: t.key } })),
  fallback: false,
})

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const theme = getThemeByKey(String(params.key))
  if (!theme) return { notFound: true }
  const recipes = await listThemedRecipes(theme, 100)
  return {
    props: { theme, posts: recipes.map(toListingEdge) },
    revalidate: 300,
  }
}
