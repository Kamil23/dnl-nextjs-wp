import styles from './post-body.module.css'
import { SOCIAL_INSTAGRAM_URL, SOCIAL_TIKTOK_URL } from '../lib/constants'

// WP-era content links to retired profiles (@dietanaluziepl, @roksanaptaszek) —
// rewritten at render time so the imported HTML never needs a DB migration
const LEGACY_INSTAGRAM_RE =
  /https?:\/\/(?:www\.)?instagram\.com\/(?:dietanaluziepl|roksanaptaszek)\/?/g
const LEGACY_TIKTOK_RE =
  /https?:\/\/(?:www\.)?tiktok\.com\/@(?:dietanaluziepl|roksanaptaszek)\/?/g

export function rewriteLegacyLinks(html: string): string {
  if (!html) return html
  return html
    .replace(LEGACY_INSTAGRAM_RE, SOCIAL_INSTAGRAM_URL)
    .replace(LEGACY_TIKTOK_RE, SOCIAL_TIKTOK_URL)
}

export default function PostBody({ content }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={styles.content}
        dangerouslySetInnerHTML={{ __html: rewriteLegacyLinks(content) }}
      />
    </div>
  )
}
