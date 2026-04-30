import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  BookOpen,
  Mail,
  Sparkles,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title="Resources & Insights"
        description="Expert guides, market insights, and strategies for real estate professionals. Learn how to find profitable deals with AI-powered analysis."
        keywords="real estate blog, investing guides, market insights, deal analysis, ARV calculator, wholesaling tips, real estate strategy"
      />

      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
              <div className="text-lg font-semibold">Blog</div>
              <div className="w-20" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge
            variant="secondary"
            className="mb-6 px-4 py-1.5 text-sm font-medium bg-primary/10 text-primary border-0"
          >
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Resources & Insights
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-6">
            Expert guides for{' '}
            <span className="text-primary">smarter investing</span>
          </h1>
          <p className="text-lg text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto">
            Market insights, deal analysis strategies, and actionable guides to
            help you find and close profitable real estate deals.
          </p>
        </div>
      </section>

      {/* Featured Article */}
      {featuredArticle && (
        <section className="pb-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <Link to={featuredArticle?.slug ? `/blog/${featuredArticle.slug}` : '/blog'} className="block group">
              <div className="bg-card/50 border border-border/50 rounded-2xl p-8 md:p-12 transition-all duration-200 hover:border-primary/20 hover:shadow-lg">
                <div className="grid md:grid-cols-5 gap-8 items-center">
                  {/* Text Content */}
                  <div className="md:col-span-3">
                    <div className="flex items-center gap-3 mb-4">
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium border-0 bg-primary/10 text-primary"
                      >
                        Featured
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs font-medium border-0 ${
                          categoryColors[featuredArticle.category] || ''
                        }`}
                      >
                        {featuredArticle.category}
                      </Badge>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-medium tracking-tight mb-4 group-hover:text-primary transition-colors">
                      {featuredArticle.title}
                    </h2>
                    <p className="text-muted-foreground font-light leading-relaxed mb-6">
                      {featuredArticle.excerpt}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {featuredArticle.readTime}
                      </span>
                      <span className="text-sm font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read article
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Visual Placeholder */}
                  <div className="md:col-span-2">
                    <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-border/30 flex items-center justify-center">
                      <div className="text-center">
                        <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-3" />
                        <span className="text-xs text-muted-foreground/60 font-light">
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

      {/* Article Grid */}
      <section className="pb-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
            Latest articles
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gridArticles.map((article, index) => (
              <Link to={article.slug ? `/blog/${article.slug}` : '/blog'} key={index} className="group">
                <article className="h-full bg-card/50 border border-border/50 rounded-2xl p-6 transition-all duration-200 hover:border-primary/20 hover:shadow-lg flex flex-col">
                  {/* Image Placeholder */}
                  <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/30 mb-5 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-muted-foreground/30" />
                  </div>

                  {/* Category + Read Time */}
                  <div className="flex items-center justify-between mb-3">
                    <Badge
                      variant="secondary"
                      className={`text-xs font-medium border-0 ${
                        categoryColors[article.category] || ''
                      }`}
                    >
                      {article.category}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {article.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-medium tracking-tight mb-2 group-hover:text-primary transition-colors leading-snug">
                    {article.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-sm text-muted-foreground font-light leading-relaxed mb-4 flex-1">
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

      {/* Newsletter CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-card/50 border border-border/50 rounded-2xl p-12 md:p-16 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-6">
              <Mail className="h-7 w-7" />
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">
              Get weekly deal{' '}
              <span className="text-primary">insights</span>
            </h2>
            <p className="text-muted-foreground font-light leading-relaxed max-w-xl mx-auto mb-8">
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
                className="h-12 bg-background/50 border-border/50 text-base"
                aria-label="Email address for newsletter"
              />
              <Button
                type="submit"
                size="lg"
                className="h-12 px-8 text-base font-medium shrink-0"
              >
                Subscribe
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground font-light mt-4">
              Free forever. Unsubscribe anytime. No spam.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
