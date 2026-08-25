import { GetServerSideProps } from 'next'
import { getAllRecipeUris, getCategoriesWithCounts, getAllPageUris } from '../lib/queries'
import { SITE_URL, EXCLUDED_PAGE_URIS } from '../lib/constants'
import { staticSitemapPaths } from '../lib/site-routes'

// Serves /sitemap.xml dynamically (getServerSideProps) — regenerowana przy każdym
// żądaniu z żywej bazy. Treść z DB (przepisy/kategorie/strony) trafia tu sama;
// trasy plikowe (kalkulatory, konwerter, kolekcje, sezony, narzędzia) pochodzą
// z jednego rejestru lib/site-routes.ts, więc nowe pozycje pojawiają się
// automatycznie bez edycji tego pliku.
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
    // Trasy plikowe / narzędzia / kolekcje / sezony — z rejestru (auto)
    ...staticSitemapPaths().map((p) => urlEntry(`${SITE_URL}${p}`)),
    // Treść z bazy (auto): przepisy + daty modyfikacji
    ...recipeUris.map(({ uri, updatedAt }) => urlEntry(`${SITE_URL}${uri}`, updatedAt)),
    // Kategorie z zawartością
    ...categories
      .filter((c) => c.count > 0)
      .map((c) => urlEntry(`${SITE_URL}${c.uri}`)),
    // Strony redakcyjne z tabeli `pages` (np. /do-pobrania, polityka prywatności)
    ...pageUris
      .filter(({ uri }) => uri !== '/' && !EXCLUDED_PAGE_URIS.includes(uri))
      .map(({ uri }) => urlEntry(`${SITE_URL}${uri}`)),
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
