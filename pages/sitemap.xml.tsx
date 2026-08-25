import { GetServerSideProps } from 'next'
import { getAllRecipeUris, getCategoriesWithCounts, getAllPageUris } from '../lib/queries'
import { THEMES } from '../lib/seasonal'
import { SITE_URL, EXCLUDED_PAGE_URIS } from '../lib/constants'
import { INGREDIENTS } from '../lib/measures'
import { CALCULATORS } from '../lib/calculators'

// Serves /sitemap.xml with the same URL set as the old WordPress sitemap
// (homepage + all recipes/articles at their permalinks + categories + pages).
export default function Sitemap() {
  return null
}

function urlEntry(loc: string, lastmod?: Date | string | null) {
  return `  <url>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}
  </url>`
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const [recipeUris, categories, pageUris] = await Promise.all([
    getAllRecipeUris(),
    getCategoriesWithCounts(),
    getAllPageUris(),
  ])

  const entries = [
    urlEntry(`${SITE_URL}/`),
    ...recipeUris.map(({ uri, updatedAt }) => urlEntry(`${SITE_URL}${uri}`, updatedAt)),
    ...categories
      .filter((c) => c.count > 0)
      .map((c) => urlEntry(`${SITE_URL}${c.uri}`)),
    ...pageUris
      .filter(({ uri }) => uri !== '/' && !EXCLUDED_PAGE_URIS.includes(uri))
      .map(({ uri }) => urlEntry(`${SITE_URL}${uri}`)),
    ...THEMES.map((t) => urlEntry(`${SITE_URL}/sezon/${t.key}/`)),
    // Konwerter miar: hub + statyczne landingi składników (programmatic SEO)
    urlEntry(`${SITE_URL}/konwerter/`),
    ...INGREDIENTS.map((i) => urlEntry(`${SITE_URL}/konwerter/${i.slug}/`)),
    // Kolekcje edytorskie (wysokie białko, GLP-1 friendly)
    urlEntry(`${SITE_URL}/kolekcje/wysokie-bialko/`),
    urlEntry(`${SITE_URL}/kolekcje/glp1/`),
    // Kalkulatory dietetyczne: hub + poszczególne narzędzia
    urlEntry(`${SITE_URL}/kalkulatory/`),
    ...CALCULATORS.map((c) => urlEntry(`${SITE_URL}/${c.slug}/`)),
    // Losownik obiadów
    urlEntry(`${SITE_URL}/co-na-obiad/`),
    // Encja autorki
    urlEntry(`${SITE_URL}/autor/roksana/`),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.write(xml)
  res.end()

  return { props: {} }
}
