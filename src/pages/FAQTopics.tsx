import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, ChevronRight, HelpCircle,
  Shield, CheckCircle,
} from 'lucide-react';
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

const categoryColors: Record<string, string> = {
  Wholesaling: 'border-cyan-500/20 text-cyan-400',
  'House Flipping': 'border-orange-500/20 text-orange-400',
  'Rental Property': 'border-green-500/20 text-green-400',
  'BRRRR Method': 'border-purple-500/20 text-purple-400',
  Financing: 'border-yellow-500/20 text-yellow-400',
  Taxes: 'border-blue-500/20 text-blue-400',
  'Getting Started': 'border-pink-500/20 text-pink-400',
  Technology: 'border-indigo-500/20 text-indigo-400',
};

export default function FAQTopics() {
  const allTopics = faqTopics as FAQTopic[];
  const totalQuestions = allTopics.reduce((sum, t) => sum + t.questions.length, 0);

  return (
    <PublicLayout>
      <SEOHead
        title="Real Estate FAQ Topics -- Answers to Every Investing Question"
        description="Browse 8 topic-specific FAQ hubs covering wholesaling, flipping, rentals, BRRRR, financing, taxes, getting started, and real estate technology. Over 130 expert answers."
        keywords="real estate faq, real estate investing questions, wholesaling faq, house flipping faq, rental property faq, brrrr faq, real estate financing faq"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          {/* Breadcrumb */}
          <nav className="flex items-center justify-center gap-2 text-xs text-neutral-500 mb-8">
            <Link to="/faq" className="hover:text-cyan-400 transition-colors">FAQ</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-cyan-400">Topics</span>
          </nav>

          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            FAQ Hub
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Every Question,
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Answered.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {totalQuestions} expert answers across {allTopics.length} real estate investing topics.
            Find exactly what you need.
          </p>
        </div>
      </section>

      {/* ===== TOPIC GRID ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-sm text-neutral-400 font-light mb-8">
            {allTopics.length} topics &middot; {totalQuestions} questions
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {allTopics.map((topic) => (
              <Link
                key={topic.slug}
                to={`/faq/${topic.slug}`}
                className="group"
              >
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">{categoryIcons[topic.category] || '📋'}</span>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] border mb-3 w-fit ${
                      categoryColors[topic.category] || 'border-cyan-500/20 text-cyan-400'
                    }`}
                  >
                    {topic.category}
                  </Badge>

                  <h3 className="text-lg font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {topic.title}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed mb-5 flex-1 line-clamp-3">
                    {topic.description}
                  </p>

                  <div className="flex items-center gap-2 pt-4 border-t border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <HelpCircle className="h-3 w-3" />
                      {topic.questions.length} questions
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== POPULAR QUESTIONS PREVIEW ===== */}
      <section className="py-16 px-4 border-t border-white/[0.04]">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Most Popular
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-12">
            Top questions across all topics.
          </h2>

          <div className="space-y-4">
            {allTopics.slice(0, 4).map((topic) => (
              <Link
                key={topic.slug}
                to={`/faq/${topic.slug}`}
                className="group block border border-white/[0.06] rounded-xl p-5 hover:border-cyan-500/20 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg">{categoryIcons[topic.category] || '📋'}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] border ${
                      categoryColors[topic.category] || 'border-cyan-500/20 text-cyan-400'
                    }`}
                  >
                    {topic.category}
                  </Badge>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {topic.questions.slice(0, 4).map((q, qi) => (
                    <p
                      key={qi}
                      className="text-sm text-neutral-400 font-light flex items-start gap-2"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-neutral-600 flex-shrink-0 mt-0.5" />
                      {q.question}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-cyan-400 mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  View all {topic.questions.length} answers <ChevronRight className="h-3 w-3" />
                </p>
              </Link>
            ))}
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
            Stop researching.
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Start investing.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you the AI-powered tools to find, analyze, and close
            your next deal.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" /> No Credit Card Required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Cancel Anytime
            </span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
