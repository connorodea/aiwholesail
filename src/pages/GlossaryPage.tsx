import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, BookOpen, ChevronRight, ExternalLink,
  Shield, CheckCircle, Tag, Layers,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
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

export default function GlossaryPage() {
  const { slug } = useParams<{ slug: string }>();
  const term = (glossary as GlossaryTerm[]).find((t) => t.slug === slug);

  if (!term) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Term Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find that glossary term.</p>
          <Link to="/glossary">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <BookOpen className="h-4 w-4" /> Browse Glossary
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const descriptionText = term.definition.length > 155
    ? term.definition.slice(0, 155).replace(/\s+\S*$/, '...')
    : term.definition;

  const keywordParts = [term.term];
  if (term.abbr) keywordParts.push(term.abbr);
  keywordParts.push(term.category, 'real estate investing glossary');
  const keywords = keywordParts.join(', ');

  const relatedTermObjects = term.relatedTerms
    .map((rs) => (glossary as GlossaryTerm[]).find((g) => g.slug === rs))
    .filter(Boolean) as GlossaryTerm[];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is ${term.term}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: term.definition,
        },
      },
    ],
  };

  return (
    <PublicLayout>
      <SEOHead
        title={`${term.term} — Real Estate Investing Glossary | AIWholesail`}
        description={descriptionText}
        keywords={keywords}
      />

      {/* FAQ Schema for featured snippets */}
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/glossary" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <BookOpen className="h-4 w-4" />
              <span>Glossary</span>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <Badge variant="outline" className="text-xs border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
              <Layers className="h-3 w-3 mr-1" />
              {term.category}
            </Badge>
            {term.abbr && (
              <Badge variant="outline" className="text-xs border border-white/[0.12] bg-white/[0.04] text-white/70">
                <Tag className="h-3 w-3 mr-1" />
                {term.abbr}
              </Badge>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {term.term}
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {descriptionText}
          </p>
        </div>
      </section>

      {/* ===== DEFINITION ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Definition</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            What is {term.term}?
          </h2>
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <p className="text-base md:text-lg text-neutral-300 leading-relaxed font-light">
              {term.definition}
            </p>
          </div>
        </div>
      </section>

      {/* ===== RELATED TOOL CTA ===== */}
      {term.relatedTool && (
        <section className="py-8 px-4">
          <div className="container mx-auto max-w-3xl">
            <Link to={term.relatedTool} className="group block">
              <div className="border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent rounded-xl p-8 hover:border-cyan-500/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-2">Free Tool</p>
                    <h3 className="text-xl font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                      Try our {term.term} calculator
                    </h3>
                    <p className="text-sm text-neutral-400 font-light">
                      Run the numbers yourself with our free, no-signup-required tool.
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-cyan-400">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ===== RELATED TERMS ===== */}
      {relatedTermObjects.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Related Terms</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
              Related concepts.
            </h2>
            <div className="grid gap-4">
              {relatedTermObjects.map((rt) => (
                <Link key={rt.slug} to={`/glossary/${rt.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                          {rt.term}
                        </h3>
                        {rt.abbr && (
                          <Badge variant="outline" className="text-[10px] border-white/[0.08] text-neutral-400">
                            {rt.abbr}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-400 font-light truncate">
                        {rt.definition.split('.')[0]}.
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-cyan-400 transition-colors ml-4 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== BROWSE MORE ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to="/glossary" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Full Glossary
              </Link>
              <Link to="/tools" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <ExternalLink className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
              <Link to="/blog" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Blog & Guides
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
            Put your knowledge
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              into action.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail turns real estate investing concepts into profitable deals with AI-powered deal scoring, instant comps, and automated seller outreach.
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
