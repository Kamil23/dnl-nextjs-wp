import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../components/container'
import PostBody from '../components/post-body'
import MoreStories from '../components/more-stories'
import PostHeader from '../components/post-header'
import PostTitle from '../components/post-title'
import SectionSeparator from '../components/section-separator'
import Layout from '../components/layout'
import Tags from '../components/tags'
import RecipeHero from '../components/recipe/recipe-hero'
import IngredientsCard from '../components/recipe/ingredients-card'
import StepsList from '../components/recipe/steps-list'
import MacroTable from '../components/recipe/macro-table'
import TikTokEmbed from '../components/recipe/tiktok-embed'
import ShareCard from '../components/recipe/share-card'
import RatingWidget from '../components/recipe/rating-widget'
import SponsorCard from '../components/recipe/sponsor-card'
import { stripRecipeBlocks } from '../lib/recipe-parser'
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
export default function Content({ kind, recipe, post, page, morePosts, introHtml, seo }) {
  // Articles always use the article template, whatever data they carry
  const isArticle = kind === 'recipe' && recipe.uri.startsWith('/artykuly/')
  const structured =
    kind === 'recipe' &&
    !isArticle &&
    (recipe.ingredientGroups.some((g) => g.items.length > 0) || recipe.steps.length > 0)

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Container>
        <WpSeo seo={seo} />
        {kind === 'recipe' && structured ? (
          <>
            <article>
              <RecipeSchema recipe={recipe} />
              <div className="print:hidden">
                <Breadcrumbs categories={post.categories.edges} title={post.title} />
              </div>
              <div className="mt-6">
                <RecipeHero recipe={recipe} />
              </div>

              <section
                id="przepis"
                className="grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-8 items-start scroll-mt-6 mb-4"
              >
                <div className="lg:sticky lg:top-6">
                  <IngredientsCard recipe={recipe} />
                  <SponsorCard sponsor={recipe.sponsor} />
                </div>
                <div>
                  <StepsList steps={recipe.steps} />
                  <MacroTable recipe={recipe} />
                  {recipe.videoUrl && (
                    <TikTokEmbed url={recipe.videoUrl} title={recipe.title} poster={recipe.heroImage} />
                  )}
                  <RatingWidget recipeId={recipe.id} rating={recipe.rating} />
                  <ShareCard url={post.link} mediaUrl={post.featuredImage?.node.sourceUrl} title={post.title} />
                </div>
              </section>

              {introHtml && (
                <div className="print:hidden mt-12">
                  <h2 className="text-xl font-bold tracking-tight mb-4 max-w-2xl mx-auto">
                    Kilka słów o tym przepisie
                  </h2>
                  <PostBody content={introHtml} />
                </div>
              )}

              <div className="print:hidden">
                <footer>
                  {post.tags.edges.length > 0 && <Tags tags={post.tags} />}
                </footer>
              </div>
            </article>

            <div className="print:hidden">
              <SectionSeparator />
              {morePosts.length > 0 && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight mb-6">Zobacz też</h2>
                  <MoreStories posts={morePosts} />
                </>
              )}
            </div>
          </>
        ) : kind === 'recipe' ? (
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
        introHtml: recipe.contentHtml ? stripRecipeBlocks(recipe.contentHtml) : null,
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
