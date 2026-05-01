import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { generateCSPHeader } from '@/lib/security-enhanced';

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
  title = "AIWholesail - Find Profitable Real Estate Deals with AI",
  description = "AI-powered tools for real estate professionals. Find profitable deals, analyze properties, and close faster with advanced AI analytics and market intelligence.",
  keywords = "real estate deals, property analysis, AI real estate, profitable deals, property investment, real estate analytics, real estate investing",
  canonicalUrl,
  ogImage = "https://aiwholesail.com/og-image.png",
  noIndex = false,
  breadcrumbs
}: SEOHeadProps) {
  const fullTitle = title.includes('AI Wholesail') ? title : `${title} | AI Wholesail`;
  const currentUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
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
      
      {/* Security Headers */}
      <meta httpEquiv="Content-Security-Policy" content={generateCSPHeader()} />
      <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      <meta httpEquiv="X-Frame-Options" content="DENY" />
      <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
      <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
      
      {/* Preconnects for Performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://ztgsevhzbeywytoqlsbf.supabase.co" />
      
      {/* Additional Meta */}
      <meta name="theme-color" content="#3b82f6" />
      <meta name="msapplication-TileColor" content="#3b82f6" />
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