import Head from "next/head";
import { SITE_TITLE, SITE_URL } from "../lib/constants";
import type { YoastHeadJson } from "../lib/seo";

type Props = {
  seo: YoastHeadJson | null;
  // Fallbacks used when the Yoast REST call failed
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackPath?: string;
  fallbackOgImage?: string;
};

// Renders the exact head Yoast outputs on the live site (title, description,
// robots, canonical, og:*, article:*, twitter + the schema.org graph).
export default function WpSeo({
  seo,
  fallbackTitle,
  fallbackDescription,
  fallbackPath,
  fallbackOgImage,
}: Props) {
  if (!seo) {
    const canonical = fallbackPath ? `${SITE_URL}${fallbackPath}` : null;
    return (
      <Head>
        {fallbackTitle && <title>{fallbackTitle}</title>}
        {fallbackDescription && (
          <meta name="description" content={fallbackDescription} />
        )}
        {canonical && <link rel="canonical" href={canonical} />}
        <meta property="og:locale" content="pl_PL" />
        {fallbackTitle && <meta property="og:title" content={fallbackTitle} />}
        {canonical && <meta property="og:url" content={canonical} />}
        <meta property="og:site_name" content={SITE_TITLE} />
        {fallbackOgImage && <meta property="og:image" content={fallbackOgImage} />}
      </Head>
    );
  }

  const robots = seo.robots ? Object.values(seo.robots).join(", ") : null;

  return (
    <Head>
      {seo.title && <title>{seo.title}</title>}
      {robots && <meta name="robots" content={robots} />}
      {seo.description && <meta name="description" content={seo.description} />}
      {seo.canonical && <link rel="canonical" href={seo.canonical} />}
      {seo.og_locale && <meta property="og:locale" content={seo.og_locale} />}
      {seo.og_type && <meta property="og:type" content={seo.og_type} />}
      {seo.og_title && <meta property="og:title" content={seo.og_title} />}
      {seo.og_description && (
        <meta property="og:description" content={seo.og_description} />
      )}
      {seo.og_url && <meta property="og:url" content={seo.og_url} />}
      {seo.og_site_name && (
        <meta property="og:site_name" content={seo.og_site_name} />
      )}
      {seo.article_published_time && (
        <meta
          property="article:published_time"
          content={seo.article_published_time}
        />
      )}
      {seo.article_modified_time && (
        <meta
          property="article:modified_time"
          content={seo.article_modified_time}
        />
      )}
      {seo.og_image?.map((img) => [
        <meta key={`${img.url}-u`} property="og:image" content={img.url} />,
        img.width ? (
          <meta
            key={`${img.url}-w`}
            property="og:image:width"
            content={String(img.width)}
          />
        ) : null,
        img.height ? (
          <meta
            key={`${img.url}-h`}
            property="og:image:height"
            content={String(img.height)}
          />
        ) : null,
        img.type ? (
          <meta
            key={`${img.url}-t`}
            property="og:image:type"
            content={img.type}
          />
        ) : null,
      ])}
      {seo.author && <meta name="author" content={seo.author} />}
      {seo.twitter_card && (
        <meta name="twitter:card" content={seo.twitter_card} />
      )}
      {seo.schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.schema) }}
        />
      )}
    </Head>
  );
}
