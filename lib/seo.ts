// SEO head data builders. Values imported from Yoast live in the DB
// (seo_title / seo_description); these builders reproduce the same head
// the old site rendered, from our own data.
import { SITE_TITLE, SITE_URL } from "./constants";

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
  schema?: Record<string, any> | null;
};

// Legacy WordPress images are absolute (https://dietanaluzie.pl/wp-content/...);
// new TikTok/manual images are stored relative (/uploads/...). og:image and
// JSON-LD image MUST be absolute for social/Google, so normalize here.
export function absUrl(u: string): string {
  return /^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

const DEFAULT_ROBOTS = {
  index: "index",
  follow: "follow",
  "max-snippet": "max-snippet:-1",
  "max-image-preview": "max-image-preview:large",
  "max-video-preview": "max-video-preview:-1",
};

type SeoSource = {
  seoTitle?: string | null;
  seoDescription?: string | null;
  uri: string;
  title: string;
};

function baseSeo(src: SeoSource): YoastHeadJson {
  const title = src.seoTitle || `${src.title} - ${SITE_TITLE}`;
  const canonical = `${SITE_URL}${src.uri}`;
  return {
    title,
    description: src.seoDescription || undefined,
    robots: DEFAULT_ROBOTS,
    canonical,
    og_locale: "pl_PL",
    og_title: title,
    og_description: src.seoDescription || undefined,
    og_url: canonical,
    og_site_name: SITE_TITLE,
  };
}

export function buildSeoForRecipe(recipe: SeoSource & {
  heroImage?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  authorName?: string | null;
}): YoastHeadJson {
  return {
    ...baseSeo(recipe),
    og_type: "article",
    article_published_time: recipe.publishedAt?.toISOString(),
    article_modified_time: recipe.updatedAt?.toISOString(),
    og_image: recipe.heroImage ? [{ url: absUrl(recipe.heroImage) }] : undefined,
    author: recipe.authorName || undefined,
  };
}

export function buildSeoForCategory(category: Omit<SeoSource, "title"> & { name: string }): YoastHeadJson {
  return {
    ...baseSeo({ ...category, title: category.name }),
    og_type: "article",
  };
}

export function buildSeoForPage(page: SeoSource): YoastHeadJson {
  return {
    ...baseSeo(page),
    og_type: "article",
  };
}

// Paged archives: ".../page/N/" + "Strona N z X" (matches the old Yoast pattern)
export function pagedSeo(
  seo: YoastHeadJson | null,
  page: number,
  totalPages: number
): YoastHeadJson | null {
  if (!seo || page <= 1) return seo;
  const pagedUrl = (u?: string) => (u ? `${u}page/${page}/` : u);
  const pagedTitle = (t?: string) => {
    if (!t) return t;
    const sep = " - ";
    const parts = t.split(sep);
    return [parts[0], `Strona ${page} z ${totalPages}`, ...parts.slice(1)].join(sep);
  };
  return {
    ...seo,
    title: pagedTitle(seo.title),
    og_title: pagedTitle(seo.og_title),
    canonical: pagedUrl(seo.canonical),
    og_url: pagedUrl(seo.og_url),
    schema: null,
  };
}
