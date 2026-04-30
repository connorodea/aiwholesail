import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowRight,
  Clock,
  BookOpen,
  Mail,
  Sparkles,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import blogIndex from '@/data/blog/index.json';

interface Article {
  slug?: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string | number;
  featured?: boolean;
  publishedAt?: string;
}

const articles: Article[] = [
  {
    title:
      'The Complete Guide to Finding Profitable Real Estate Deals in 2026',
    excerpt:
      'Market conditions have shifted dramatically. Learn the strategies top investors are using right now to source off-market deals and stay ahead of the competition in a tightening market.',
    category: 'Strategy',
    readTime: '12 min read',
    featured: true,
  },
  {
    title: 'How AI is Changing Real Estate Investing',
    excerpt:
      'From automated property analysis to predictive market modeling, artificial intelligence is reshaping how investors find and evaluate deals. Here is what you need to know.',
    category: 'AI & Tech',
    readTime: '8 min read',
  },
  {
    title: '5 Metrics Every Real Estate Investor Should Track',
    excerpt:
      'Cash-on-cash return, cap rate, and GRM are just the beginning. These five metrics separate profitable investors from those who leave money on the table.',
    category: 'Strategy',
    readTime: '6 min read',
  },
  {
    title: 'FSBO Properties: The Hidden Gold Mine for Investors',
    excerpt:
      'For-sale-by-owner listings are often overlooked by institutional buyers. Learn how to find them, approach sellers, and negotiate deals that work for both sides.',
    category: 'Market Insights',
    readTime: '7 min read',
  },
  {
    title: 'How to Calculate ARV Like a Pro',
    excerpt:
      'After-repair value is the foundation of every flip and wholesale deal. Master the comparable sales method and avoid the common mistakes that sink profit margins.',
    category: 'Beginner Guide',
    readTime: '9 min read',
  },
  {
    title: 'Building Your Cash Buyer List: A Step-by-Step Guide',
    excerpt:
      'A strong buyer list is the most valuable asset in wholesaling. This guide walks you through sourcing, qualifying, and maintaining a list that closes deals.',
    category: 'Beginner Guide',
    readTime: '10 min read',
  },
  {
    title: 'Understanding Spread: The Key Metric for Deal Analysis',
    excerpt:
      'Spread determines whether a deal is worth pursuing. Learn how to calculate it accurately, what margins to target, and when to walk away from a property.',
    category: 'Market Insights',
    readTime: '5 min read',
  },
];

const categoryColors: Record<string, string> = {
  Strategy: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'AI & Tech': 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  'Market Insights': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Beginner Guide': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export default function Blog() {
  // Merge dynamic articles from JSON manifest with hardcoded fallbacks
  const dynamicArticles: Article[] = (blogIndex.articles || []).map((a: any) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    category: a.category,
    readTime: `${a.readTime} min read`,
    featured: a.featured || false,
    publishedAt: a.publishedAt,
  }));

  const allArticles = [
    ...dynamicArticles,
    ...articles.filter(
      (a) => !dynamicArticles.some((d) => d.title === a.title)
    ),
  ];

  const featuredArticle = allArticles.find((a) => a.featured);
  const gridArticles = allArticles.filter((a) => !a.featured);

  return (
    <PublicLayout>
      <SEOHead
        title="Resources & Insights"
        description="Expert guides, market insights, and strategies for real estate professionals. Learn how to find profitable deals with AI-powered analysis."
        keywords="real estate blog, investing guides, market insights, deal analysis, ARV calculator, wholesaling tips, real estate strategy"
      />

      {/* ===== HERO — DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-6xl px-4 pt-24 pb-20 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <BookOpen className="h-3 w-3 mr-1.5" /> Resources & Insights
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Expert guides for
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              smarter investing.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
            Market insights, deal analysis strategies, and actionable guides to
            help you find and close profitable real estate deals.
          </p>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== FEATURED ARTICLE — LIGHT ===== */}
      {featuredArticle && (
        <section className="py-24 px-4 bg-[#08090a]">
          <div className="container mx-auto max-w-6xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Featured</p>
            <Link to={featuredArticle?.slug ? `/blog/${featuredArticle.slug}` : '/blog'} className="block group">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-8 md:p-12 transition-all duration-300 hover:border-primary/20">
                <div className="grid md:grid-cols-5 gap-8 items-center">
                  <div className="md:col-span-3">
                    <div className="flex items-center gap-3 mb-4">
                      <Badge className="bg-primary/10 text-primary border-0 text-xs font-medium">
                        Featured
                      </Badge>
                      <Badge
                        className={`text-xs font-medium border-0 ${
                          categoryColors[featuredArticle.category] || ''
                        }`}
                      >
                        {featuredArticle.category}
                      </Badge>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 group-hover:text-primary transition-colors">
                      {featuredArticle.title}
                    </h2>
                    <p className="text-neutral-400 font-light leading-relaxed mb-6">
                      {featuredArticle.excerpt}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-sm text-neutral-400">
                        <Clock className="h-3.5 w-3.5" />
                        {featuredArticle.readTime}
                      </span>
                      <span className="text-sm font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read article
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-border/30 flex items-center justify-center">
                      <div className="text-center">
                        <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-3" />
                        <span className="text-xs text-neutral-400/60 font-light">
                          Featured article
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ===== ARTICLE GRID — LIGHT ===== */}
      <section className="py-24 px-4 bg-[#08090a]">
        <div className="container mx-auto max-w-6xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Latest Articles</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-16">
            Insights to sharpen your edge.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gridArticles.map((article, index) => (
              <Link to={article.slug ? `/blog/${article.slug}` : '/blog'} key={index} className="group">
                <article className="h-full bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 transition-all duration-300 hover:border-primary/20 flex flex-col">
                  {/* Image Placeholder */}
                  <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-muted/80 to-muted/50 border border-border/30 mb-5 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-neutral-400/30" />
                  </div>

                  {/* Category + Read Time */}
                  <div className="flex items-center justify-between mb-3">
                    <Badge
                      className={`text-xs font-medium border-0 ${
                        categoryColors[article.category] || ''
                      }`}
                    >
                      {article.category}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <Clock className="h-3 w-3" />
                      {article.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold tracking-tight mb-2 group-hover:text-primary transition-colors leading-snug">
                    {article.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-sm text-neutral-400 font-light leading-relaxed mb-4 flex-1">
                    {article.excerpt}
                  </p>

                  {/* Read More */}
                  <span className="text-sm font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all mt-auto">
                    Read more
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== NEWSLETTER CTA — DARK ===== */}
      <section className="relative bg-[#0a0a0a] text-white py-24 px-4 overflow-hidden">
        <div className="relative container mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 mx-auto mb-6">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Stay Informed</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Get weekly deal insights.
          </h2>
          <p className="text-lg text-white/60 font-light leading-relaxed max-w-xl mx-auto mb-10">
            Join thousands of investors who receive our weekly newsletter with
            market analysis, deal breakdowns, and actionable investing
            strategies.
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <Input
              type="email"
              placeholder="you@example.com"
              className="h-12 bg-white/5 border-white/10 text-white text-base placeholder:text-white/30 focus:border-primary"
              aria-label="Email address for newsletter"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 px-8 text-base font-semibold shrink-0 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2"
            >
              Subscribe
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-xs text-white/30 font-light mt-4">
            Free forever. Unsubscribe anytime. No spam.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
