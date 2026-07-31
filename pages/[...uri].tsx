import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../components/container'
import PostBody from '../components/post-body'
import MoreStories from '../components/more-stories'
import PostHeader from '../components/post-header'
import PostTitle from '../components/post-title'
import SectionSeparator from '../components/section-separator'
import Layout from '../components/layout'
import Tags from '../components/tags'
import {
  getRecipeByUri,
  getPageByUri,
  getAllRecipeUris,
  getAllPageUris,
  listPublishedRecipes,
  toLegacyPost,
  toListingEdge,
} from '../lib/queries'
import { buildSeoForRecipe, buildSeoForPage } from '../lib/seo'
import { MENU_EDGES } from '../lib/menu'
import { SITE_URL } from '../lib/constants'
import ShareBtns from '../components/share-btns'
import Breadcrumbs from '../components/breadcrumbs'
import RecipeSchema from '../components/recipe-schema'
import WpSeo from '../components/wp-seo'

// Recipes and static pages live at their original WordPress permalinks —
// the URL set is the SEO contract with Google and never changes.
export default function Content({ kind, recipe, post, page, morePosts, seo }) {
  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Container>
        <WpSeo seo={seo} />
        {kind === 'recipe' ? (
          <>
            <article>
              <RecipeSchema recipe={recipe} />
              <Breadcrumbs categories={post.categories.edges} title={post.title} />
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
          </>
        ) : (
          <article>
            <PostTitle>{page.title}</PostTitle>
            <PostBody content={page.contentHtml} />
          </article>
        )}
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const segments = Array.isArray(params.uri) ? params.uri : [params.uri]
  const uri = `/${segments.join('/')}/`

  const recipe = await getRecipeByUri(uri)
  if (recipe) {
    const all = await listPublishedRecipes()
    const morePosts = all
      .filter((r) => r.uri !== recipe.uri)
      .slice(0, 4)
      .map(toListingEdge)

    return {
      props: {
        kind: 'recipe',
        recipe: JSON.parse(JSON.stringify(recipe)),
        post: JSON.parse(JSON.stringify(toLegacyPost(recipe, SITE_URL))),
        morePosts,
        seo: JSON.parse(JSON.stringify(buildSeoForRecipe(recipe))),
      },
      revalidate: 60,
    }
  }

  const page = await getPageByUri(uri)
  if (page) {
    return {
      props: {
        kind: 'page',
        page: JSON.parse(JSON.stringify(page)),
        morePosts: [],
        seo: JSON.parse(JSON.stringify(buildSeoForPage(page))),
      },
      revalidate: 60,
    }
  }

  return { notFound: true, revalidate: 60 }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const [recipeUris, pageUris] = await Promise.all([
    getAllRecipeUris(),
    getAllPageUris(),
  ])

  return {
    paths: [...recipeUris, ...pageUris].map(({ uri }) => ({
      params: { uri: uri.split('/').filter(Boolean) },
    })),
    fallback: 'blocking',
  }
}
