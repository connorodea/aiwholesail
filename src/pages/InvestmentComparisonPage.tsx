import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight, Check, Trophy, ChevronRight,
  Calculator, BookOpen, Search, Shield, Star, TrendingUp,
  DollarSign, BarChart3, Lock, Wallet, ShieldCheck,
  Gauge, Scale, Umbrella, Sliders,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import comparisons from '@/data/investment-comparisons.json';

interface Asset {
  name: string;
  avgReturn: string;
  riskLevel: string;
  liquidity: string;
  minInvestment: string;
  taxAdvantages: string;
  passivity: string;
  leverage: string;
  inflationHedge: string;
  controlLevel: string;
}

interface Comparison {
  slug: string;
  title: string;
  h1: string;
  description: string;
  keywords: string;
  volume: number;
  asset1: Asset;
  asset2: Asset;
  verdict: string;
  bestFor: {
    asset1: string;
    asset2: string;
  };
}

interface MetricRow {
  label: string;
  key: keyof Omit<Asset, 'name'>;
  icon: React.ReactNode;
}

const metrics: MetricRow[] = [
  { label: 'Average Return', key: 'avgReturn', icon: <TrendingUp className="h-4 w-4" /> },
  { label: 'Risk Level', key: 'riskLevel', icon: <ShieldCheck className="h-4 w-4" /> },
  { label: 'Liquidity', key: 'liquidity', icon: <Gauge className="h-4 w-4" /> },
  { label: 'Minimum Investment', key: 'minInvestment', icon: <Wallet className="h-4 w-4" /> },
  { label: 'Tax Advantages', key: 'taxAdvantages', icon: <DollarSign className="h-4 w-4" /> },
  { label: 'Passivity', key: 'passivity', icon: <Sliders className="h-4 w-4" /> },
  { label: 'Leverage', key: 'leverage', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Inflation Hedge', key: 'inflationHedge', icon: <Umbrella className="h-4 w-4" /> },
  { label: 'Control Level', key: 'controlLevel', icon: <Lock className="h-4 w-4" /> },
];

function getWinner(key: keyof Omit<Asset, 'name'>, a1: Asset, a2: Asset): 'asset1' | 'asset2' | 'tie' {
  const v1 = a1[key].toLowerCase();
  const v2 = a2[key].toLowerCase();

  if (key === 'avgReturn') {
    const extractMax = (s: string) => {
      const nums = s.match(/(\d+)/g);
      return nums ? Math.max(...nums.map(Number)) : 0;
    };
    const m1 = extractMax(v1);
    const m2 = extractMax(v2);
    if (m1 > m2) return 'asset1';
    if (m2 > m1) return 'asset2';
    return 'tie';
  }

  if (key === 'riskLevel') {
    const riskOrder: Record<string, number> = {
      'low': 1, 'low-medium': 2, 'medium': 3, 'medium-high': 4, 'high': 5, 'very high': 6,
    };
    const r1 = riskOrder[v1] || 3;
    const r2 = riskOrder[v2] || 3;
    if (r1 < r2) return 'asset1';
    if (r2 < r1) return 'asset2';
    return 'tie';
  }

  if (key === 'liquidity') {
    const liqOrder: Record<string, number> = { 'low': 1, 'medium': 2, 'high': 3 };
    const parseL = (s: string) => {
      for (const [k, v] of Object.entries(liqOrder)) {
        if (s.includes(k)) return v;
      }
      return 2;
    };
    const l1 = parseL(v1);
    const l2 = parseL(v2);
    if (l1 > l2) return 'asset1';
    if (l2 > l1) return 'asset2';
    return 'tie';
  }

  if (key === 'minInvestment') {
    const extractMin = (s: string) => {
      const nums = s.replace(/[,$]/g, '').match(/(\d+)/g);
      return nums ? Math.min(...nums.map(Number)) : 0;
    };
    const m1 = extractMin(v1);
    const m2 = extractMin(v2);
    if (m1 < m2) return 'asset1';
    if (m2 < m1) return 'asset2';
    return 'tie';
  }

  if (key === 'inflationHedge') {
    const hedgeOrder: Record<string, number> = {
      'weak': 1, 'unproven': 1, 'moderate': 2, 'strong': 3,
    };
    const parseH = (s: string) => {
      for (const [k, v] of Object.entries(hedgeOrder)) {
        if (s.includes(k)) return v;
      }
      return 2;
    };
    const h1 = parseH(v1);
    const h2 = parseH(v2);
    if (h1 > h2) return 'asset1';
    if (h2 > h1) return 'asset2';
    return 'tie';
  }

  return 'tie';
}

export default function InvestmentComparisonPage() {
  const { slug } = useParams<{ slug: string }>();
  const comp = (comparisons as Comparison[]).find((c) => c.slug === slug);

  if (!comp) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Comparison Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this investment comparison.</p>
          <Link to="/compare-investments">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              View All Comparisons
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const otherComparisons = (comparisons as Comparison[]).filter((c) => c.slug !== slug).slice(0, 4);

  return (
    <PublicLayout>
      <SEOHead
        title={comp.title}
        description={comp.description}
        keywords={comp.keywords}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <Link
            to="/compare-investments"
            className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6 hover:text-cyan-300 transition-colors"
          >
            Investment Comparisons <ChevronRight className="h-3 w-3" />
          </Link>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {comp.asset1.name}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              vs {comp.asset2.name}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {comp.description}
          </p>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Head-to-Head</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12">
            Side-by-side comparison.
          </h2>

          {/* Desktop table */}
          <div className="hidden md:block border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_80px_1fr] gap-4 px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="text-sm font-semibold text-cyan-400">{comp.asset1.name}</div>
              <div className="text-sm font-semibold text-center text-white">Metric</div>
              <div className="text-sm font-semibold text-center text-white">Winner</div>
              <div className="text-sm font-semibold text-right text-cyan-400">{comp.asset2.name}</div>
            </div>

            {/* Rows */}
            {metrics.map((metric, i) => {
              const winner = getWinner(metric.key, comp.asset1, comp.asset2);
              return (
                <div
                  key={metric.key}
                  className={`grid grid-cols-[1fr_1fr_80px_1fr] gap-4 px-6 py-5 ${
                    i < metrics.length - 1 ? 'border-b border-white/[0.06]' : ''
                  }`}
                >
                  <div className={`text-sm font-light ${winner === 'asset1' ? 'text-white' : 'text-neutral-500'}`}>
                    {comp.asset1[metric.key]}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-neutral-300">
                    <span className="text-cyan-400/60">{metric.icon}</span>
                    {metric.label}
                  </div>
                  <div className="flex items-center justify-center">
                    {winner === 'asset1' && (
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {comp.asset1.name.split(' ')[0]}
                      </span>
                    )}
                    {winner === 'asset2' && (
                      <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                        {comp.asset2.name.split(' ')[0]}
                      </span>
                    )}
                    {winner === 'tie' && (
                      <span className="text-xs font-semibold text-neutral-400 bg-neutral-500/10 px-2 py-0.5 rounded-full">
                        Tie
                      </span>
                    )}
                  </div>
                  <div className={`text-sm font-light text-right ${winner === 'asset2' ? 'text-white' : 'text-neutral-500'}`}>
                    {comp.asset2[metric.key]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {metrics.map((metric) => {
              const winner = getWinner(metric.key, comp.asset1, comp.asset2);
              return (
                <div
                  key={metric.key}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-5"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-300 mb-4">
                    <span className="text-cyan-400/60">{metric.icon}</span>
                    {metric.label}
                    {winner !== 'tie' && (
                      <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                        winner === 'asset1'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-cyan-400 bg-cyan-500/10'
                      }`}>
                        {winner === 'asset1' ? comp.asset1.name : comp.asset2.name} wins
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 mb-1">{comp.asset1.name}</p>
                      <p className={`text-sm font-light ${winner === 'asset1' ? 'text-white' : 'text-neutral-400'}`}>
                        {comp.asset1[metric.key]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 mb-1">{comp.asset2.name}</p>
                      <p className={`text-sm font-light ${winner === 'asset2' ? 'text-white' : 'text-neutral-400'}`}>
                        {comp.asset2[metric.key]}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== VERDICT ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400">Our Verdict</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6">
              The bottom line.
            </h2>
            <p className="text-lg text-neutral-300 font-light leading-relaxed">
              {comp.verdict}
            </p>
          </div>
        </div>
      </section>

      {/* ===== BEST FOR ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Best For</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12">
            Which is right for you?
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Asset 1 */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-emerald-500/20 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white">{comp.asset1.name}</h3>
              </div>
              <p className="text-sm font-light text-neutral-400 leading-relaxed">
                {comp.bestFor.asset1}
              </p>
            </div>

            {/* Asset 2 */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white">{comp.asset2.name}</h3>
              </div>
              <p className="text-sm font-light text-neutral-400 leading-relaxed">
                {comp.bestFor.asset2}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MORE COMPARISONS ===== */}
      {otherComparisons.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-5xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">More Comparisons</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
              Explore other matchups.
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {otherComparisons.map((c) => (
                <Link
                  key={c.slug}
                  to={`/compare-investments/${c.slug}`}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-5 hover:border-cyan-500/20 transition-all duration-300 group"
                >
                  <p className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors mb-2">
                    {c.h1}
                  </p>
                  <p className="text-xs text-neutral-500 font-light line-clamp-2">{c.description}</p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-cyan-400">
                    Read comparison <ChevronRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to="/tools" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
              <Link to="/blog" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Blog & Guides
              </Link>
              <Link to="/guides" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Search className="h-4 w-4 text-cyan-400" /> Investment Guides
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Start investing in real estate
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              with AIWholesail.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            Find off-market deals, analyze properties with AI, and close your first wholesale deal. Start your 7-day free trial today.
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
