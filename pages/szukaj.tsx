import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import Container from '../components/container'
import MoreStories from '../components/more-stories'
import Layout from '../components/layout'
import { searchRecipes, getCategoriesWithCounts, toListingEdge } from '../lib/queries'
import { searchEnabled, searchMeili, type RecipeDoc } from '../lib/search'
import { MENU_EDGES } from '../lib/menu'
import { SITE_TITLE } from '../lib/constants'

// Search results are intentionally noindex — endless parameter combinations
// would only dilute the crawl budget.
export default function Search({ posts, cats, params }) {
  const router = useRouter()

  function update(patch: Record<string, string>) {
    const next = { ...router.query, ...patch }
    Object.keys(next).forEach((k) => !next[k] && delete next[k])
    router.push({ pathname: '/szukaj/', query: next })
  }

  const selectCls =
    'border border-gray-300 rounded-full px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400'

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Szukaj${params.q ? `: ${params.q}` : ''} - ${SITE_TITLE}`}</title>
        <meta name="robots" content="noindex, follow" />
      </Head>
      <Container>
        <h1 className="text-3xl font-bold tracking-tighter mb-6">
          {params.q ? `Wyniki dla: „${params.q}"` : 'Szukaj przepisu'}
        </h1>

        <div className="flex flex-wrap gap-3 mb-8 items-center">
          <input
            defaultValue={params.q ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') update({ q: (e.target as HTMLInputElement).value })
            }}
            placeholder="Szukaj..."
            className="border border-gray-300 rounded-full px-4 py-2 text-base sm:text-sm w-56 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <select value={params.kategoria ?? ''} onChange={(e) => update({ kategoria: e.target.value })} className={selectCls}>
            <option value="">Wszystkie kategorie</option>
            {cats.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <select value={params.czas ?? ''} onChange={(e) => update({ czas: e.target.value })} className={selectCls}>
            <option value="">Dowolny czas</option>
            <option value="20">do 20 minut</option>
            <option value="30">do 30 minut</option>
            <option value="60">do godziny</option>
          </select>
          <select value={params.sort ?? ''} onChange={(e) => update({ sort: e.target.value })} className={selectCls}>
            <option value="">Najnowsze</option>
            <option value="oceny">Najlepiej oceniane</option>
            <option value="najszybsze">Najszybsze</option>
          </select>
        </div>

        {posts.length > 0 ? (
          <>
            <p className="text-sm text-gray-400 mb-4">Znaleziono: {posts.length}</p>
            <MoreStories posts={posts} />
          </>
        ) : (
          <p className="text-gray-500 mb-24">
            Nic nie znaleziono 😔 Spróbuj innej frazy albo wyczyść filtry.
          </p>
        )}
      </Container>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const params = {
    q: typeof query.q === 'string' ? query.q : '',
    kategoria: typeof query.kategoria === 'string' ? query.kategoria : '',
    czas: typeof query.czas === 'string' ? query.czas : '',
    sort: typeof query.sort === 'string' ? query.sort : '',
  }

  const searchParams = {
    q: params.q,
    maxTime: parseInt(params.czas, 10) || undefined,
    categorySlug: params.kategoria || undefined,
    sort: (params.sort as any) || undefined,
  }

  // Meilisearch (tolerancja literówek, ranking) z fallbackiem do Postgresa
  let posts
  if (searchEnabled()) {
    try {
      const hits = await searchMeili(searchParams)
      posts = hits.map(docToEdge)
    } catch {
      posts = (await searchRecipes(searchParams)).map(toListingEdge)
    }
  } else {
    posts = (await searchRecipes(searchParams)).map(toListingEdge)
  }

  const cats = await getCategoriesWithCounts()

  return {
    props: {
      posts,
      cats: JSON.parse(JSON.stringify(cats.filter((c) => c.count > 0))),
      params,
    },
  }
}

function docToEdge(d: RecipeDoc) {
  return {
    node: {
      title: d.title,
      excerpt: d.lead ? `<p>${d.lead}</p>` : '',
      uri: d.uri,
      slug: d.uri,
      date: null,
      featuredImage: d.heroImage ? { node: { sourceUrl: d.heroImage } } : null,
      author: { node: { name: 'Roksana', firstName: null, lastName: null, avatar: { url: '' } } },
    },
  }
}
