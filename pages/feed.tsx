import { GetServerSideProps } from 'next'
import { getPostsForFeed } from '../lib/api'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../lib/constants'

// Serves /feed/ — same address as the WordPress RSS feed
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

function stripTags(html: string = '') {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const posts = await getPostsForFeed()

  const items = posts.edges
    .map(({ node }) => {
      const link = `${SITE_URL}${node.uri}`
      const categories = (node.categories?.edges || [])
        .map(({ node: c }) => `      <category>${cdata(c.name)}</category>`)
        .join('\n')
      return `    <item>
      <title>${escapeXml(stripTags(node.title))}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(node.date).toUTCString()}</pubDate>
      <dc:creator>${cdata(node.author?.node?.name || '')}</dc:creator>
${categories}
      <description>${cdata(stripTags(node.excerpt))}</description>
      <content:encoded>${cdata(node.content || '')}</content:encoded>
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
