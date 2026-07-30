import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import MoreStories from '../../components/more-stories'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import { getPostsByCategorySlug, getMenu, getAllCategoriesWithUri } from '../../lib/api'
import { getYoastForCategory } from '../../lib/seo'
import WpSeo from '../../components/wp-seo'

export default function CategoryPosts({ posts, category, menu, seo, preview }) {
  const morePosts = posts?.edges ?? []
  const menuItems = menu?.menuItems?.edges

  return (
    <Layout menu={menuItems} preview={preview}>
      <Container>
        <WpSeo
          seo={seo}
          fallbackTitle={`${category?.name} - Dieta na luzie`}
          fallbackPath={category?.uri}
        />
        <article>
          <PostTitle>{category?.name}</PostTitle>
          {morePosts.length > 0 && <MoreStories posts={morePosts} />}
        </article>
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({
  params,
  preview = false,
}) => {
  const segments = Array.isArray(params.uri) ? params.uri : [params.uri]
  // Category slug is the last path segment; the full uri check below
  // rejects made-up parent paths so each category has exactly one URL.
  const slug = segments[segments.length - 1]
  const data = await getPostsByCategorySlug(slug)
  const category = data?.categories?.edges?.[0]?.node

  if (!category || category.uri !== `/kategoria/${segments.join('/')}/`) {
    return { notFound: true, revalidate: 10 }
  }

  const [menu, seo] = await Promise.all([
    getMenu(),
    getYoastForCategory(slug),
  ])

  return {
    props: {
      preview,
      posts: data.posts,
      category,
      menu,
      seo,
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
