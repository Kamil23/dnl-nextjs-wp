import { GetServerSideProps } from 'next'
import { getAllPostUris, getAllCategoriesWithUri, getAllPageUris } from '../lib/api'
import { SITE_URL, EXCLUDED_PAGE_URIS } from '../lib/constants'

// Serves /sitemap.xml with the same URL set as the live WordPress sitemap
// (homepage + all posts at their permalinks + category archives).
export default function Sitemap() {
  return null
}

function urlEntry(loc: string, lastmod?: string) {
  return `  <url>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}
  </url>`
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const [posts, categories, pages] = await Promise.all([
    getAllPostUris(),
    getAllCategoriesWithUri(),
    getAllPageUris(),
  ])

  const entries = [
    urlEntry(`${SITE_URL}/`),
    ...posts.edges.map(({ node }) => urlEntry(`${SITE_URL}${node.uri}`, node.modified)),
    ...categories.edges
      .filter(({ node }) => node.count > 0)
      .map(({ node }) => urlEntry(`${SITE_URL}${node.uri}`)),
    ...pages.edges
      .filter(({ node }) => node.uri !== '/' && !EXCLUDED_PAGE_URIS.includes(node.uri))
      .map(({ node }) => urlEntry(`${SITE_URL}${node.uri}`)),
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
