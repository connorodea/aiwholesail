import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, BookOpen, ChevronRight, Clock,
  Shield, CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import guides from '@/data/guides.json';

interface GuideSection {
  heading: string;
  content: string;
}

interface Guide {
  slug: string;
  title: string;
  h1: string;
  description: string;
  keywords: string;
  category: string;
  readTime: string;
  sections: GuideSection[];
  relatedTools: string[];
  relatedGuides: string[];
  relatedMarkets: string[];
}

const categoryColors: Record<string, string> = {
  'Beginner Guide': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Wholesaling: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Strategy: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Deal Analysis': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Deal Finding': 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function Guides() {
  const allGuides = guides as Guide[];

  return (
    <PublicLayout>
      <SEOHead
        title="Real Estate Investing Guides -- Free Expert Resources"
        description="Free real estate investing guides covering wholesaling, BRRRR, deal analysis, passive investing, LLCs, and off-market deal finding. Learn from expert resources."
        keywords="real estate investing guides, wholesale real estate guide, BRRRR guide, real estate deal analysis, how to invest in real estate, real estate education"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Guides
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Expert Real Estate
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Investing Guides.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Free in-depth guides covering every strategy, from wholesaling and
            BRRRR to deal analysis and passive investing.
          </p>
        </div>
      </section>

      {/* ===== GUIDE GRID ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-sm text-neutral-400 font-light mb-8">
            {allGuides.length} guide{allGuides.length !== 1 ? 's' : ''}{' '}
            available
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allGuides.map((guide) => (
              <Link
                key={guide.slug}
                to={`/guides/${guide.slug}`}
                className="group"
              >
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] border ${
                        categoryColors[guide.category] ||
                        'border-white/[0.08] text-neutral-400'
                      }`}
                    >
                      {guide.category}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Read <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {guide.title}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed mb-5 flex-1">
                    {guide.description}
                  </p>

                  <div className="flex items-center gap-4 pt-4 border-t border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <Clock className="h-3 w-3" />
                      {guide.readTime} read
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <BookOpen className="h-3 w-3" />
                      {guide.sections.length} sections
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Go Further
          </p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Ready to find
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              your first deal?
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you AI-powered deal scoring, instant comps,
            automated outreach, and free calculators -- everything from these
            guides, built into one platform.
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
