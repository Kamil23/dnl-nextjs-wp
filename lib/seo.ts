// Yoast SEO data fetched over the WP REST API (yoast_head_json).
// WPGraphQL does not expose Yoast fields without an extra plugin,
// but Yoast >= 14 attaches yoast_head_json to REST responses out of the box.

const WP_BASE = (process.env.WORDPRESS_API_URL || "").replace(/\/graphql\/?$/, "");

export type YoastHeadJson = {
  title?: string;
  description?: string;
  robots?: Record<string, string>;
  canonical?: string;
  og_locale?: string;
  og_type?: string;
  og_title?: string;
  og_description?: string;
  og_url?: string;
  og_site_name?: string;
  article_published_time?: string;
  article_modified_time?: string;
  og_image?: { url: string; width?: number; height?: number; type?: string }[];
  author?: string;
  twitter_card?: string;
  schema?: Record<string, any>;
};

async function fetchYoastHead(url: string): Promise<YoastHeadJson | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const items = await res.json();
    return items?.[0]?.yoast_head_json ?? null;
  } catch (e) {
    console.error("Yoast REST fetch failed:", e);
    return null;
  }
}

export function getYoastForPost(slug: string) {
  return fetchYoastHead(
    `${WP_BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=yoast_head_json`
  );
}

export function getYoastForCategory(slug: string) {
  return fetchYoastHead(
    `${WP_BASE}/wp-json/wp/v2/categories?slug=${encodeURIComponent(slug)}&_fields=yoast_head_json`
  );
}
