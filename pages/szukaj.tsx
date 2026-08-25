import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import Container from '../components/container'
import MoreStories from '../components/more-stories'
import Layout from '../components/layout'
import {
  searchEnabled,
  searchMeiliFull,
  availableDietKeys,
  KCAL_BUCKETS,
  TIME_BUCKETS,
  HIGH_PROTEIN_MIN,
  type FacetCounts,
} from '../lib/search'
import { logSearch } from '../lib/server/search-log'
import { DIET_FACETS } from '../lib/diets'
import { MENU_EDGES } from '../lib/menu'
import { SITE_TITLE } from '../lib/constants'

// A recipe "card" — the minimal shape both the Meili hit and the Postgres row
// map to, so results render the same whichever path produced them.
type Card = {
  title: string
  uri: string
  heroImage: string | null
  lead: string | null
  protein?: number | null
}

function cardToEdge(c: Card) {
  return {
    node: {
      title: c.title,
      excerpt: c.lead ? `<p>${c.lead}</p>` : '',
      uri: c.uri,
      slug: c.uri,
      date: null,
      featuredImage: c.heroImage ? { node: { sourceUrl: c.heroImage } } : null,
      author: { node: { name: 'Roksana', firstName: null, lastName: null, avatar: { url: '' } } },
      protein: c.protein != null ? Math.round(Number(c.protein)) : null,
    },
  }
}

// A visible, clickable filter pill — surfaces every search capability up front
// (so users don't have to guess they can type "do 500 kcal") and shows a live
// count of how many recipes match, updated as they search.
function Chip({
  active,
  disabled,
  count,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  count?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm border transition ${
        active
          ? 'bg-amber-500 border-amber-500 text-white'
          : disabled
            ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
            : 'bg-white border-gray-200 text-gray-700 hover:border-amber-400'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className={active ? 'opacity-80' : 'text-gray-400'}> {count}</span>
      )}
    </button>
  )
}

function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-gray-400 w-full sm:w-24 sm:shrink-0">{label}</span>
      {children}
    </div>
  )
}

