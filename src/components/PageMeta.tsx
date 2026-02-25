import { Helmet } from 'react-helmet-async';
import { getPublicBaseUrl, safePathForUrl, DEFAULT_OG_IMAGE, type DiscoverableRoute } from '@/config/discoverable-routes';

interface PageMetaProps {
  /** Route meta from discoverable-routes (title, description, etc.) */
  route: DiscoverableRoute;
  /** Optional override for og:image */
  image?: string;
  /** Optional JSON-LD script body (stringified JSON) */
  jsonLd?: string;
}

export function PageMeta({ route, image = DEFAULT_OG_IMAGE, jsonLd }: PageMetaProps) {
  const base = getPublicBaseUrl();
  const path = safePathForUrl(route.path);
  const url = `${base}${path === '/' ? '' : path}`;
  const title = route.title;
  const description = route.description;
  const imageUrl = image.startsWith('http') ? image : `${base.replace(/\/$/, '')}${image}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {route.noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      {jsonLd && (
        <script type="application/ld+json">
          {jsonLd}
        </script>
      )}
    </Helmet>
  );
}
