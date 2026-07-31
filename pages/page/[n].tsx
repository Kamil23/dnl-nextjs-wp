import Head from 'next/head'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import MoreStories from '../../components/more-stories'
import Pagination from '../../components/pagination'
import Layout from '../../components/layout'
import { listPublishedRecipes, toListingEdge } from '../../lib/queries'
import { MENU_EDGES } from '../../lib/menu'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, HOME_POSTS_PER_PAGE } from '../../lib/constants'

// Paginated homepage archive: /page/2/ ... /page/N/ — same URLs as WordPress
export default function HomePage({ posts, page, totalPages }) {
  const title = `${SITE_TITLE} - Strona ${page} z ${totalPages} - ${SITE_DESCRIPTION}`
  const canonical = `${SITE_URL}/page/${page}/`

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={canonical} />
        <link rel="prev" href={page === 2 ? `${SITE_URL}/` : `${SITE_URL}/page/${page - 1}/`} />
        {page < totalPages && <link rel="next" href={`${SITE_URL}/page/${page + 1}/`} />}
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content={SITE_TITLE} />
      </Head>
      <Container>
        {posts.length > 0 && <MoreStories posts={posts} />}
        <Pagination basePath="/" page={page} totalPages={totalPages} />
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const page = parseInt(params.n as string, 10)
  if (!Number.isInteger(page) || page < 2) {
    return { notFound: true, revalidate: 60 }
  }

  const all = await listPublishedRecipes()
  const totalPages = Math.ceil(all.length / HOME_POSTS_PER_PAGE)
  const posts = all
    .slice((page - 1) * HOME_POSTS_PER_PAGE, page * HOME_POSTS_PER_PAGE)
    .map(toListingEdge)

  if (posts.length === 0) {
    return { notFound: true, revalidate: 60 }
  }

  return {
    props: { posts, page, totalPages },
    revalidate: 60,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const all = await listPublishedRecipes()
  const totalPages = Math.ceil(all.length / HOME_POSTS_PER_PAGE)
  const paths = []
  for (let n = 2; n <= totalPages; n++) {
    paths.push({ params: { n: String(n) } })
  }

  return { paths, fallback: 'blocking' }
}
