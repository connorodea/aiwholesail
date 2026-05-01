import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, BookOpen, ChevronRight, Clock, List,
  Calculator, MapPin, Shield, CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatToolName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatMarketName(slug: string): string {
  const parts = slug.split('-');
  const state = parts.pop()?.toUpperCase() || '';
  const city = parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `${city}, ${state}`;
}

function renderContent(content: string) {
  const paragraphs = content.split('\n\n');
  return paragraphs.map((para, i) => {
    // Process bold markers
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={j} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={j}>{part}</span>;
    });

    // Detect list items (lines starting with -)
    if (para.trim().startsWith('- ')) {
      const items = para.split('\n').filter((line) => line.trim().startsWith('- '));
      return (
        <ul key={i} className="list-disc list-inside space-y-2 text-neutral-300 font-light leading-relaxed">
          {items.map((item, k) => {
            const text = item.replace(/^-\s*/, '');
            const itemParts = text.split(/(\*\*[^*]+\*\*)/g);
            const itemRendered = itemParts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={j} className="text-white font-semibold">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={j}>{part}</span>;
            });
            return <li key={k}>{itemRendered}</li>;
          })}
        </ul>
      );
    }

    return (
      <p key={i} className="text-neutral-300 font-light leading-relaxed">
        {rendered}
      </p>
    );
  });
}

export default function GuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const guide = (guides as Guide[]).find((g) => g.slug === slug);

  if (!guide) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Guide Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this guide.</p>
          <Link to="/guides">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <BookOpen className="h-4 w-4" /> Browse All Guides
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const relatedGuideData = (guides as Guide[]).filter((g) =>
    guide.relatedGuides.includes(g.slug)
  );

  return (
    <PublicLayout>
      <SEOHead
        title={guide.title}
        description={guide.description}
        keywords={guide.keywords}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Guides', url: 'https://aiwholesail.com/guides' },
          { name: guide.title, url: `https://aiwholesail.com/guides/${guide.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link
              to="/guides"
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              <span>All Guides</span>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <Badge
              variant="outline"
              className="text-xs border-cyan-500/20 text-cyan-400"
            >
              {guide.category}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <Clock className="h-3 w-3" />
              {guide.readTime} read
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {guide.h1.split(':')[0]}
            {guide.h1.includes(':') && (
              <>
                <br />
                <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                  {guide.h1.split(':').slice(1).join(':').trim()}
                </span>
              </>
            )}
            {!guide.h1.includes(':') && '.'}
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {guide.description}
          </p>
        </div>
      </section>

      {/* ===== TABLE OF CONTENTS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <div className="flex items-center gap-2 mb-5">
              <List className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-bold tracking-tight text-white">
                Table of Contents
              </h2>
            </div>
            <nav className="space-y-2">
              {guide.sections.map((section, i) => (
                <a
                  key={i}
                  href={`#${slugify(section.heading)}`}
                  className="flex items-center gap-2 text-sm text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                >
                  <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                  {section.heading}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </section>

      {/* ===== CONTENT SECTIONS ===== */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-3xl space-y-16">
          {guide.sections.map((section, i) => (
            <div key={i} id={slugify(section.heading)}>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">
                {section.heading}
              </h2>
              <div className="space-y-4">{renderContent(section.content)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== RELATED RESOURCES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Related Resources
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            Keep learning.
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Related Tools */}
            {guide.relatedTools.length > 0 && (
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Free Tools
                  </h3>
                </div>
                <ul className="space-y-2">
                  {guide.relatedTools.map((tool) => (
                    <li key={tool}>
                      <Link
                        to={`/tools/${tool}`}
                        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                        {formatToolName(tool)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related Guides */}
            {relatedGuideData.length > 0 && (
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Related Guides
                  </h3>
                </div>
                <ul className="space-y-2">
                  {relatedGuideData.map((g) => (
                    <li key={g.slug}>
                      <Link
                        to={`/guides/${g.slug}`}
                        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                        {g.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related Markets */}
            {guide.relatedMarkets.length > 0 && (
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Related Markets
                  </h3>
                </div>
                <ul className="space-y-2">
                  {guide.relatedMarkets.map((market) => (
                    <li key={market}>
                      <Link
                        to={`/markets/${market}`}
                        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                        {formatMarketName(market)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            Put this knowledge
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              into action.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you AI-powered deal scoring, instant comps,
            automated outreach, and free calculators -- everything you need to
            find and close profitable deals.
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
