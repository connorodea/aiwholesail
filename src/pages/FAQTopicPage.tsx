import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Plus, Minus, ChevronRight, BookOpen,
  Calculator, Shield, CheckCircle, HelpCircle, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import faqTopics from '@/data/faq-topics.json';

interface Question {
  question: string;
  answer: string;
}

interface FAQTopic {
  slug: string;
  title: string;
  h1: string;
  description: string;
  keywords: string;
  category: string;
  questions: Question[];
}

const categoryIcons: Record<string, string> = {
  Wholesaling: '🔄',
  'House Flipping': '🏗',
  'Rental Property': '🏠',
  'BRRRR Method': '♻️',
  Financing: '💰',
  Taxes: '📊',
  'Getting Started': '🎯',
  Technology: '🤖',
};

const relatedGuides: Record<string, { label: string; href: string }[]> = {
  'wholesaling-faq': [
    { label: 'Wholesaling Beginner Guide', href: '/guides/how-to-wholesale-real-estate' },
    { label: 'Wholesale Deal Calculator', href: '/tools/wholesale-deal-calculator' },
    { label: 'State Wholesaling Laws', href: '/laws' },
  ],
  'house-flipping-faq': [
    { label: 'ARV Calculator', href: '/tools/arv-calculator' },
    { label: 'Rehab Estimator', href: '/tools/rehab-estimator' },
    { label: 'Holding Cost Calculator', href: '/tools/holding-cost-calculator' },
  ],
  'rental-property-faq': [
    { label: 'Cash Flow Calculator', href: '/tools/cash-flow-calculator' },
    { label: 'Cap Rate Calculator', href: '/tools/cap-rate-calculator' },
    { label: 'Rental ROI Calculator', href: '/tools/rental-roi-calculator' },
  ],
  'brrrr-method-faq': [
    { label: 'BRRRR Calculator', href: '/tools/brrrr-calculator' },
    { label: 'ARV Calculator', href: '/tools/arv-calculator' },
    { label: 'Rehab Estimator', href: '/tools/rehab-estimator' },
  ],
  'real-estate-financing-faq': [
    { label: 'Mortgage Calculator', href: '/tools/mortgage-calculator' },
    { label: 'DSCR Calculator', href: '/tools/dscr-calculator' },
    { label: 'Offer Price Calculator', href: '/tools/offer-price-calculator' },
  ],
  'real-estate-tax-faq': [
    { label: 'Cash Flow Calculator', href: '/tools/cash-flow-calculator' },
    { label: 'Rental ROI Calculator', href: '/tools/rental-roi-calculator' },
    { label: 'Real Estate Glossary', href: '/glossary' },
  ],
  'first-time-investor-faq': [
    { label: 'Investing for Beginners Guide', href: '/guides/real-estate-investing-for-beginners' },
    { label: 'Wholesale Deal Calculator', href: '/tools/wholesale-deal-calculator' },
    { label: 'All Free Tools', href: '/tools' },
  ],
  'real-estate-technology-faq': [
    { label: 'Software Reviews', href: '/reviews' },
    { label: 'All Free Tools', href: '/tools' },
    { label: 'How AIWholesail Works', href: '/how-it-works' },
  ],
};

