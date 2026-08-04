if (!process.env.WORDPRESS_API_URL) {
  throw new Error(`
    Please provide a valid WordPress instance URL.
    Add to your environment variables WORDPRESS_API_URL.
  `)
}

const WP_ORIGIN = process.env.WORDPRESS_API_URL.replace(/\/graphql\/?$/, '')
const WP_HOST = new URL(WP_ORIGIN).host

// The public origin the app is SERVED from in production (e.g.
// https://dietanaluzie.pl). Set APP_ORIGIN in the prod environment. It is used
// to (a) allow next/image to load the legacy absolute /wp-content image URLs
// that were imported pointing at this host, and (b) refuse to build a config
// whose media proxy would loop back onto the app itself.
const APP_ORIGIN = process.env.APP_ORIGIN || ''
const APP_HOST = APP_ORIGIN ? new URL(APP_ORIGIN).host : ''

// Cutover guard: if the media proxy target equals the app's own host, the
// /wp-content/uploads rewrite loops onto itself and every legacy image 404s.
// Only enforced when APP_ORIGIN is set (a real deployment) — local dev, where
// the app runs on localhost while WORDPRESS_API_URL is the live domain, is fine.
if (APP_HOST && APP_HOST === WP_HOST) {
  throw new Error(
    `Media proxy loop: WORDPRESS_API_URL host (${WP_HOST}) equals APP_ORIGIN host (${APP_HOST}). ` +
      `Move WordPress to a subdomain (e.g. wp.${APP_HOST}) and point WORDPRESS_API_URL there.`
  )
}

// Legacy recipe images are stored as absolute URLs on the app host, so the app
// host must be allowed too (not just the WP media origin) or next/image rejects them.
const imageHosts = Array.from(
  new Set(
    [
      WP_HOST,
      APP_HOST,
      '0.gravatar.com',
      '1.gravatar.com',
      '2.gravatar.com',
      'secure.gravatar.com',
    ].filter(Boolean)
  )
)

/** @type {import('next').NextConfig} */
module.exports = {
  // Lean, self-contained server output for the Docker/VPS deployment.
  output: 'standalone',
  // WordPress permalinks end with a slash — keep identical URLs after migration
  trailingSlash: true,
  async redirects() {
    // The WooCommerce shop is gone and won't return — permanent redirects
    // so any indexed/linked shop URLs pass their signals to the homepage
    return ['/sklep', '/koszyk', '/moje-konto', '/zamowienie', '/strona-glowna'].map(
      (path) => ({
        source: `${path}/:path*`,
        destination: '/',
        permanent: true,
      })
    )
  },
  async rewrites() {
    // Media URLs must survive the migration (Google Images traffic) — proxy
    // them to wherever WordPress lives (WP_ORIGIN, a subdomain in production)
    return [
      {
        source: '/wp-content/uploads/:path*',
        destination: `${WP_ORIGIN}/wp-content/uploads/:path*`,
      },
    ]
  },
  images: {
    domains: imageHosts,
  },
}
