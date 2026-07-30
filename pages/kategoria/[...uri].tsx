import Head from 'next/head'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import MoreStories from '../../components/more-stories'
import Pagination from '../../components/pagination'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import { getPostsByCategorySlug, getMenu, getAllCategoriesWithUri } from '../../lib/api'
import { getYoastForCategory, pagedSeo } from '../../lib/seo'
import { SITE_URL, CATEGORY_POSTS_PER_PAGE as PER_PAGE } from '../../lib/constants'
import WpSeo from '../../components/wp-seo'

export default function CategoryPosts({ posts, category, page, totalPages, menu, seo, preview }) {
  const menuItems = menu?.menuItems?.edges
  const baseUrl = `${SITE_URL}${category?.uri}`

  return (
    <Layout menu={menuItems} preview={preview}>
      <Container>
        <WpSeo
          seo={seo}
          fallbackTitle={`${category?.name} - Dieta na luzie`}
          fallbackPath={category?.uri}
        />
        <Head>
          {page > 1 && (
            <link rel="prev" href={page === 2 ? baseUrl : `${baseUrl}page/${page - 1}/`} />
          )}
          {page < totalPages && <link rel="next" href={`${baseUrl}page/${page + 1}/`} />}
        </Head>
        <article>
          <PostTitle>{category?.name}</PostTitle>
          {posts.length > 0 && <MoreStories posts={posts} />}
          <Pagination basePath={category?.uri} page={page} totalPages={totalPages} />
        </article>
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({
  params,
  preview = false,
}) => {
  let segments = Array.isArray(params.uri) ? [...params.uri] : [params.uri]

  // Trailing /page/N/ selects an archive page, e.g. /kategoria/przepisy/sniadania/page/2/
  let page = 1
  if (segments.length >= 2 && segments[segments.length - 2] === 'page') {
    page = parseInt(segments[segments.length - 1], 10)
    if (!Number.isInteger(page) || page < 2) {
      return { notFound: true, revalidate: 10 }
    }
    segments = segments.slice(0, -2)
  }

  // Category slug is the last path segment; the full uri check below
  // rejects made-up parent paths so each category has exactly one URL.
  const slug = segments[segments.length - 1]
  const data = await getPostsByCategorySlug(slug)
  const category = data?.categories?.edges?.[0]?.node

  if (!category || category.uri !== `/kategoria/${segments.join('/')}/`) {
    return { notFound: true, revalidate: 10 }
  }

  const allEdges = data.posts.edges
  const totalPages = Math.max(1, Math.ceil(allEdges.length / PER_PAGE))
  const posts = allEdges.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (page > 1 && posts.length === 0) {
    return { notFound: true, revalidate: 10 }
  }

  const [menu, seo] = await Promise.all([
    getMenu(),
    getYoastForCategory(slug),
  ])

  return {
    props: {
      preview,
      posts,
      category,
      page,
      totalPages,
      menu,
      seo: pagedSeo(seo, page, totalPages),
    },
    revalidate: 10,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const allCategories = await getAllCategoriesWithUri()

  return {
    paths: allCategories.edges.map(({ node }) => ({
      params: {
        uri: node.uri.replace(/^\/kategoria\//, '').split('/').filter(Boolean),
      },
    })),
    fallback: 'blocking',
  }
}
