import { Link } from 'react-router-dom';
import {
  ArrowRight, ChevronRight, Shield, Star,
  TrendingUp, Scale,
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

export default function InvestmentComparisons() {
  const allComparisons = comparisons as Comparison[];

  return (
    <PublicLayout>
      <SEOHead
        title="Investment Comparisons -- Real Estate vs Stocks, Crypto, Bonds & More"
        description="Compare real estate to stocks, crypto, index funds, REITs, bonds, and gold. Side-by-side analysis of returns, risk, tax advantages, and which investment is best for you."
        keywords="real estate vs stocks, real estate vs crypto, real estate vs index funds, real estate vs REITs, investment comparison, best investment 2026"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Investment Comparisons
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Real Estate vs
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Everything Else.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Side-by-side comparisons of real estate against every major asset class and strategy.
            Data-driven analysis to help you invest smarter.
          </p>
        </div>
      </section>

      {/* ===== COMPARISON GRID ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-sm text-neutral-400 font-light mb-8">
            {allComparisons.length} comparisons
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allComparisons.map((comp) => (
              <Link
                key={comp.slug}
                to={`/compare-investments/${comp.slug}`}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300 group"
              >
                {/* VS badge */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Scale className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-400">{comp.volume.toLocaleString()}</span>
                    <span className="text-xs text-neutral-600">monthly searches</span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors mb-3">
                  {comp.h1}
                </h2>

                <p className="text-sm text-neutral-500 font-light leading-relaxed mb-4 line-clamp-2">
                  {comp.description}
                </p>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">{comp.asset1.name}</p>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-sm font-semibold text-white">{comp.asset1.avgReturn}</span>
                    </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">{comp.asset2.name}</p>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="text-sm font-semibold text-white">{comp.asset2.avgReturn}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-sm text-cyan-400 font-medium">
                  Read full comparison <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Start Investing</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Ready to invest in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              real estate?
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail helps you find, analyze, and close off-market real estate deals with AI-powered tools.
            Start your 7-day free trial today.
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