export default function FAQTopicPage() {
  const { slug } = useParams<{ slug: string }>();
  const topic = (faqTopics as FAQTopic[]).find((t) => t.slug === slug);

  const [openItems, setOpenItems] = useState<number[]>([0]);

  // Respect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const heroFadeUp = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 8 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { duration: 1, ease: [0.25, 0.1, 0.25, 1] as const, delay },
        };

  const sectionFadeIn = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0 } as const,
        whileInView: { opacity: 1 } as const,
        viewport: { once: true, margin: '-50px' },
        transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const },
      };

  const toggleItem = (index: number) => {
    setOpenItems((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const expandAll = () => {
    if (topic) {
      setOpenItems(topic.questions.map((_, i) => i));
    }
  };

  const collapseAll = () => {
    setOpenItems([]);
  };

  if (!topic) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">FAQ Topic Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this FAQ topic.</p>
          <Link to="/faq/topics">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <ChevronRight className="h-4 w-4 rotate-180" /> Back to FAQ Topics
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const guides = relatedGuides[topic.slug] || [];

  return (
    <PublicLayout>
      <SEOHead
        title={topic.title}
        description={topic.description}
        keywords={topic.keywords}
        noIndex={false}
      />

      {/* FAQPage Schema (JSON-LD) -- critical for featured snippets */}
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: topic.questions.map((q) => ({
              '@type': 'Question',
              name: q.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: q.answer,
              },
            })),
          })}
        </script>
      </Helmet>

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          {/* Breadcrumb */}
          <nav className="flex items-center justify-center gap-2 text-xs text-neutral-500 mb-8">
            <Link to="/faq" className="hover:text-cyan-400 transition-colors">FAQ</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/faq/topics" className="hover:text-cyan-400 transition-colors">Topics</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-cyan-400">{topic.category}</span>
          </nav>

          <motion.div {...heroFadeUp(0)} className="flex items-center justify-center gap-2 mb-6">
            <Badge variant="outline" className="text-[10px] border border-cyan-500/20 text-cyan-400">
              {categoryIcons[topic.category] || '📋'} {topic.category}
            </Badge>
            <Badge variant="outline" className="text-[10px] border border-white/10 text-neutral-400">
              {topic.questions.length} Questions
            </Badge>
          </motion.div>

          <motion.h1
            {...heroFadeUp(0.1)}
            className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6"
          >
            {topic.h1.split(':')[0]}
            {topic.h1.includes(':') && (
              <>
                :
                <br />
                <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                  {topic.h1.split(':').slice(1).join(':')}
                </span>
              </>
            )}
          </motion.h1>

          <motion.p
            {...heroFadeUp(0.2)}
            className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light"
          >
            {topic.description}
          </motion.p>
        </div>
      </section>

      {/* ===== MAIN CONTENT ===== */}
      <motion.section className="py-16 px-4" {...sectionFadeIn}>
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-[1fr_300px] gap-12">
            {/* ===== Q&A Accordion ===== */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-2">
                    Questions & Answers
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {topic.questions.length} answers you need.
                  </h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="text-xs text-neutral-400 hover:text-cyan-400 transition-colors px-3 py-1.5 border border-white/[0.06] rounded-md"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    className="text-xs text-neutral-400 hover:text-cyan-400 transition-colors px-3 py-1.5 border border-white/[0.06] rounded-md"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {topic.questions.map((q, index) => (
                  <div
                    key={index}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden transition-all duration-300 hover:border-cyan-500/20"
                  >
                    <button
                      onClick={() => toggleItem(index)}
                      className="w-full px-4 sm:px-6 py-4 sm:py-5 text-left flex items-start justify-between gap-4"
                      aria-expanded={openItems.includes(index)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-neutral-500 font-mono mt-1 flex-shrink-0 w-6">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-base font-semibold tracking-tight pr-4">{q.question}</h3>
                      </div>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          openItems.includes(index) ? 'bg-cyan-500/10' : 'bg-white/[0.04]'
                        }`}
                      >
                        {openItems.includes(index) ? (
                          <Minus className="h-3.5 w-3.5 text-cyan-400" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-neutral-400" />
                        )}
                      </div>
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        openItems.includes(index)
                          ? 'max-h-[2000px] opacity-100'
                          : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="px-4 sm:px-6 pb-5 pl-[52px] sm:pl-[60px]">
                        <p className="text-neutral-400 font-light leading-relaxed text-[15px]">
                          {q.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== Sidebar ===== */}
            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              {/* Related Tools & Guides */}
              {guides.length > 0 && (
                <div className="border border-white/[0.06] rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold tracking-tight">Related Tools & Guides</h3>
                  </div>
                  <div className="space-y-2">
                    {guides.map((g) => (
                      <Link
                        key={g.href}
                        to={g.href}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-neutral-300 hover:text-cyan-400 hover:bg-white/[0.03] transition-all group"
                      >
                        <span>{g.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Other FAQ Topics */}
              <div className="border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold tracking-tight">More FAQ Topics</h3>
                </div>
                <div className="space-y-2">
                  {(faqTopics as FAQTopic[])
                    .filter((t) => t.slug !== topic.slug)
                    .slice(0, 5)
                    .map((t) => (
                      <Link
                        key={t.slug}
                        to={`/faq/${t.slug}`}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-neutral-300 hover:text-cyan-400 hover:bg-white/[0.03] transition-all group"
                      >
                        <span className="flex items-center gap-2">
                          <span>{categoryIcons[t.category] || '📋'}</span>
                          {t.category}
                        </span>
                        <span className="text-[10px] text-neutral-500">{t.questions.length} Q&A</span>
                      </Link>
                    ))}
                  <Link
                    to="/faq/topics"
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:underline mt-3 px-3"
                  >
                    View all topics <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Quick Links */}
              <div className="border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold tracking-tight">Resources</h3>
                </div>
                <div className="space-y-2">
                  <Link
                    to="/faq"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-neutral-300 hover:text-cyan-400 hover:bg-white/[0.03] transition-all"
                  >
                    General FAQ
                  </Link>
                  <Link
                    to="/guides"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-neutral-300 hover:text-cyan-400 hover:bg-white/[0.03] transition-all"
                  >
                    Investment Guides
                  </Link>
                  <Link
                    to="/glossary"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-neutral-300 hover:text-cyan-400 hover:bg-white/[0.03] transition-all"
                  >
                    Real Estate Glossary
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </motion.section>

      {/* ===== CTA ===== */}
      <motion.section className="bg-[#0a0a0a] text-white py-24 px-4" {...sectionFadeIn}>
        <div className="container mx-auto text-center max-w-3xl">
          <Sparkles className="h-8 w-8 text-cyan-400 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to put this knowledge to work?
          </h2>
          <p className="text-lg text-white/60 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you the AI-powered tools to find, analyze, and close real estate deals faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/pricing">
              <Button
                size="lg"
                className="rounded-full px-8 text-base font-semibold bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 gap-2"
              >
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/tools">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 text-base font-semibold border-white/20 text-white hover:bg-white/10"
              >
                Explore Free Tools
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-white/40 mt-8">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> No Credit Card Required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Cancel Anytime
            </span>
          </div>
        </div>
      </motion.section>
    </PublicLayout>
  );
}
