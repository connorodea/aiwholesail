import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, BookOpen, Search, ChevronRight, Layers,
  Tag, Shield, CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import glossary from '@/data/glossary.json';

interface GlossaryTerm {
  term: string;
  slug: string;
  abbr: string | null;
  definition: string;
  category: string;
  relatedTerms: string[];
  relatedTool: string | null;
}

const categoryColors: Record<string, string> = {
  Valuation: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Wholesaling: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Strategy: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Financing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Rental: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Process: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  Renovation: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Tax: 'bg-red-500/10 text-red-400 border-red-500/20',
  'Market Analysis': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Deal Finding': 'bg-lime-500/10 text-lime-400 border-lime-500/20',
  Marketing: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

function getFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : text;
}

export default function Glossary() {
  const [query, setQuery] = useState('');

  const allTerms = glossary as GlossaryTerm[];
  const termCount = allTerms.length;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allTerms;
    return allTerms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        (t.abbr && t.abbr.toLowerCase().includes(q)) ||
        t.category.toLowerCase().includes(q) ||
        t.slug.includes(q)
    );
  }, [query, allTerms]);

  // Group by category, categories sorted alphabetically, terms sorted alphabetically within each
  const grouped = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>();
    for (const t of filtered) {
      const existing = map.get(t.category) || [];
      existing.push(t);
      map.set(t.category, existing);
    }
    // Sort terms within each category
    for (const [, terms] of map) {
      terms.sort((a, b) => a.term.localeCompare(b.term));
    }
    // Sort categories alphabetically
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted;
  }, [filtered]);

  return (
    <PublicLayout>
      <SEOHead
        title={`Real Estate Investing Glossary — ${termCount} Terms Explained | AIWholesail`}
        description={`Learn ${termCount} essential real estate investing terms. Definitions for wholesaling, ARV, cap rate, BRRRR, fix and flip, and more — all explained for investors.`}
        keywords="real estate investing glossary, real estate terms, wholesaling glossary, ARV definition, cap rate definition, real estate investing definitions, BRRRR method definition"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Glossary</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Real Estate
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Investing Glossary.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {termCount} essential terms every real estate investor needs to know.
            From ARV to wholesaling, every concept explained clearly.
          </p>
        </div>
      </section>

      {/* ===== SEARCH ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search terms..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              />
            </div>
          </div>
          <p className="text-sm text-neutral-400 font-light mt-4">
            {filtered.length} term{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </section>

      {/* ===== GROUPED TERMS ===== */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          {grouped.map(([category, terms]) => (
            <div key={category} className="mb-14">
              <div className="flex items-center gap-3 mb-6">
                <Layers className="h-5 w-5 text-cyan-400" />
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                  {category}
                </h2>
                <Badge variant="outline" className="text-[10px] border-white/[0.08] text-neutral-400">
                  {terms.length}
                </Badge>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {terms.map((t) => (
                  <Link key={t.slug} to={`/glossary/${t.slug}`} className="group">
                    <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] border ${categoryColors[t.category] || 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'}`}
                          >
                            {t.category}
                          </Badge>
                          {t.abbr && (
                            <Badge variant="outline" className="text-[10px] border-white/[0.08] text-neutral-400">
                              <Tag className="h-2.5 w-2.5 mr-0.5" />
                              {t.abbr}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          View <ChevronRight className="h-3 w-3" />
                        </div>
                      </div>

                      <h3 className="text-lg font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                        {t.term}
                      </h3>
                      <p className="text-sm text-neutral-400 font-light leading-relaxed flex-1">
                        {getFirstSentence(t.definition)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <BookOpen className="h-10 w-10 text-neutral-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-white mb-2">No terms found</p>
              <p className="text-sm text-neutral-400 font-light">Try a different search term.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Go Further</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            From definitions
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              to deals.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail turns real estate investing knowledge into profitable deals with AI-powered deal scoring, instant comps, and automated outreach.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-cyan-400" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Cancel Anytime</span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
