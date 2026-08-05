import Head from 'next/head'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../components/container'
import InfiniteRecipes from '../components/infinite-recipes'
import PostBody from '../components/post-body'
import MoreStories from '../components/more-stories'
import PostHeader from '../components/post-header'
import PostTitle from '../components/post-title'
import SectionSeparator from '../components/section-separator'
import Layout from '../components/layout'
import Tags from '../components/tags'
import RecipeHero from '../components/recipe/recipe-hero'
import SearchHero from '../components/home/search-hero'
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
  listRecipeArchive,
  listPublishedRecipes,
  toLegacyPost,
  toListingEdge,
} from '../lib/queries'
import { buildSeoForRecipe, buildSeoForPage, pagedSeo } from '../lib/seo'
import { MENU_EDGES } from '../lib/menu'
import { SITE_URL, CATEGORY_POSTS_PER_PAGE } from '../lib/constants'
import ShareBtns from '../components/share-btns'
import Breadcrumbs from '../components/breadcrumbs'
import RecipeSchema from '../components/recipe-schema'
import NewsletterSignup from '../components/newsletter-signup'
import WpSeo from '../components/wp-seo'

// Sweet-category slugs pick the "fit słodycze" magnet; everything else gets
// the quick-meals one (matches the intent of the organic top pages)
const SWEET_CATEGORY_SLUGS = new Set(['fit-ciasta', 'fit-slodycze', 'slodycze-domowe', 'wypieki'])

// Recipes and static pages live at their original WordPress permalinks —
// the URL set is the SEO contract with Google and never changes.
export default function Content({
  kind,
  recipe,
  post,
  page,
  morePosts,
  introHtml,
  seo,
  listingTitle,
  pageNum,
  totalPages,
}) {
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
                  <div className="mt-6">
                    <NewsletterSignup
                      source={
                        recipe.categories.some((c) => SWEET_CATEGORY_SLUGS.has(c.slug))
                          ? 'recipe-slodkie'
                          : 'recipe-slone'
                      }
                    />
                  </div>
                </div>
                <div>
                  <StepsList steps={recipe.steps} />
                  <MacroTable recipe={recipe} />
                  {recipe.videoUrl && (
                    <div id="wideo" className="scroll-mt-6">
                      <TikTokEmbed url={recipe.videoUrl} title={recipe.title} poster={recipe.heroImage} />
                    </div>
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
              <SearchHero compact />
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
            <SearchHero compact />
            {morePosts.length > 0 && <MoreStories posts={morePosts} />}
          </>
        ) : kind === 'listing' ? (
          <article>
            <Head>
              {pageNum > 1 && (
                <link
                  rel="prev"
                  href={
                    pageNum === 2
                      ? `${SITE_URL}/przepisy/`
                      : `${SITE_URL}/przepisy/page/${pageNum - 1}/`
                  }
                />
              )}
              {pageNum < totalPages && (
                <link rel="next" href={`${SITE_URL}/przepisy/page/${pageNum + 1}/`} />
              )}
            </Head>
            <PostTitle>{listingTitle}</PostTitle>
            <InfiniteRecipes
              key={pageNum}
              initialPosts={morePosts}
              startPage={pageNum}
              totalPages={totalPages}
              basePath="/przepisy/"
            />
          </article>
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

  // /przepisy/ is the recipe archive (a WP query-loop page on the old site,
  // canonical → /kategoria/przepisy/) — render it as the standard tile
  // listing instead of the raw block HTML. /przepisy/<slug>/ stays a recipe.
  const isRecipeArchive =
    segments[0] === 'przepisy' &&
    (segments.length === 1 || (segments.length === 3 && segments[1] === 'page'))

  if (isRecipeArchive) {
    let pageNum = 1
    if (segments.length === 3) {
      pageNum = parseInt(segments[2], 10)
      if (!Number.isInteger(pageNum) || pageNum < 2) {
        return { notFound: true, revalidate: 60 }
      }
    }

    const allRecipes = await listRecipeArchive()

    const totalPages = Math.max(1, Math.ceil(allRecipes.length / CATEGORY_POSTS_PER_PAGE))
    const pageRecipes = allRecipes.slice(
      (pageNum - 1) * CATEGORY_POSTS_PER_PAGE,
      pageNum * CATEGORY_POSTS_PER_PAGE
    )
    if (pageNum > 1 && pageRecipes.length === 0) {
      return { notFound: true, revalidate: 60 }
    }

    const wpPage = await getPageByUri('/przepisy/')
    const seo = buildSeoForPage(wpPage ?? { title: 'Przepisy', uri: '/przepisy/' })

    return {
      props: {
        kind: 'listing',
        listingTitle: wpPage?.title ?? 'Przepisy',
        morePosts: pageRecipes.map(toListingEdge),
        pageNum,
        totalPages,
        seo: JSON.parse(JSON.stringify(pagedSeo(seo, pageNum, totalPages))),
      },
      revalidate: 60,
    }
  }

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
