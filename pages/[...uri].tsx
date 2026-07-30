import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../components/container'
import PostBody from '../components/post-body'
import MoreStories from '../components/more-stories'
import PostHeader from '../components/post-header'
import SectionSeparator from '../components/section-separator'
import Layout from '../components/layout'
import Tags from '../components/tags'
import { getAllPostUris, getMenu, getPostByUri } from '../lib/api'
import { getYoastForPost } from '../lib/seo'
import ShareBtns from '../components/share-btns'
import Breadcrumbs from '../components/breadcrumbs'
import RecipeSchema from '../components/recipe-schema'
import WpSeo from '../components/wp-seo'

// Posts live at their WordPress permalinks (/%category%/%postname%/), e.g.
// /przepisy/owsianka-kokosowa-z-mango/ or /przepisy/sniadania/nalesniki-owsiane/.
// Keeping these URLs identical to the live site is required for the SEO migration.
export default function Post({ post, posts, menu, seo, preview }) {
  const morePosts = posts?.edges ?? []
  const menuItems = menu?.menuItems?.edges

  return (
    <Layout menu={menuItems} preview={preview}>
      <Container>
        <WpSeo
          seo={seo}
          fallbackTitle={`${post.title} - Dieta na luzie`}
          fallbackPath={post.uri}
          fallbackOgImage={post.featuredImage?.node.sourceUrl}
        />
        <article>
          <RecipeSchema post={post} description={seo?.description} />
          <Breadcrumbs categories={post?.categories?.edges} title={post.title} />
          <PostHeader
            title={post.title}
            coverImage={post.featuredImage}
            date={post.date}
            author={post.author}
            categories={post.categories}
          />
          <PostBody content={post.content} />
          <footer>
            {post.tags.edges.length > 0 && <Tags tags={post.tags} />}
          </footer>
          <ShareBtns url={post.link} mediaUrl={post.featuredImage?.node.sourceUrl} title={post.title} />
        </article>

        <SectionSeparator />
        {morePosts.length > 0 && <MoreStories posts={morePosts} />}
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
  const data = await getPostByUri(uri)

  // WPGraphQL resolves URIs loosely (matches by slug), so require an exact
  // permalink match — otherwise every post would render under many paths.
  if (!data?.post || data.post.uri !== uri) {
    return { notFound: true, revalidate: 10 }
  }

  const [menu, seo] = await Promise.all([
    getMenu(),
    getYoastForPost(data.post.slug),
  ])

  return {
    props: {
      preview,
      post: data.post,
      posts: data.posts,
      menu,
      seo,
    },
    revalidate: 10,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const allPosts = await getAllPostUris()

  return {
    paths: allPosts.edges.map(({ node }) => ({
      params: { uri: node.uri.split('/').filter(Boolean) },
    })),
    fallback: 'blocking',
  }
}
