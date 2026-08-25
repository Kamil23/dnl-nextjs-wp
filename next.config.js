// WordPress is fully retired: the app serves all pages from Postgres and the
// legacy /wp-content/uploads/* media is self-hosted (served by Caddy in prod,
// or fetched directly from the live domain in local dev). WORDPRESS_API_URL is
// no longer needed at runtime - only scripts/import-wp.ts uses it for one-off
// imports.

// The public origin the app is served from. Legacy images are stored as
// absolute URLs on this host (https://dietanaluzie.pl/wp-content/uploads/...),
// so next/image must allow it.
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://dietanaluzie.pl'
const APP_HOST = new URL(APP_ORIGIN).host

/** @type {import('next').NextConfig} */
module.exports = {
  // Lean, self-contained server output for the Docker/VPS deployment.
  output: 'standalone',
  // WordPress permalinks end with a slash - keep identical URLs after migration
  trailingSlash: true,
  async redirects() {
    // The WooCommerce shop is gone and won't return - permanent redirects
    // so any indexed/linked shop URLs pass their signals to the homepage
    return ['/sklep', '/koszyk', '/moje-konto', '/zamowienie', '/strona-glowna'].map(
      (path) => ({
        source: `${path}/:path*`,
        destination: '/',
        permanent: true,
      })
    )
  },
  images: {
    // Legacy hero/tile images are absolute on the app host; gravatars kept for
    // author avatars. No WordPress host anymore - /wp-content/uploads is served
    // locally (Caddy file_server in prod).
    domains: [
      APP_HOST,
      '0.gravatar.com',
      '1.gravatar.com',
      '2.gravatar.com',
      'secure.gravatar.com',
    ],
  },
}
