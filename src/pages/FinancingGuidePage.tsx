import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight, Check, X, ChevronRight, Shield, Star,
  Banknote, Users, TrendingUp, Building2, Home, Handshake,
  ArrowLeftRight, Repeat, Landmark, Library, Building, ArrowRightLeft,
  DollarSign, Clock, Percent, Target, FileText, Calculator,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import financingGuides from '@/data/financing-guides.json';

interface FinancingGuide {
  slug: string;
  name: string;
  h1: string;
  description: string;
  keywords: string;
  category: string;
  icon: string;
  overview: string;
  bestFor: string[];
  notGoodFor: string[];
  typicalTerms: {
    interestRate: string;
    loanToValue: string;
    term: string;
    points: string;
    downPayment: string;
    closingTime: string;
    prepaymentPenalty: string;
  };
  qualificationRequirements: string[];
  prosAndCons: {
    pros: string[];
    cons: string[];
  };
  howToApply: string[];
  topLenders: string[];
  calculatorLink: string;
  relatedGuides: string[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Banknote,
  Users,
  TrendingUp,
  Building2,
  Home,
  Handshake,
  ArrowLeftRight,
  Repeat,
  Landmark,
  Library,
  Building,
  ArrowRightLeft,
};

function GuideIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = iconMap[name];
  if (!IconComponent) return <Banknote className={className} />;
  return <IconComponent className={className} />;
}

