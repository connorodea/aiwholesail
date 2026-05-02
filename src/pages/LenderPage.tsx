import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight, ChevronRight, Shield, Star,
  DollarSign, Clock, Percent, Target, Banknote,
  Calculator, Lightbulb, MapPin, Building2,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import lendersData from '@/data/lenders.json';

interface Lender {
  name: string;
  rate: string;
  ltv: string;
  minLoan: number;
  closingDays: string;
  specialties: string[];
}

interface LenderEntry {
  slug: string;
  citySlug: string;
  city: string;
  state: string;
  lenderType: string;
  lenderTypeLabel: string;
  lenders: Lender[];
  avgRate: string;
  avgClosing: string;
  tips: string[];
}

const lenderTypeFinancingMap: Record<string, string> = {
  'hard-money': 'hard-money-loans',
  'private-money': 'private-money-lending',
  'dscr': 'dscr-loans',
  'portfolio': 'portfolio-loans',
  'commercial': 'commercial-real-estate-loans',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function LenderPage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = (lendersData as LenderEntry[]).find((e) => e.slug === slug);

  if (!entry) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Lender Page Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this lender directory page.</p>
          <Link to="/lenders">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              Browse All Lenders
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const relatedInCity = (lendersData as LenderEntry[]).filter(
    (e) => e.citySlug === entry.citySlug && e.slug !== entry.slug
  );

  const financingGuideSlug = lenderTypeFinancingMap[entry.lenderType];

  return (
    <PublicLayout>
      <SEOHead
        title={`${entry.lenderTypeLabel} in ${entry.city}, ${entry.state} -- Rates, LTV & Closing Times`}
        description={`Find the best ${entry.lenderTypeLabel.toLowerCase()} in ${entry.city}, ${entry.state}. Compare rates (${entry.avgRate}), LTV ratios, minimum loans, and closing times. Updated for 2026.`}
        keywords={`${entry.lenderTypeLabel.toLowerCase()} ${entry.city}, ${entry.lenderType} lenders ${entry.city} ${entry.state}, ${entry.city} real estate financing, ${entry.lenderType} loans ${entry.state}`}
        canonicalUrl={`https://aiwholesail.com/lenders/${entry.slug}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Lenders', url: 'https://aiwholesail.com/lenders' },
          { name: `${entry.lenderTypeLabel} in ${entry.city}`, url: `https://aiwholesail.com/lenders/${entry.slug}` },
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
            <Link to="/lenders" className="hover:text-white transition-colors">Lenders</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-400">{entry.city}, {entry.state}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-cyan-500/20 bg-cyan-500/5 rounded-full mb-6">
            <MapPin className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">{entry.city}, {entry.state}</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {entry.lenderTypeLabel}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              in {entry.city}, {entry.state}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Compare rates, LTV ratios, minimum loan amounts, and closing timelines from {entry.lenderTypeLabel.toLowerCase()} operating in the {entry.city} market.
          </p>

          {/* Quick stats */}
          <div className="flex items-center justify-center gap-6 mt-10">
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <Percent className="h-4 w-4 text-cyan-400" />
              <span className="font-light">Avg Rate: <span className="font-semibold text-white">{entry.avgRate}</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span className="font-light">Avg Close: <span className="font-semibold text-white">{entry.avgClosing}</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LENDER CARDS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">LENDERS</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Top {entry.lenderTypeLabel.toLowerCase()} in {entry.city}.
          </h2>
          <p className="text-sm text-neutral-400 font-light mb-10 max-w-2xl">
            These are national lenders actively operating in the {entry.city}, {entry.state} market. Local and regional lenders may also be available -- check your local REI network for additional options.
          </p>

          <div className="space-y-4">
            {entry.lenders.map((lender, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8 hover:border-cyan-500/20 transition-all duration-300"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Banknote className="h-5 w-5 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{lender.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lender.specialties.map((spec, j) => (
                      <span
                        key={j}
                        className="px-2.5 py-1 text-[11px] font-medium text-cyan-400 border border-cyan-500/20 bg-cyan-500/5 rounded-full"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/[0.02] rounded-lg px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Percent className="h-3 w-3 text-neutral-500" />
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Interest Rate</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{lender.rate}</span>
                  </div>
                  <div className="bg-white/[0.02] rounded-lg px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="h-3 w-3 text-neutral-500" />
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">LTV</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{lender.ltv}</span>
                  </div>
                  <div className="bg-white/[0.02] rounded-lg px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign className="h-3 w-3 text-neutral-500" />
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Min Loan</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{formatCurrency(lender.minLoan)}</span>
                  </div>
                  <div className="bg-white/[0.02] rounded-lg px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3 w-3 text-neutral-500" />
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Closing</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{lender.closingDays} days</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LOCAL MARKET TIPS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">LOCAL INSIGHTS</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            {entry.city} market tips.
          </h2>

          <div className="space-y-4">
            {entry.tips.map((tip, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="h-5 w-5 text-amber-400" />
                </div>
                <p className="text-sm text-neutral-300 font-light leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINANCING GUIDE LINK ===== */}
      {financingGuideSlug && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-5xl">
            <Link
              to={`/financing/${financingGuideSlug}`}
              className="border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent rounded-xl p-8 flex items-center justify-between group hover:border-cyan-500/30 transition-all duration-300 block"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                    {entry.lenderTypeLabel} Financing Guide
                  </h3>
                  <p className="text-sm text-neutral-400 font-light">
                    Learn about rates, terms, qualifications, and how to apply for {entry.lenderTypeLabel.toLowerCase()} financing.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-cyan-400 group-hover:translate-x-1 transition-transform flex-shrink-0 hidden md:block" />
            </Link>
          </div>
        </section>
      )}

      {/* ===== CALCULATOR LINK ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <Link
            to={entry.lenderType === 'dscr' ? '/tools/dscr-calculator' : '/tools/mortgage-calculator'}
            className="border border-white/[0.06] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 flex items-center justify-between group hover:border-cyan-500/20 transition-all duration-300 block"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Calculator className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  {entry.lenderType === 'dscr' ? 'DSCR Calculator' : 'Mortgage Calculator'}
                </h3>
                <p className="text-sm text-neutral-400 font-light">
                  Run the numbers on your {entry.city} deal with {entry.lenderTypeLabel.toLowerCase()} terms.
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-cyan-400 group-hover:translate-x-1 transition-transform flex-shrink-0 hidden md:block" />
          </Link>
        </div>
      </section>

      {/* ===== RELATED LENDER TYPES ===== */}
      {relatedInCity.length > 0 && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-5xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">ALSO IN {entry.city.toUpperCase()}</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
              Other lender types in {entry.city}.
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedInCity.map((related) => (
                <Link
                  key={related.slug}
                  to={`/lenders/${related.slug}`}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Banknote className="h-4 w-4 text-cyan-400" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {related.lenderTypeLabel}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-white/[0.02] rounded-md px-2 py-1.5">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Rate</span>
                      <span className="text-[11px] font-semibold text-white">{related.avgRate}</span>
                    </div>
                    <div className="bg-white/[0.02] rounded-md px-2 py-1.5">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Close</span>
                      <span className="text-[11px] font-semibold text-white">{related.avgClosing}</span>
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
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Find Deals in {entry.city}</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            The best financing starts with
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              the right deal.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail uses AI to find off-market deals in {entry.city} and match you with the right financing structure. Start for free.
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
            "@type": "ItemList",
            "name": `${entry.lenderTypeLabel} in ${entry.city}, ${entry.state}`,
            "description": `Top ${entry.lenderTypeLabel.toLowerCase()} operating in ${entry.city}, ${entry.state}. Compare rates, LTV, minimum loans, and closing times.`,
            "numberOfItems": entry.lenders.length,
            "itemListElement": entry.lenders.map((lender, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "item": {
                "@type": "FinancialService",
                "name": lender.name,
                "areaServed": {
                  "@type": "City",
                  "name": entry.city,
                  "addressRegion": entry.state,
                },
              },
            })),
          }),
        }}
      />
    </PublicLayout>
  );
}
