import Head from 'next/head'
import { useState } from 'react'
import { GetStaticProps } from 'next'
import Container from '../components/container'
import MoreStories from '../components/more-stories'
import Pagination from '../components/pagination'
import Layout from '../components/layout'
import SearchHero from '../components/home/search-hero'
import CategoryTiles from '../components/home/category-tiles'
import AboutBox from '../components/home/about-box'
import SeasonalSection from '../components/home/seasonal-section'
import TikTokFeed from '../components/home/tiktok-feed'
import {
  listPublishedRecipes,
  listTopRatedRecipes,
  listThemedRecipes,
  listTikTokVideos,
  listTikTokHits,
  getCategoryTiles,
  toListingEdge,
} from '../lib/queries'
import { MENU_EDGES } from '../lib/menu'
import { getTopReadPaths } from '../lib/server/ga'
import { getSeasonalTheme } from '../lib/seasonal'
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  HOME_POSTS_PER_PAGE,
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

export default function Index({ latest, collection, tiles, totalPages, tiktokVideos, tiktokHits }) {
  // While the visitor types a query, the tile results own the page —
  // everything else steps aside so the choice is purely visual
  const [searchActive, setSearchActive] = useState(false)
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
        <SearchHero onActiveChange={setSearchActive} />

        {!searchActive && (
          <>
            <CategoryTiles tiles={tiles} />

            {collection.posts.length > 0 &&
              (collection.themeKey ? (
                <SeasonalSection
                  themeKey={collection.themeKey}
                  title={collection.title}
                  subtitle={collection.subtitle}
                  moreHref={`/sezon/${collection.themeKey}/`}
                >
                  <MoreStories posts={collection.posts} />
                </SeasonalSection>
              ) : (
                <Section title={collection.title} subtitle={collection.subtitle}>
                  <MoreStories posts={collection.posts} />
                </Section>
              ))}

            <Section title="Najnowsze przepisy">
              <MoreStories posts={latest} />
              <Pagination basePath="/" page={1} totalPages={totalPages} />
            </Section>

            <AboutBox />

            <TikTokFeed title="Hity z TikToka 🔥" videos={tiktokHits} showViews mode="modal" />

            <TikTokFeed title="Ostatnie z TikToka 🎬" videos={tiktokVideos} mode="recipe" />
          </>
        )}
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const theme = getSeasonalTheme()
  const [all, topRated, themed, tiles, tiktokVideos, tiktokHits, topRead] = await Promise.all([
    listPublishedRecipes(),
    listTopRatedRecipes(4),
    listThemedRecipes(theme, 4),
    getCategoryTiles(),
    listTikTokVideos(8),
    listTikTokHits(8),
    getTopReadPaths(30),
  ])

  // "Kalendarz smaków": the seasonal theme owns the section when it has a
  // full row of matches. Otherwise fall back to "Hity czytelników" —
  // most-read last 30 days (GA4), or all-time top-rated until GA has data.
  let collection
  if (themed.length >= 4) {
    collection = {
      themeKey: theme.key,
      title: theme.title,
      subtitle: theme.subtitle,
      posts: themed.map(toListingEdge),
    }
  } else {
    const byUri = new Map(all.map((r) => [r.uri, r]))
    const mostRead = (topRead ?? [])
      .map(({ path }) => byUri.get(path.replace(/\?.*$/, '')))
      .filter(Boolean)
      .slice(0, 4)
    const useGa = mostRead.length >= 3
    collection = {
      themeKey: null,
      title: 'Hity czytelników ⭐',
      subtitle: useGa
        ? 'Najczęściej czytane przepisy w ostatnim miesiącu'
        : 'Najlepiej oceniane przepisy wszech czasów',
      posts: (useGa ? mostRead : topRated).map(toListingEdge),
    }
  }

  return {
    props: {
      // Articles keep their place in the /page/N/ archive but don't belong
      // in the "Najnowsze przepisy" showcase
      latest: all
        .filter((r) => !r.uri.startsWith('/artykuly/'))
        .slice(0, HOME_POSTS_PER_PAGE)
        .map(toListingEdge),
      collection,
      tiles: JSON.parse(JSON.stringify(tiles)),
      totalPages: Math.ceil(all.length / HOME_POSTS_PER_PAGE),
      tiktokVideos,
      tiktokHits,
    },
    revalidate: 60,
  }
}
