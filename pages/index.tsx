import Head from 'next/head'
import { GetStaticProps } from 'next'
import Container from '../components/container'
import MoreStories from '../components/more-stories'
import Pagination from '../components/pagination'
import Layout from '../components/layout'
import SearchHero from '../components/home/search-hero'
import CategoryTiles from '../components/home/category-tiles'
import AboutBox from '../components/home/about-box'
import {
  listPublishedRecipes,
  listTopRatedRecipes,
  listRecipesByTagSlugs,
  getCategoryTiles,
  toListingEdge,
} from '../lib/queries'
import { MENU_EDGES } from '../lib/menu'
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  HOME_POSTS_PER_PAGE,
  SEASONAL_COLLECTION,
} from '../lib/constants'

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="text-2xl font-bold tracking-tight mb-1">{title}</h2>
      {subtitle && <p className="text-gray-500 mb-5">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </section>
  )
}

export default function Index({ latest, topRated, seasonal, tiles, totalPages }) {
  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`${SITE_TITLE} - ${SITE_DESCRIPTION}`}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/`} />
        {totalPages > 1 && <link rel="next" href={`${SITE_URL}/page/2/`} />}
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={SITE_TITLE} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
      </Head>
      <Container>
        <SearchHero />
        <CategoryTiles tiles={tiles} />

        {topRated.length > 0 && (
          <Section title="Hity czytelników ⭐" subtitle="Najlepiej oceniane przepisy wszech czasów">
            <MoreStories posts={topRated} />
          </Section>
        )}

        {seasonal.length > 0 && (
          <Section title={SEASONAL_COLLECTION.title} subtitle={SEASONAL_COLLECTION.description}>
            <MoreStories posts={seasonal} />
          </Section>
        )}

        <Section title="Najnowsze przepisy">
          <MoreStories posts={latest} />
          <Pagination basePath="/" page={1} totalPages={totalPages} />
        </Section>

        <AboutBox />
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const [all, topRated, seasonal, tiles] = await Promise.all([
    listPublishedRecipes(),
    listTopRatedRecipes(4),
    listRecipesByTagSlugs(SEASONAL_COLLECTION.tagSlugs, 4),
    getCategoryTiles(),
  ])

  return {
    props: {
      latest: all.slice(0, HOME_POSTS_PER_PAGE).map(toListingEdge),
      topRated: topRated.map(toListingEdge),
      seasonal: seasonal.map(toListingEdge),
      tiles: JSON.parse(JSON.stringify(tiles)),
      totalPages: Math.ceil(all.length / HOME_POSTS_PER_PAGE),
    },
    revalidate: 60,
  }
}
