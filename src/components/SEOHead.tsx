import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { generateCSPHeader } from '@/lib/security-enhanced';
import { useInModal } from '@/lib/in-modal-context';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  noIndex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
}

export function SEOHead({
  title = "AIWholesail — Find Profitable Real Estate Deals Before Everyone Else",
  description = "AIWholesail scans thousands of properties daily, scores each deal 0–100 with AI, and alerts you when $30K+ spreads hit the market. Skip tracing, contracts, and 14 free calculators included. Start free, no credit card.",
  keywords = "AIWholesail, AI real estate, wholesale real estate software, real estate investing AI, property deal finder, motivated seller leads, real estate AI tools",
  canonicalUrl,
  ogImage = "https://aiwholesail.com/og-image.png",
  noIndex = false,
  breadcrumbs
}: SEOHeadProps) {
  // No-op when rendered inside the property modal — we don't want a
  // calculator's <Helmet> tags to stomp the property-detail page's title +
  // canonical + OG image. The standalone /tools/<slug> route still renders
  // these normally (inModal === false there).
  const { inModal } = useInModal();
  if (inModal) return null;

  // Append brand only when the title doesn't already contain it.
  // Match BOTH "AIWholesail" (one word) and "AI Wholesail" (two words).
  // Without this, the home title was rendering as
  //   "AIWholesail - Find Profitable Real Estate Deals with AI | AI Wholesail"
  // which Google truncated to "AI ..." in the SERP.
  const titleMentionsBrand = /\bai\s?wholesail\b/i.test(title);
  const fullTitle = titleMentionsBrand ? title : `${title} | AIWholesail`;
  // Always compute a self-canonical so GSC doesn't have to guess.
  // Strips query string + fragment, normalizes to the apex (non-www) host,
  // drops trailing slash on non-root paths.
  const computedCanonical = (() => {
    if (canonicalUrl) return canonicalUrl;
    if (typeof window === 'undefined') return 'https://aiwholesail.com/';
    const pathOnly = window.location.pathname || '/';
    const cleanPath = pathOnly.length > 1 ? pathOnly.replace(/\/+$/, '') : '/';
    return 'https://aiwholesail.com' + cleanPath;
  })();
  const currentUrl = computedCanonical;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={computedCanonical} />
      
      {/* Viewport and Mobile */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="format-detection" content="telephone=no" />
      
      {/* SEO Directives */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {!noIndex && <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content="AI Wholesail" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Security Headers
       * Only CSP and Referrer-Policy are valid as <meta> tags. Browsers IGNORE
       * X-Frame-Options, X-Content-Type-Options, and X-XSS-Protection meta tags
       * (and log them as console errors, dragging Best Practices score down).
       * Those three should be set as HTTP response headers via nginx/Cloudflare
       * configuration. See marketing/LIGHTHOUSE_REPORT_2026-05-12.md.
       */}
      <meta httpEquiv="Content-Security-Policy" content={generateCSPHeader()} />
      <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
      
      {/* Preconnect to Supabase API (font preconnects are in index.html) */}
      <link rel="preconnect" href="https://ztgsevhzbeywytoqlsbf.supabase.co" />
      
      {/* Additional Meta */}
      <meta name="theme-color" content="#08090a" />
      <meta name="msapplication-TileColor" content="#06b6d4" />
      <meta name="application-name" content="AI Wholesail" />
      
      {/* Structured Data for Real Estate Business */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "AI Wholesail",
          "description": description,
          "url": currentUrl,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "category": "SaaS"
          },
          "creator": {
            "@type": "Organization",
            "name": "AI Wholesail",
            "url": currentUrl
          }
        })}
      </script>

      {/* Organization Schema */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "AIWholesail",
          "url": "https://aiwholesail.com",
          "logo": "https://aiwholesail.com/logo-dark.png",
          "sameAs": []
        })}
      </script>

      {/* BreadcrumbList Schema */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": breadcrumbs.map((crumb, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "name": crumb.name,
              "item": crumb.url
            }))
          })}
        </script>
      )}
    </Helmet>
  );
}