// Search results are intentionally noindex — endless parameter combinations
// would only dilute the crawl budget.
export default function Search({ initialCards, initialCounts, initialTotal, dietOptions, params, searchOk }) {
  const router = useRouter()

  const [q, setQ] = useState(params.q ?? '')
  const [filters, setFilters] = useState({
    kategoria: params.kategoria ?? '',
    dieta: params.dieta ?? '',
    kcal: params.kcal ?? '',
    czas: params.czas ?? '',
    bialko: params.bialko ?? '',
    sort: params.sort ?? '',
  })
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [counts, setCounts] = useState<FacetCounts | null>(initialCounts)
  const [total, setTotal] = useState<number>(initialTotal)
  const [loading, setLoading] = useState(false)

  // Skip the first effect run — the server already delivered matching results.
  const hydrated = useRef(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  function run(nextQ: string, nextFilters: typeof filters) {
    // Meilisearch-only: every query and filter change goes through the Meili
    // proxy — no Postgres path.
    const usp = new URLSearchParams({ facets: '1' })
    if (nextQ) usp.set('q', nextQ)
    Object.entries(nextFilters).forEach(([k, v]) => v && usp.set(k, v))
    setLoading(true)
    fetch(`/api/szukaj/?${usp.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setCards(data.hits ?? [])
        setCounts(data.counts ?? null)
        setTotal(data.total ?? (data.hits?.length ?? 0))
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Keep the URL shareable/back-navigable without re-running SSR.
    const urlQuery: Record<string, string> = { q: nextQ, ...nextFilters }
    Object.keys(urlQuery).forEach((k) => !urlQuery[k] && delete urlQuery[k])
    router.replace({ pathname: '/szukaj/', query: urlQuery }, undefined, { shallow: true })
  }

  // Debounced text query
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => run(q, filters), 220)
    return () => clearTimeout(debounce.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function setFilter(patch: Partial<typeof filters>) {
    const next = { ...filters, ...patch }
    setFilters(next)
    run(q, next) // filters apply immediately
  }

  // Clicking an active pill again clears that filter (single-select per group).
  function toggle(key: keyof typeof filters, value: string) {
    setFilter({ [key]: filters[key] === value ? '' : value })
  }

  const anyFilter = Boolean(
    filters.kategoria || filters.dieta || filters.kcal || filters.czas || filters.bialko || filters.sort
  )

  function clearAll() {
    const cleared = { kategoria: '', dieta: '', kcal: '', czas: '', bialko: '', sort: '' }
    setFilters(cleared)
    run(q, cleared)
  }

  const selectCls =
    'border border-gray-300 rounded-full px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400'

  const posts = cards.map(cardToEdge)

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Szukaj${q ? `: ${q}` : ''} - ${SITE_TITLE}`}</title>
        <meta name="robots" content="noindex, follow" />
      </Head>
      <Container>
        <h1 className="text-3xl font-bold tracking-tighter mb-6">Szukaj przepisu</h1>

        <div className="mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Wpisz nazwę lub składnik, np. cukinia, twaróg…"
            className="w-full sm:w-[28rem] border border-gray-300 rounded-full px-5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {!q && (
          <div className="flex flex-wrap items-center gap-2 mb-5 text-sm">
            <span className="text-gray-400">Na przykład:</span>
            {['owsianka', 'kurczak', 'sernik', 'cukinia', 'twaróg'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQ(s)}
                className="rounded-full bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 hover:border-amber-300 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Każda możliwość wyszukiwarki widoczna wprost, z licznikiem na żywo */}
        <p className="text-sm text-gray-500 mb-3">Albo zawęź jednym kliknięciem:</p>
        <div className="space-y-2.5 mb-6">
          <FacetRow label="Kalorie">
            {KCAL_BUCKETS.map((b) => (
              <Chip
                key={b}
                active={filters.kcal === String(b)}
                count={counts?.kcal?.[b]}
                disabled={!!counts && counts.kcal?.[b] === 0 && filters.kcal !== String(b)}
                onClick={() => toggle('kcal', String(b))}
              >
                do {b} kcal
              </Chip>
            ))}
          </FacetRow>
          <FacetRow label="Czas">
            {TIME_BUCKETS.map((b) => (
              <Chip
                key={b}
                active={filters.czas === String(b)}
                count={counts?.time?.[b]}
                disabled={!!counts && counts.time?.[b] === 0 && filters.czas !== String(b)}
                onClick={() => toggle('czas', String(b))}
              >
                {b === 60 ? 'do godziny' : `do ${b} minut`}
              </Chip>
            ))}
          </FacetRow>
          <FacetRow label="Dieta">
            <Chip
              active={filters.bialko === '1'}
              count={counts?.protein}
              onClick={() => setFilter({ bialko: filters.bialko === '1' ? '' : '1' })}
            >
              Wysokobiałkowe ≥{HIGH_PROTEIN_MIN}g
            </Chip>
            {dietOptions.map((d) => (
              <Chip
                key={d.key}
                active={filters.dieta === d.key}
                count={counts?.diet?.[d.key]}
                onClick={() => toggle('dieta', d.key)}
              >
                {d.label}
              </Chip>
            ))}
          </FacetRow>
        </div>

        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <label className="text-sm text-gray-500 flex items-center gap-2">
            Sortuj:
            <select value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value })} className={selectCls}>
              <option value="">Najnowsze</option>
              <option value="oceny">Najlepiej oceniane</option>
              <option value="najszybsze">Najszybsze</option>
            </select>
          </label>
          {anyFilter && (
            <button type="button" onClick={clearAll} className="text-sm text-gray-500 hover:text-gray-900 underline">
              Wyczyść filtry
            </button>
          )}
        </div>

        {!searchOk && posts.length === 0 && !loading ? (
          <p className="text-gray-500 mb-24">
            Wyszukiwarka jest chwilowo niedostępna. Spróbuj odświeżyć stronę za moment.
          </p>
        ) : posts.length > 0 ? (
          <>
            <p className={`text-sm mb-4 ${loading ? 'text-gray-300' : 'text-gray-400'}`}>
              {loading ? 'Szukam…' : `Znaleziono: ${total}`}
            </p>
            <MoreStories posts={posts} />
          </>
        ) : (
          <p className="text-gray-500 mb-24">
            {loading ? 'Szukam…' : 'Nic nie znaleziono 😔 Spróbuj innej frazy albo wyczyść filtry.'}
          </p>
        )}
      </Container>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ query, req }) => {
  const params = {
    q: typeof query.q === 'string' ? query.q : '',
    kategoria: typeof query.kategoria === 'string' ? query.kategoria : '',
    dieta: typeof query.dieta === 'string' ? query.dieta : '',
    kcal: typeof query.kcal === 'string' ? query.kcal : '',
    bialko: typeof query.bialko === 'string' ? query.bialko : '',
    czas: typeof query.czas === 'string' ? query.czas : '',
    sort: typeof query.sort === 'string' ? query.sort : '',
  }

  // Meilisearch-only. No Postgres path: if Meili is unavailable the page renders
  // empty and flags it, rather than silently falling back to a weaker engine.
  let initialCards: Card[] = []
  let initialCounts: FacetCounts | null = null
  let initialTotal = 0
  let searchOk = false

  const selection = {
    categorySlug: params.kategoria || undefined,
    maxKcal: parseInt(params.kcal, 10) || undefined,
    maxTime: parseInt(params.czas, 10) || undefined,
    minProtein: params.bialko === '1' ? HIGH_PROTEIN_MIN : undefined,
    diet: params.dieta || undefined,
  }

  if (searchEnabled()) {
    try {
      const result = await searchMeiliFull(params.q, selection, params.sort || undefined)
      initialCards = result.hits.map((h) => ({ title: h.title, uri: h.uri, heroImage: h.heroImage, lead: h.lead, protein: h.protein }))
      initialCounts = result.counts
      initialTotal = result.total
      searchOk = true // an empty result set is still a valid answer
    } catch {
      // Meili errored — leave searchOk=false so the UI shows an unavailable note.
    }
  }

  await logSearch(params.q, initialTotal, 'szukaj', req)

  // Only offer diet filters that actually match something (recipes aren't
  // diet-tagged yet). null → show all once diets exist.
  const availableKeys = searchOk ? await availableDietKeys() : null
  const dietOptions = DIET_FACETS
    .filter((d) => availableKeys === null || availableKeys.includes(d.key))
    .map((d) => ({ key: d.key, label: d.label }))

  return {
    props: {
      initialCards,
      initialCounts,
      initialTotal,
      dietOptions,
      params,
      searchOk,
    },
  }
}
