import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, Check, X, ChevronRight,
  Calculator, BookOpen, Search, Shield, Star, Zap,
  Calendar, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import competitors from '@/data/competitors.json';
import softwareReviews from '@/data/software-reviews.json';

const LAST_UPDATED = '2026-05-12';

const reviewSlugs = new Set((softwareReviews as Array<{ slug: string }>).map((r) => r.slug));

interface CompetitorFAQ {
  q: string;
  a: string;
}

interface Competitor {
  slug: string;
  name: string;
  tagline: string;
  pricing: string;
  weaknesses: string[];
  aiwholesailAdvantages: string[];
  summary?: string;
  strengths?: string[];
  idealFor?: string;
  notIdealFor?: string;
  verdict?: string;
  faqs?: CompetitorFAQ[];
  // Set when the competitor has been acquired by another company —
  // renders as a banner so visitors understand the current landscape.
  acquiredBy?: string;
  acquiredDate?: string;
  acquisitionNote?: string;
}

interface FeatureRow {
  feature: string;
  aiwholesail: boolean | string;
  competitor: boolean | string;
}

function buildFeatureTable(comp: Competitor): FeatureRow[] {
  return [
    { feature: 'AI-Powered Deal Scoring', aiwholesail: true, competitor: false },
    { feature: 'Automated Property Analysis', aiwholesail: true, competitor: false },
    { feature: 'Off-Market Lead Generation', aiwholesail: true, competitor: comp.slug === 'batchleads' || comp.slug === 'dealmachine' },
    { feature: 'Comparable Sales / Comps', aiwholesail: true, competitor: comp.slug === 'propstream' || comp.slug === 'privy' },
    { feature: 'Skip Tracing', aiwholesail: true, competitor: comp.slug === 'batchleads' || comp.slug === 'dealmachine' },
    { feature: 'Seller Outreach Sequences', aiwholesail: true, competitor: comp.slug === 'dealmachine' || comp.slug === 'batchleads' },
    { feature: 'Deal Pipeline / CRM', aiwholesail: true, competitor: comp.slug === 'reipro' || comp.slug === 'wholesaler-inc' },
    { feature: 'Buyer Matching & Disposition', aiwholesail: true, competitor: comp.slug === 'investorlift' },
    { feature: 'Investment Calculators', aiwholesail: true, competitor: comp.slug === 'propstream' || comp.slug === 'reipro' },
    { feature: 'Market Intelligence Dashboard', aiwholesail: true, competitor: comp.slug === 'propstream' },
    { feature: 'Mobile-Optimized Interface', aiwholesail: true, competitor: comp.slug !== 'reipro' },
    { feature: 'Starting Price', aiwholesail: '$49/mo', competitor: comp.pricing },
  ];
}