export default function FinancingGuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const guide = (financingGuides as FinancingGuide[]).find((g) => g.slug === slug);

  if (!guide) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Guide Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this financing guide.</p>
          <Link to="/financing">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              Browse All Financing Guides
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const relatedGuideData = (financingGuides as FinancingGuide[]).filter((g) =>
    guide.relatedGuides.includes(g.slug)
  );

  const termLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    interestRate: { label: 'Interest Rate', icon: Percent },
    loanToValue: { label: 'Loan-to-Value', icon: Target },
    term: { label: 'Loan Term', icon: Clock },
    points: { label: 'Origination Points', icon: DollarSign },
    downPayment: { label: 'Down Payment', icon: DollarSign },
    closingTime: { label: 'Closing Time', icon: Clock },
    prepaymentPenalty: { label: 'Prepayment Penalty', icon: FileText },
  };

  return (
    <PublicLayout>
      <SEOHead
        title={`${guide.name} -- Complete Guide for Real Estate Investors`}
        description={guide.description}
        keywords={guide.keywords}
        canonicalUrl={`https://aiwholesail.com/financing/${guide.slug}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Financing Guides', url: 'https://aiwholesail.com/financing' },
          { name: guide.name, url: `https://aiwholesail.com/financing/${guide.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          {/* Breadcrumbs */}
          <nav className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 mb-8">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/financing" className="hover:text-white transition-colors">Financing</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-400">{guide.name}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-cyan-500/20 bg-cyan-500/5 rounded-full mb-6">
            <GuideIcon name={guide.icon} className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">{guide.category}</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {guide.h1.split('--')[0].trim()}
            {guide.h1.includes('--') && (
              <>
                <br />
                <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                  {guide.h1.split('--')[1].trim()}
                </span>
              </>
            )}
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {guide.description}
          </p>
        </div>
      </section>

      {/* ===== OVERVIEW ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Overview</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6">
            What are {guide.name}?
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed font-light">
            {guide.overview}
          </p>
        </div>
      </section>

      {/* ===== BEST FOR / NOT GOOD FOR ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Fit Analysis</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-10">
            Is this the right financing for you?
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Best For */}
            <div className="border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Best For</h3>
              </div>
              <ul className="space-y-3.5">
                {guide.bestFor.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300 font-light leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not Good For */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <X className="h-4 w-4 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Not Ideal For</h3>
              </div>
              <ul className="space-y-3.5">
                {guide.notGoodFor.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300 font-light leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TYPICAL TERMS TABLE ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Terms</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            Typical loan terms.
          </h2>

          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl overflow-hidden">
            {Object.entries(guide.typicalTerms).map(([key, value], i) => {
              const termInfo = termLabels[key];
              if (!termInfo) return null;
              const TermIcon = termInfo.icon;
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between px-6 py-4 ${
                    i < Object.entries(guide.typicalTerms).length - 1 ? 'border-b border-white/[0.04]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TermIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-sm text-neutral-400 font-light">{termInfo.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== QUALIFICATION REQUIREMENTS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Requirements</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            How to qualify.
          </h2>

          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
            <ul className="space-y-4">
              {guide.qualificationRequirements.map((req, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-cyan-400">{i + 1}</span>
                  </div>
                  <span className="text-sm text-neutral-300 font-light leading-relaxed">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== PROS & CONS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Pros & Cons</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-10">
            The good and the bad.
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pros */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Pros</h3>
              </div>
              <ul className="space-y-3.5">
                {guide.prosAndCons.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300 font-light leading-relaxed">{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <X className="h-4 w-4 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Cons</h3>
              </div>
              <ul className="space-y-3.5">
                {guide.prosAndCons.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300 font-light leading-relaxed">{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW TO APPLY ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Process</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            How to apply.
          </h2>

          <div className="space-y-4">
            {guide.howToApply.map((step, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-cyan-400">{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm text-neutral-300 font-light leading-relaxed">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TOP LENDERS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Lenders</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            Top lenders to consider.
          </h2>

          <div className="flex flex-wrap gap-3">
            {guide.topLenders.map((lender, i) => (
              <div
                key={i}
                className="px-5 py-3 border border-white/[0.06] bg-white/[0.02] rounded-lg text-sm text-neutral-300 font-light hover:border-cyan-500/20 transition-colors"
              >
                {lender}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CALCULATOR LINK ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <Link
            to={guide.calculatorLink}
            className="border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent rounded-xl p-8 flex items-center justify-between group hover:border-cyan-500/30 transition-all duration-300 block"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Calculator className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  Run the Numbers
                </h3>
                <p className="text-sm text-neutral-400 font-light">
                  Use our free calculator to analyze your deal with {guide.name.toLowerCase()} terms.
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-cyan-400 group-hover:translate-x-1 transition-transform flex-shrink-0 hidden md:block" />
          </Link>
        </div>
      </section>

      {/* ===== RELATED GUIDES ===== */}
      {relatedGuideData.length > 0 && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Related Guides</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
              Explore more financing options.
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedGuideData.map((related) => (
                <Link
                  key={related.slug}
                  to={`/financing/${related.slug}`}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <GuideIcon name={related.icon} className="h-4 w-4 text-cyan-400" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {related.name}
                  </h3>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {related.category}
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-white/[0.02] rounded-md px-2 py-1.5">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Rate</span>
                      <span className="text-[11px] font-semibold text-white">{related.typicalTerms.interestRate}</span>
                    </div>
                    <div className="bg-white/[0.02] rounded-md px-2 py-1.5">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Term</span>
                      <span className="text-[11px] font-semibold text-white">{related.typicalTerms.term}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Find Funded Deals</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Great financing starts with
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              a great deal.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail uses AI to find off-market deals, calculate spreads, and match you with the right financing structure. Start for free.
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

      {/* ===== SCHEMA MARKUP ===== */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": guide.h1,
            "description": guide.description,
            "author": {
              "@type": "Organization",
              "name": "AIWholesail",
              "url": "https://aiwholesail.com",
            },
            "publisher": {
              "@type": "Organization",
              "name": "AIWholesail",
              "url": "https://aiwholesail.com",
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://aiwholesail.com/financing/${guide.slug}`,
            },
            "datePublished": "2026-04-30",
            "dateModified": "2026-04-30",
          }),
        }}
      />
    </PublicLayout>
  );
}
