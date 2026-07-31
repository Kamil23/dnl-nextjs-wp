import Head from 'next/head'
import { GetStaticProps } from 'next'
import Container from '../components/container'
import MoreStories from '../components/more-stories'
import Pagination from '../components/pagination'
import Layout from '../components/layout'
import { listPublishedRecipes, toListingEdge } from '../lib/queries'
import { MENU_EDGES } from '../lib/menu'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, HOME_POSTS_PER_PAGE } from '../lib/constants'

export default function Index({ posts, totalPages }) {
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
        {posts.length > 0 && <MoreStories posts={posts} />}
        <Pagination basePath="/" page={1} totalPages={totalPages} />
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const all = await listPublishedRecipes()

  return {
    props: {
      posts: all.slice(0, HOME_POSTS_PER_PAGE).map(toListingEdge),
      totalPages: Math.ceil(all.length / HOME_POSTS_PER_PAGE),
    },
    revalidate: 60,
  }
}
