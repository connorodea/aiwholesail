import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, ChevronRight, Shield, CheckCircle,
  Building2, Home, Mountain, Caravan, Warehouse,
  Building, Store, LayoutGrid,
  TrendingUp, DollarSign, BarChart3,
  MapPin, CreditCard, ThumbsUp, ThumbsDown,
  Calculator, BookOpen, Calendar,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import propertyTypes from '@/data/property-types.json';

const LAST_UPDATED = '2026-05-12';

interface PropertyType {
  slug: string;
  name: string;
  h1: string;
  description: string;
  keywords: string;
  icon: string;
  overview: string;
  investmentThesis: string;
  typicalReturns: { capRate: string; cashOnCash: string; appreciation: string };
  bestMarkets: string[];
  financingOptions: string[];
  prosAndCons: { pros: string[]; cons: string[] };
  relatedTools: string[];
  relatedGuides: string[];
}

const iconMap: Record<string, React.ReactNode> = {
  Building2: <Building2 className="h-8 w-8 text-cyan-400" />,
  Home: <Home className="h-8 w-8 text-cyan-400" />,
  Mountain: <Mountain className="h-8 w-8 text-cyan-400" />,
  Caravan: <Caravan className="h-8 w-8 text-cyan-400" />,
  Warehouse: <Warehouse className="h-8 w-8 text-cyan-400" />,
  Building: <Building className="h-8 w-8 text-cyan-400" />,
  Store: <Store className="h-8 w-8 text-cyan-400" />,
  LayoutGrid: <LayoutGrid className="h-8 w-8 text-cyan-400" />,
};

