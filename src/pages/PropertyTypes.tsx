import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, ChevronRight, Shield, CheckCircle,
  Building2, Home, Mountain, Caravan, Warehouse,
  Building, Store, LayoutGrid,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import propertyTypes from '@/data/property-types.json';

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
  Building2: <Building2 className="h-6 w-6 text-cyan-400" />,
  Home: <Home className="h-6 w-6 text-cyan-400" />,
  Mountain: <Mountain className="h-6 w-6 text-cyan-400" />,
  Caravan: <Caravan className="h-6 w-6 text-cyan-400" />,
  Warehouse: <Warehouse className="h-6 w-6 text-cyan-400" />,
  Building: <Building className="h-6 w-6 text-cyan-400" />,
  Store: <Store className="h-6 w-6 text-cyan-400" />,
  LayoutGrid: <LayoutGrid className="h-6 w-6 text-cyan-400" />,
};

export default function PropertyTypes() {
  const allTypes = propertyTypes as PropertyType[];

  return (
    <PublicLayout>
      <SEOHead
        title="Property Types for Real Estate Investing -- Compare Returns & Strategies"
        description="Compare 8 real estate property types — multifamily, single-family, land, mobile homes, self-storage, office, retail, and mixed-use. Returns, financing, and market data."
        keywords="real estate property types, investment property types, multifamily investing, single family investing, self storage investing, commercial real estate"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Property Types', url: 'https://aiwholesail.com/property-types' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Property Types
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Every Property Type.
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              One Platform.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Compare returns, financing options, and strategies across 8 major
            real estate property types to find the right fit for your portfolio.
          </p>
        </div>
      </section>

      {/* ===== PROPERTY TYPE GRID ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-sm text-neutral-400 font-light mb-8">
            {allTypes.length} property types
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {allTypes.map((pt) => (
              <Link
                key={pt.slug}
                to={`/property-types/${pt.slug}`}
                className="group"
              >
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      {iconMap[pt.icon] || <Building2 className="h-6 w-6 text-cyan-400" />}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {pt.name}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed mb-5 flex-1">
                    {pt.description}
                  </p>

                  {/* Returns preview */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06]">
                    <div>
                      <p className="text-[10px] font-semibold tracking-wide uppercase text-neutral-500">Cap Rate</p>
                      <p className="text-sm font-semibold text-white">{pt.typicalReturns.capRate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold tracking-wide uppercase text-neutral-500">Cash-on-Cash</p>
                      <p className="text-sm font-semibold text-white">{pt.typicalReturns.cashOnCash}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            At a Glance
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            Returns comparison.
          </h2>

          <div className="border border-white/[0.05] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-xs font-semibold tracking-wide uppercase text-neutral-400 px-6 py-4">Property Type</th>
                    <th className="text-xs font-semibold tracking-wide uppercase text-neutral-400 px-6 py-4">Cap Rate</th>
                    <th className="text-xs font-semibold tracking-wide uppercase text-neutral-400 px-6 py-4">Cash-on-Cash</th>
                    <th className="text-xs font-semibold tracking-wide uppercase text-neutral-400 px-6 py-4">Appreciation</th>
                    <th className="text-xs font-semibold tracking-wide uppercase text-neutral-400 px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {allTypes.map((pt) => (
                    <tr key={pt.slug} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                            {iconMap[pt.icon] ? (
                              <span className="[&>svg]:h-4 [&>svg]:w-4">{iconMap[pt.icon]}</span>
                            ) : (
                              <Building2 className="h-4 w-4 text-cyan-400" />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-white">{pt.name}</span>
                        </div>
                      </td>
                      <td className="text-sm text-neutral-300 px-6 py-4">{pt.typicalReturns.capRate}</td>
                      <td className="text-sm text-neutral-300 px-6 py-4">{pt.typicalReturns.cashOnCash}</td>
                      <td className="text-sm text-neutral-300 px-6 py-4">{pt.typicalReturns.appreciation}</td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/property-types/${pt.slug}`}
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Learn more
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            Analyze any
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              property type.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you the tools and intelligence to evaluate deals
            across every property type, from single-family homes to commercial
            assets.
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
