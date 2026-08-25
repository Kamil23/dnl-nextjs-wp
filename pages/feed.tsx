import { GetServerSideProps } from 'next'
import { listFeedRecipes } from '../lib/queries'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../lib/constants'

// Serves /feed/ - same address as the old WordPress RSS feed
export default function Feed() {
  return null
}

function cdata(value: string = '') {
  return `<![CDATA[${value.replace(/\]\]>/g, ']]&gt;')}]]>`
}

function escapeXml(value: string = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const recipes = await listFeedRecipes(10)

  const items = recipes
    .map((r) => {
      const link = `${SITE_URL}${r.uri}`
      const categories = r.categoryNames
        .map((name) => `      <category>${cdata(name)}</category>`)
        .join('\n')
      return `    <item>
      <title>${escapeXml(r.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${(r.publishedAt ?? new Date()).toUTCString()}</pubDate>
      <dc:creator>${cdata(r.authorName || 'Roksana')}</dc:creator>
${categories}
      <description>${cdata(r.lead || '')}</description>
      <content:encoded>${cdata(r.contentHtml || '')}</content:encoded>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <atom:link href="${SITE_URL}/feed/" rel="self" type="application/rss+xml" />
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>pl-PL</language>
${items}
  </channel>
</rss>`

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.write(xml)
  res.end()

  return { props: {} }
}