function formatSlugName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function PropertyTypePage() {
  const { slug } = useParams<{ slug: string }>();
  const pt = (propertyTypes as PropertyType[]).find((p) => p.slug === slug);

  if (!pt) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Property Type Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this property type.</p>
          <Link to="/property-types">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <Building2 className="h-4 w-4" /> Browse All Property Types
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const canonical = `https://aiwholesail.com/property-types/${pt.slug}`;

  const summary =
    `${pt.name} is a real estate investment category with typical cap rates of ${pt.typicalReturns.capRate}, ` +
    `cash-on-cash returns of ${pt.typicalReturns.cashOnCash}, and annual appreciation of ${pt.typicalReturns.appreciation}. ` +
    `${pt.investmentThesis} Best in markets like ${pt.bestMarkets.slice(0, 3).join(', ')}.`;

  const faqs = [
    {
      q: `What are typical returns on ${pt.name.toLowerCase()}?`,
      a: `${pt.name} typically delivers cap rates of ${pt.typicalReturns.capRate}, cash-on-cash returns of ${pt.typicalReturns.cashOnCash}, and ${pt.typicalReturns.appreciation} annual appreciation. Actual returns depend on market, financing, and operational execution — model conservatively before deploying capital.`,
    },
    {
      q: `What financing options work for ${pt.name.toLowerCase()}?`,
      a: `Common financing for ${pt.name.toLowerCase()}: ${pt.financingOptions.join(', ')}. AIWholesail's Mortgage Calculator and DSCR Calculator model each option's monthly payment so you can compare before approaching lenders.`,
    },
    {
      q: `What are the pros of investing in ${pt.name.toLowerCase()}?`,
      a: pt.prosAndCons.pros.slice(0, 4).join('; '),
    },
    {
      q: `What are the cons or risks of ${pt.name.toLowerCase()}?`,
      a: pt.prosAndCons.cons.slice(0, 4).join('; '),
    },
    {
      q: `What markets are best for ${pt.name.toLowerCase()}?`,
      a: `Top U.S. markets for ${pt.name.toLowerCase()}: ${pt.bestMarkets.join(', ')}. Browse market-specific data at /markets — every page shows median price, growth, cap rate, and population for the metro.`,
    },
  ];

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pt.h1,
    description: pt.description,
    url: canonical,
    image: 'https://aiwholesail.com/og-image.png',
    author: { '@type': 'Organization', name: 'AIWholesail', url: 'https://aiwholesail.com' },
    publisher: {
      '@type': 'Organization',
      name: 'AIWholesail',
      logo: { '@type': 'ImageObject', url: 'https://aiwholesail.com/logo-aiw.png' },
    },
    datePublished: LAST_UPDATED,
    dateModified: LAST_UPDATED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    keywords: pt.keywords,
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <PublicLayout>
      <SEOHead
        title={`${pt.name} -- Real Estate Investing Guide`}
        description={pt.description}
        keywords={pt.keywords}
        canonicalUrl={canonical}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Property Types', url: 'https://aiwholesail.com/property-types' },
          { name: pt.name, url: canonical },
        ]}
      />

      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <meta name="last-modified" content={LAST_UPDATED} />
        <meta property="article:modified_time" content={LAST_UPDATED} />
      </Helmet>

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link
              to="/property-types"
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              <Building2 className="h-4 w-4" />
              <span>All Property Types</span>
            </Link>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-6">
            {iconMap[pt.icon] || <Building2 className="h-8 w-8 text-cyan-400" />}
          </div>

          <Badge
            variant="outline"
            className="text-xs border-cyan-500/20 text-cyan-400 mb-6"
          >
            {pt.name}
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {pt.h1}
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {pt.description}
          </p>
          <p className="mt-6 inline-flex items-center gap-2 text-xs text-white/40">
            <Calendar className="h-3 w-3" /> Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
        </div>
      </section>

      {/* ===== AI-EXTRACTABLE ANSWER BLOCK ===== */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-3">
              What is {pt.name.toLowerCase()} real estate investing?
            </h2>
            <p className="text-base md:text-lg text-white/80 font-light leading-relaxed">
              {summary}
            </p>
          </div>
        </div>
      </section>

      {/* ===== OVERVIEW ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Overview
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">
            What are{' '}
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {pt.name.toLowerCase()}?
            </span>
          </h2>
          <p className="text-neutral-300 font-light leading-relaxed text-lg">
            {pt.overview}
          </p>
        </div>
      </section>

      {/* ===== INVESTMENT THESIS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 md:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400">
                  Investment Thesis
                </p>
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">
              Why invest in {pt.name.toLowerCase()}?
            </h2>
            <p className="text-neutral-300 font-light leading-relaxed text-lg">
              {pt.investmentThesis}
            </p>
          </div>
        </div>
      </section>

      {/* ===== TYPICAL RETURNS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Typical Returns
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            What to expect.
          </h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 text-center">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-xs font-semibold tracking-wide uppercase text-neutral-500 mb-2">Cap Rate</p>
              <p className="text-2xl font-bold text-white">{pt.typicalReturns.capRate}</p>
            </div>
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 text-center">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-xs font-semibold tracking-wide uppercase text-neutral-500 mb-2">Cash-on-Cash Return</p>
              <p className="text-2xl font-bold text-white">{pt.typicalReturns.cashOnCash}</p>
            </div>
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 text-center">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-xs font-semibold tracking-wide uppercase text-neutral-500 mb-2">Appreciation</p>
              <p className="text-2xl font-bold text-white">{pt.typicalReturns.appreciation}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== BEST MARKETS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Top Markets
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            Best markets for {pt.name.toLowerCase()}.
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            {pt.bestMarkets.map((market) => (
              <Link
                key={market}
                to={`/markets/${market}`}
                className="group flex items-center gap-4 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-5 hover:border-cyan-500/20 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold group-hover:text-cyan-400 transition-colors">
                    {formatSlugName(market)}
                  </p>
                  <p className="text-xs text-neutral-500">View market data</p>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINANCING OPTIONS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Financing
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            How to finance {pt.name.toLowerCase()}.
          </h2>

          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-white">Financing Options</h3>
            </div>
            <ul className="space-y-3">
              {pt.financingOptions.map((option, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-cyan-400">{i + 1}</span>
                  </div>
                  <p className="text-neutral-300 font-light">{option}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== PROS & CONS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Pros & Cons
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            Weigh the trade-offs.
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Pros */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ThumbsUp className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-white">Pros</h3>
              </div>
              <ul className="space-y-3">
                {pt.prosAndCons.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className="text-neutral-300 font-light">{pro}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <ThumbsDown className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-white">Cons</h3>
              </div>
              <ul className="space-y-3">
                {pt.prosAndCons.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield className="h-3 w-3 text-red-400" />
                    </div>
                    <p className="text-neutral-300 font-light">{con}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-10">
            Common questions about {pt.name.toLowerCase()}.
          </h2>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6"
              >
                <h3 className="text-base md:text-lg font-semibold text-white mb-2">{f.q}</h3>
                <p className="text-sm md:text-base text-white/70 font-light leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== RELATED RESOURCES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Related Resources
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            Explore more.
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {pt.relatedTools.length > 0 && (
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Free Calculators
                  </h3>
                </div>
                <ul className="space-y-2">
                  {pt.relatedTools.map((tool) => (
                    <li key={tool}>
                      <Link
                        to={`/tools/${tool}`}
                        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                        {formatSlugName(tool)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pt.relatedGuides.length > 0 && (
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Related Guides
                  </h3>
                </div>
                <ul className="space-y-2">
                  {pt.relatedGuides.map((guide) => (
                    <li key={guide}>
                      <Link
                        to={`/guides/${guide}`}
                        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                        {formatSlugName(guide)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Get Started
          </p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Ready to invest in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {pt.name.toLowerCase()}?
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you AI-powered deal scoring, instant comps,
            free calculators, and market intelligence to find and close
            profitable {pt.name.toLowerCase()} deals.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" /> No Credit Card
              Required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Cancel
              Anytime
            </span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