export default function ComparisonPage() {
  const { slug } = useParams<{ slug: string }>();
  const comp = (competitors as Competitor[]).find((c) => c.slug === slug);

  if (!comp) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Comparison Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this competitor comparison.</p>
          <Link to="/">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              Back to Home
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const features = buildFeatureTable(comp);
  const canonical = `https://aiwholesail.com/vs/${comp.slug}`;

  // Structured data: SoftwareApplication for AIWholesail + Review of competitor + FAQPage.
  const aiwAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AIWholesail',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Real Estate Investing Software',
    operatingSystem: 'Web, iOS, Android',
    url: 'https://aiwholesail.com',
    offers: [
      { '@type': 'Offer', name: 'Pro', price: '49', priceCurrency: 'USD', url: 'https://aiwholesail.com/pricing' },
      { '@type': 'Offer', name: 'Elite', price: '99', priceCurrency: 'USD', url: 'https://aiwholesail.com/pricing' },
    ],
  };

  const reviewJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    url: canonical,
    datePublished: LAST_UPDATED,
    itemReviewed: {
      '@type': 'SoftwareApplication',
      name: comp.name,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Real Estate Investing Software',
      offers: { '@type': 'Offer', price: comp.pricing.replace(/[^0-9.]/g, '') || undefined, priceCurrency: 'USD' },
    },
    author: { '@type': 'Organization', name: 'AIWholesail', url: 'https://aiwholesail.com' },
    name: `AIWholesail vs ${comp.name} — Honest Comparison`,
    reviewBody: comp.summary || `${comp.name}: ${comp.tagline}.`,
  };

  const faqJsonLd = comp.faqs && comp.faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: comp.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  return (
    <PublicLayout>
      <SEOHead
        title={`AIWholesail vs ${comp.name} -- Honest Comparison (${LAST_UPDATED})`}
        description={`AIWholesail vs ${comp.name}: ${comp.summary?.slice(0, 155) || `Compare features, pricing, and use cases. AIWholesail starts at $49/mo with AI deal scoring; ${comp.name} is ${comp.pricing}.`}`}
        keywords={`AIWholesail vs ${comp.name}, ${comp.name} alternative, ${comp.name} competitor, best wholesale real estate software, ${comp.name} review, better than ${comp.name}`}
        canonicalUrl={canonical}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Comparisons', url: 'https://aiwholesail.com/reviews' },
          { name: `AIWholesail vs ${comp.name}`, url: canonical },
        ]}
      />

      <Helmet>
        <script type="application/ld+json">{JSON.stringify(aiwAppJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(reviewJsonLd)}</script>
        {faqJsonLd && <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>}
        <meta name="last-modified" content={LAST_UPDATED} />
        <meta property="article:modified_time" content={LAST_UPDATED} />
      </Helmet>

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">COMPARISON</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            AIWholesail vs
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {comp.name}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {comp.name}: {comp.tagline}. See how AIWholesail delivers more features, AI-powered analysis, and a lower price point.
          </p>
          <p className="mt-6 inline-flex items-center gap-2 text-xs text-white/40">
            <Calendar className="h-3 w-3" /> Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
        </div>
      </section>

      {/* ===== ACQUISITION BANNER (when applicable) ===== */}
      {comp.acquiredBy && (
        <section className="py-6 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] to-transparent rounded-xl p-5 md:p-6">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-amber-400 mb-2">
                Heads up — {comp.name} was acquired
              </p>
              <p className="text-sm md:text-base text-white/80 font-light leading-relaxed">
                {comp.acquisitionNote || `${comp.name} was acquired by ${comp.acquiredBy} in ${comp.acquiredDate}. It is now part of the ${comp.acquiredBy} product line.`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===== AI-EXTRACTABLE ANSWER BLOCK ===== */}
      {comp.summary && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
              <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-3">
                AIWholesail vs {comp.name} — at a glance
              </h2>
              <p className="text-base md:text-lg text-white/80 font-light leading-relaxed">
                {comp.summary}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===== VERDICT / WHO IT'S FOR ===== */}
      {(comp.verdict || comp.idealFor) && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="grid md:grid-cols-2 gap-4">
              {comp.idealFor && (
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp className="h-4 w-4 text-emerald-500" />
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase text-emerald-400">
                      Pick {comp.name} if…
                    </p>
                  </div>
                  <p className="text-sm md:text-base text-white/80 font-light leading-relaxed">
                    {comp.idealFor}
                  </p>
                </div>
              )}
              {comp.notIdealFor && (
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsDown className="h-4 w-4 text-cyan-400" />
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400">
                      Pick AIWholesail if…
                    </p>
                  </div>
                  <p className="text-sm md:text-base text-white/80 font-light leading-relaxed">
                    {comp.notIdealFor}
                  </p>
                </div>
              )}
            </div>
            {comp.verdict && (
              <p className="mt-6 text-center text-base md:text-lg text-white/70 font-light leading-relaxed max-w-3xl mx-auto">
                <span className="text-cyan-400 font-medium">Verdict:</span> {comp.verdict}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ===== WHERE COMPETITOR WINS (balanced) ===== */}
      {comp.strengths && comp.strengths.length > 0 && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Where {comp.name} wins</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">
              What {comp.name} does well.
            </h2>
            <p className="text-neutral-400 font-light mb-8 max-w-xl">
              An honest comparison includes where the competition shines. Here's where {comp.name} has the edge.
            </p>
            <ul className="space-y-3">
              {comp.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm md:text-base text-white/80 font-light">
                  <Check className="h-4 w-4 mt-1 text-emerald-500 flex-shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Feature Comparison</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12">
            Side-by-side breakdown.
          </h2>

          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="text-sm font-semibold text-white">Feature</div>
              <div className="text-sm font-semibold text-center text-cyan-400">AIWholesail</div>
              <div className="text-sm font-semibold text-center text-neutral-400">{comp.name}</div>
            </div>

            {/* Rows */}
            {features.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 gap-4 px-6 py-4 ${i < features.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
              >
                <div className="text-sm font-light text-neutral-300">{row.feature}</div>
                <div className="flex justify-center">
                  {typeof row.aiwholesail === 'boolean' ? (
                    row.aiwholesail ? (
                      <Check className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <X className="h-5 w-5 text-neutral-600" />
                    )
                  ) : (
                    <span className="text-sm font-semibold text-cyan-400">{row.aiwholesail}</span>
                  )}
                </div>
                <div className="flex justify-center">
                  {typeof row.competitor === 'boolean' ? (
                    row.competitor ? (
                      <Check className="h-5 w-5 text-neutral-500" />
                    ) : (
                      <X className="h-5 w-5 text-neutral-600" />
                    )
                  ) : (
                    <span className="text-sm font-light text-neutral-400">{row.competitor}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY SWITCH ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Why Switch</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Why investors choose AIWholesail.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Every advantage you get when you switch from {comp.name} to AIWholesail.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comp.aiwholesailAdvantages.map((adv, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Check className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium leading-relaxed text-white">{adv}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPETITOR WEAKNESSES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">{comp.name} Limitations</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Where {comp.name} falls short.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Common complaints from {comp.name} users that AIWholesail solves.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comp.weaknesses.map((w, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-red-500/10 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                  <X className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-sm font-light leading-relaxed text-neutral-400">{w}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      {comp.faqs && comp.faqs.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-10">
              Common questions about AIWholesail vs {comp.name}.
            </h2>
            <div className="space-y-4">
              {comp.faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6"
                >
                  <h3 className="text-base md:text-lg font-semibold text-white mb-2">{faq.q}</h3>
                  <p className="text-sm md:text-base text-white/70 font-light leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CROSS-LINK TO /reviews/ DETAIL ===== */}
      {reviewSlugs.has(`${comp.slug}-review`) && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-4xl">
            <Link
              to={`/reviews/${comp.slug}-review`}
              className="block border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.08] to-transparent rounded-xl p-6 md:p-7 hover:border-cyan-400/40 transition-colors group"
            >
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-2">
                Deep-dive review
              </p>
              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-2">
                Read our full {comp.name} review →
              </h3>
              <p className="text-sm md:text-base text-white/70 font-light leading-relaxed group-hover:text-white/90 transition-colors">
                Overview, pricing, pros and cons, features, and a 1–5 verdict on whether {comp.name} is worth it.
              </p>
            </Link>
          </div>
        </section>
      )}

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to="/tools" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
              <Link to="/blog" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Blog & Guides
              </Link>
              <Link to="/use-cases" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Search className="h-4 w-4 text-cyan-400" /> Use Cases
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Make the Switch</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Upgrade from {comp.name}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              to AI-powered deals.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            Start your 7-day free trial. No credit card required. See why investors are switching to AIWholesail.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-light">No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-light">4.8/5 User Rating</span>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
