import Head from 'next/head'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import InfiniteRecipes from '../../components/infinite-recipes'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import {
  getCategoryByUri,
  getCategoriesWithCounts,
  listRecipesInCategoryTree,
  toListingEdge,
} from '../../lib/queries'
import { buildSeoForCategory, pagedSeo } from '../../lib/seo'
import { MENU_EDGES } from '../../lib/menu'
import { SITE_URL, CATEGORY_POSTS_PER_PAGE as PER_PAGE } from '../../lib/constants'
import WpSeo from '../../components/wp-seo'

export default function CategoryPosts({ posts, category, page, totalPages, seo }) {
  const baseUrl = `${SITE_URL}${category?.uri}`

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Container>
        <WpSeo seo={seo} />
        <Head>
          {page > 1 && (
            <link rel="prev" href={page === 2 ? baseUrl : `${baseUrl}page/${page - 1}/`} />
          )}
          {page < totalPages && <link rel="next" href={`${baseUrl}page/${page + 1}/`} />}
        </Head>
        <article>
          <PostTitle>{category?.name}</PostTitle>
          <InfiniteRecipes
            key={`${category?.uri}-${page}`}
            initialPosts={posts}
            startPage={page}
            totalPages={totalPages}
            basePath={category?.uri}
            categoryUri={category?.uri}
          />
        </article>
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  let segments = Array.isArray(params.uri) ? [...params.uri] : [params.uri]

  // Trailing /page/N/ selects an archive page, e.g. /kategoria/przepisy/sniadania/page/2/
  let page = 1
  if (segments.length >= 2 && segments[segments.length - 2] === 'page') {
    page = parseInt(segments[segments.length - 1], 10)
    if (!Number.isInteger(page) || page < 2) {
      return { notFound: true, revalidate: 60 }
    }
    segments = segments.slice(0, -2)
  }

  const uri = `/kategoria/${segments.join('/')}/`
  const category = await getCategoryByUri(uri)
  if (!category) {
    return { notFound: true, revalidate: 60 }
  }

  const allRecipes = await listRecipesInCategoryTree(category.id)
  if (allRecipes.length === 0) {
    return { notFound: true, revalidate: 60 }
  }

  const totalPages = Math.max(1, Math.ceil(allRecipes.length / PER_PAGE))
  const pageRecipes = allRecipes.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  if (page > 1 && pageRecipes.length === 0) {
    return { notFound: true, revalidate: 60 }
  }

  return {
    props: {
      posts: pageRecipes.map(toListingEdge),
      category: JSON.parse(JSON.stringify(category)),
      page,
      totalPages,
      seo: JSON.parse(
        JSON.stringify(pagedSeo(buildSeoForCategory(category), page, totalPages))
      ),
    },
    revalidate: 60,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const allCategories = await getCategoriesWithCounts()

  return {
    paths: allCategories
      .filter((c) => c.count > 0)
      .map((c) => ({
        params: {
          uri: c.uri.replace(/^\/kategoria\//, '').split('/').filter(Boolean),
        },
      })),
    fallback: 'blocking',
  }
}
