import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
}

export function SEOHead({
  title = "AI Wholesail - Find Profitable Real Estate Wholesale Deals with AI",
  description = "Discover undervalued properties with AI-powered analysis, comprehensive market data, and automated deal scoring. Turn data into profit with AI Wholesail.",
  keywords = "real estate wholesale, AI property analysis, wholesale deals, property investment, real estate investing, deal analysis, market data, property search",
  canonicalUrl,
  ogImage = "/lovable-uploads/8dcdb5d0-ddfb-406f-a5f0-b3c5112d210a.png",
  ogType = "website",
  noIndex = false
}: SEOHeadProps) {
  const fullTitle = title.includes("AI Wholesail") ? title : `${title} | AI Wholesail`;
  const currentUrl = canonicalUrl || window.location.href;
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={currentUrl} />
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="AI Wholesail" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Additional SEO Tags */}
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow"} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#0ea5e9" />
      
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
            "price": "29",
            "priceCurrency": "USD",
            "priceValidUntil": "2025-12-31"
          },
          "provider": {
            "@type": "Organization",
            "name": "AI Wholesail",
            "url": currentUrl
          }
        })}
      </script>
    </Helmet>
  );
}