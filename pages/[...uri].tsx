import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../components/container'
import PostBody from '../components/post-body'
import MoreStories from '../components/more-stories'
import PostHeader from '../components/post-header'
import PostTitle from '../components/post-title'
import SectionSeparator from '../components/section-separator'
import Layout from '../components/layout'
import Tags from '../components/tags'
import { getAllPostUris, getAllPageUris, getMenu, getContentByUri } from '../lib/api'
import { getYoastForPost, getYoastForPage } from '../lib/seo'
import { EXCLUDED_PAGE_URIS } from '../lib/constants'
import ShareBtns from '../components/share-btns'
import Breadcrumbs from '../components/breadcrumbs'
import RecipeSchema from '../components/recipe-schema'
import WpSeo from '../components/wp-seo'

// Posts and static pages live at their WordPress permalinks, e.g.
// /przepisy/owsianka-kokosowa-z-mango/ or /polityka-prywatnosci/.
// Keeping these URLs identical to the live site is required for the SEO migration.
export default function Content({ node, posts, menu, seo, preview }) {
  const morePosts = posts?.edges ?? []
  const menuItems = menu?.menuItems?.edges
  const isPost = node.__typename === 'Post'

  return (
    <Layout menu={menuItems} preview={preview}>
      <Container>
        <WpSeo
          seo={seo}
          fallbackTitle={`${node.title} - Dieta na luzie`}
          fallbackPath={node.uri}
          fallbackOgImage={node.featuredImage?.node.sourceUrl}
        />
        {isPost ? (
          <>
            <article>
              <RecipeSchema post={node} description={seo?.description} />
              <Breadcrumbs categories={node?.categories?.edges} title={node.title} />
              <PostHeader
                title={node.title}
                coverImage={node.featuredImage}
                date={node.date}
                author={node.author}
                categories={node.categories}
              />
              <PostBody content={node.content} />
              <footer>
                {node.tags.edges.length > 0 && <Tags tags={node.tags} />}
              </footer>
              <ShareBtns url={node.link} mediaUrl={node.featuredImage?.node.sourceUrl} title={node.title} />
            </article>

            <SectionSeparator />
            {morePosts.length > 0 && <MoreStories posts={morePosts} />}
          </>
        ) : (
          <article>
            <PostTitle>{node.title}</PostTitle>
            <PostBody content={node.content} />
          </article>
        )}
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({
  params,
  preview = false,
}) => {
  const segments = Array.isArray(params.uri) ? params.uri : [params.uri]
  const uri = `/${segments.join('/')}/`
  const { node, posts } = await getContentByUri(uri)

  // WPGraphQL can resolve URIs loosely, so require an exact permalink match —
  // otherwise content would render under many paths (duplicate content).
  if (!node || node.uri !== uri) {
    return { notFound: true, revalidate: 10 }
  }

  // WooCommerce app pages (cart, checkout, account) need a session and
  // can't work headlessly — keep them 404 until the shop scope is decided
  if (node.__typename === 'Page' && EXCLUDED_PAGE_URIS.includes(node.uri)) {
    return { notFound: true, revalidate: 10 }
  }

  const [menu, seo] = await Promise.all([
    getMenu(),
    node.__typename === 'Post'
      ? getYoastForPost(node.slug)
      : getYoastForPage(node.slug),
  ])

  return {
    props: {
      preview,
      node,
      posts: node.__typename === 'Post' ? posts : null,
      menu,
      seo,
    },
    revalidate: 10,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const [allPosts, allPages] = await Promise.all([
    getAllPostUris(),
    getAllPageUris(),
  ])

  const uris = [
    ...allPosts.edges.map(({ node }) => node.uri),
    ...allPages.edges.map(({ node }) => node.uri),
  ].filter((uri) => uri && uri !== '/')

  return {
    paths: uris.map((uri) => ({
      params: { uri: uri.split('/').filter(Boolean) },
    })),
    fallback: 'blocking',
  }
}
