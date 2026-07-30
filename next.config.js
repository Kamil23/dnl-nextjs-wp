if (!process.env.WORDPRESS_API_URL) {
  throw new Error(`
    Please provide a valid WordPress instance URL.
    Add to your environment variables WORDPRESS_API_URL.
  `)
}

const WP_ORIGIN = process.env.WORDPRESS_API_URL.replace(/\/graphql\/?$/, '')

/** @type {import('next').NextConfig} */
module.exports = {
  // WordPress permalinks end with a slash — keep identical URLs after migration
  trailingSlash: true,
  async rewrites() {
    // Media URLs must survive the migration (Google Images traffic) — proxy
    // them to wherever WordPress lives (WORDPRESS_API_URL host)
    return [
      {
        source: '/wp-content/uploads/:path*',
        destination: `${WP_ORIGIN}/wp-content/uploads/:path*`,
      },
    ]
  },
  images: {
    domains: [
      process.env.WORDPRESS_API_URL.match(/(?!(w+)\.)\w*(?:\w+\.)+\w+/)[0], // Valid WP Image domain.
      '0.gravatar.com',
      '1.gravatar.com',
      '2.gravatar.com',
      'secure.gravatar.com',
    ],
  },
}
