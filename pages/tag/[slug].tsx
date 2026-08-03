import Head from 'next/head'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import MoreStories from '../../components/more-stories'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import { getTagBySlug, listRecipesByTagSlug, getAllTagsWithCounts, toListingEdge } from '../../lib/queries'
import { MENU_EDGES } from '../../lib/menu'
import { SITE_TITLE, SITE_URL } from '../../lib/constants'

// Tag archives existed (and were indexed) on the WordPress site — same
// URLs, same "tag - Dieta na luzie" title pattern; kept out of the sitemap
// exactly like the old site did.
export default function TagPage({ tag, posts }) {
  const canonical = `${SITE_URL}/tag/${tag.slug}/`

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`${tag.name.toLowerCase()} - ${SITE_TITLE}`}</title>
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`${tag.name.toLowerCase()} - ${SITE_TITLE}`} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content={SITE_TITLE} />
      </Head>
      <Container>
        <article>
          <PostTitle>#{tag.name}</PostTitle>
          {posts.length > 0 && <MoreStories posts={posts} />}
        </article>
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const tag = await getTagBySlug(params.slug as string)
  if (!tag) return { notFound: true, revalidate: 60 }

  const recipes = await listRecipesByTagSlug(tag.slug)
  if (recipes.length === 0) return { notFound: true, revalidate: 60 }

  return {
    props: {
      tag: JSON.parse(JSON.stringify(tag)),
      posts: recipes.map(toListingEdge),
    },
    revalidate: 60,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const tags = await getAllTagsWithCounts()
  return {
    paths: tags.filter((t) => t.count > 0).map((t) => ({ params: { slug: t.slug } })),
    fallback: 'blocking',
  }
}
