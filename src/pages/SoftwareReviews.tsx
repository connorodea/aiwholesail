import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Star, Search, ChevronRight, Shield, Filter,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import softwareReviews from '@/data/software-reviews.json';

interface SoftwareReview {
  slug: string;
  name: string;
  category: string;
  rating: number;
  pricing: string;
  founded: string;
  bestFor: string;
  overview: string;
  pros: string[];
  cons: string[];
  features: string[];
  vsAIWholesail: {
    aiWholesailAdvantages: string[];
    competitorAdvantages: string[];
  };
  verdict: string;
  relatedReviews: string[];
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
      ))}
      {hasHalf && (
        <div className="relative">
          <Star className="h-4 w-4 text-neutral-600" />
          <div className="absolute inset-0 overflow-hidden w-[50%]">
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
          </div>
        </div>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className="h-4 w-4 text-neutral-600" />
      ))}
      <span className="ml-1.5 text-xs font-semibold text-neutral-400">{rating}/5</span>
    </div>
  );
}

export default function SoftwareReviews() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const reviews = softwareReviews as SoftwareReview[];

  const categories = useMemo(() => {
    const cats = Array.from(new Set(reviews.map((r) => r.category)));
    return ['All', ...cats.sort()];
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    let filtered = [...reviews];

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((r) => r.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.category.toLowerCase().includes(query) ||
          r.bestFor.toLowerCase().includes(query) ||
          r.features.some((f) => f.toLowerCase().includes(query))
      );
    }

    // Sort by rating descending
    filtered.sort((a, b) => b.rating - a.rating);

    return filtered;
  }, [reviews, selectedCategory, searchQuery]);

  return (
    <PublicLayout>
      <SEOHead
        title="Best Wholesaling Software Reviews 2026 -- Honest Comparisons"
        description="Honest reviews of the top real estate wholesaling software in 2026. Compare PropStream, BatchLeads, DealMachine, REsimpli, and more. Find the best tool for your investing strategy."
        keywords="best wholesaling software, real estate investing software reviews, PropStream review, BatchLeads review, DealMachine review, wholesaling CRM, best real estate investor tools 2026"
        canonicalUrl="https://aiwholesail.com/reviews"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Software Reviews', url: 'https://aiwholesail.com/reviews' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-16 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">SOFTWARE REVIEWS</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Wholesaling Software
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Reviews 2026.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Honest, in-depth reviews of the top real estate investing tools. Pricing, pros & cons, and how each compares to AI-powered alternatives.
          </p>
        </div>
      </section>

      {/* ===== SEARCH & FILTER ===== */}
      <section className="py-8 px-4 border-b border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search software by name, category, or feature..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
              />
            </div>

            {/* Category Filter */}
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
            Showing {filteredReviews.length} of {reviews.length} reviews -- sorted by rating
          </p>
        </div>
      </section>

      {/* ===== REVIEWS GRID ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          {filteredReviews.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg text-neutral-400 mb-2">No reviews match your search.</p>
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
            <div className="grid gap-4">
              {filteredReviews.map((review) => (
                <Link
                  key={review.slug}
                  to={`/reviews/${review.slug}`}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8 hover:border-cyan-500/20 transition-all duration-300 group"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Left: Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider px-2.5 py-1 bg-cyan-500/10 rounded-md">
                          {review.category}
                        </span>
                        <span className="text-xs text-neutral-500">Founded {review.founded}</span>
                      </div>

                      <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                        {review.name} Review
                      </h3>

                      <StarRating rating={review.rating} />

                      <p className="text-sm text-neutral-400 font-light mt-3 line-clamp-2 leading-relaxed">
                        {review.bestFor}
                      </p>

                      {/* Feature tags */}
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {review.features.slice(0, 4).map((feature, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 text-[11px] border border-white/[0.06] bg-white/[0.02] rounded text-neutral-500"
                          >
                            {feature}
                          </span>
                        ))}
                        {review.features.length > 4 && (
                          <span className="px-2 py-1 text-[11px] text-neutral-600">
                            +{review.features.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Pricing & CTA */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-4 md:min-w-[140px]">
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{review.pricing}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-cyan-400 group-hover:text-cyan-300 transition-colors">
                        Read Review
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
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
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Skip the Comparison</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Why compare when you can
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              just use the best?
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail combines AI deal scoring, lead generation, CRM, and analysis in one platform starting at $29/month. No credit card required.
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
