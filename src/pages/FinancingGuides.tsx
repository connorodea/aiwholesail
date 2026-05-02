import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Search, ChevronRight, Shield, Star, Filter,
  Banknote, Users, TrendingUp, Building2, Home, Handshake,
  ArrowLeftRight, Repeat, Landmark, Library, Building, ArrowRightLeft,
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
  calculatorLink: string;
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

export default function FinancingGuides() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const guides = financingGuides as FinancingGuide[];

  const categories = useMemo(() => {
    const cats = Array.from(new Set(guides.map((g) => g.category)));
    return ['All', ...cats.sort()];
  }, [guides]);

  const filteredGuides = useMemo(() => {
    let filtered = [...guides];

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((g) => g.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.category.toLowerCase().includes(query) ||
          g.description.toLowerCase().includes(query) ||
          g.keywords.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [guides, selectedCategory, searchQuery]);

  return (
    <PublicLayout>
      <SEOHead
        title="Real Estate Financing Guides -- Loans, Creative Financing & More"
        description="Complete financing guides for real estate investors. Hard money loans, DSCR loans, seller financing, FHA house hacking, bridge loans, and more. Rates, terms, and how to qualify."
        keywords="real estate financing, hard money loans, DSCR loans, seller financing, creative financing, bridge loans, FHA house hacking, investment property loans, real estate loan guide"
        canonicalUrl="https://aiwholesail.com/financing"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Financing Guides', url: 'https://aiwholesail.com/financing' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-16 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">FINANCING GUIDES</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Real Estate
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Financing Guides.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Everything investors need to know about funding deals. From hard money and DSCR loans to creative seller financing and subject-to strategies.
          </p>
        </div>
      </section>

      {/* ===== SEARCH & FILTER ===== */}
      <section className="py-8 px-4 border-b border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search financing types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-10 pr-10 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/30 transition-colors cursor-pointer min-w-[220px]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-neutral-900 text-white">
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 rotate-90 pointer-events-none" />
            </div>
          </div>

          <p className="text-xs text-neutral-500 mt-3">
            Showing {filteredGuides.length} of {guides.length} financing types
          </p>
        </div>
      </section>

      {/* ===== GUIDES GRID ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          {filteredGuides.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg text-neutral-400 mb-2">No financing guides match your search.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGuides.map((guide) => (
                <Link
                  key={guide.slug}
                  to={`/financing/${guide.slug}`}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 group flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <GuideIcon name={guide.icon} className="h-5 w-5 text-cyan-400" />
                    </div>
                    <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider px-2 py-1 border border-white/[0.06] rounded">
                      {guide.category}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {guide.name}
                  </h3>

                  <p className="text-sm text-neutral-400 font-light leading-relaxed line-clamp-3 mb-4 flex-1">
                    {guide.overview.slice(0, 150)}...
                  </p>

                  {/* Quick terms */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-white/[0.02] rounded-md px-3 py-2">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Rate</span>
                      <span className="text-xs font-semibold text-white">{guide.typicalTerms.interestRate}</span>
                    </div>
                    <div className="bg-white/[0.02] rounded-md px-3 py-2">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Down</span>
                      <span className="text-xs font-semibold text-white">{guide.typicalTerms.downPayment}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-cyan-400 group-hover:text-cyan-300 transition-colors">
                    Read Full Guide
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Find Deals That Pencil</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            The financing only works
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              if the deal is right.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail uses AI to find and analyze deals that work with any financing strategy. Calculate spreads, run comps, and close with confidence.
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
