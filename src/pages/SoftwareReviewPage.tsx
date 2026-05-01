import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight, Check, X, Star, Shield, ChevronRight,
  DollarSign, Calendar, Target, Award, Zap,
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
    <div className="flex items-center gap-1">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} className="h-5 w-5 fill-yellow-500 text-yellow-500" />
      ))}
      {hasHalf && (
        <div className="relative">
          <Star className="h-5 w-5 text-neutral-600" />
          <div className="absolute inset-0 overflow-hidden w-[50%]">
            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
          </div>
        </div>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className="h-5 w-5 text-neutral-600" />
      ))}
      <span className="ml-2 text-sm font-semibold text-white">{rating}/5</span>
    </div>
  );
}

export default function SoftwareReviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const review = (softwareReviews as SoftwareReview[]).find((r) => r.slug === slug);

  if (!review) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Review Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this software review.</p>
          <Link to="/reviews">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              Browse All Reviews
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const relatedReviewData = (softwareReviews as SoftwareReview[]).filter((r) =>
    review.relatedReviews.includes(r.slug)
  );

  return (
    <PublicLayout>
      <SEOHead
        title={`${review.name} Review 2026 -- Is It Worth It?`}
        description={`Honest ${review.name} review for 2026. ${review.pricing} pricing, pros & cons, features, and how it compares to AIWholesail. Read before you buy.`}
        keywords={`${review.name} review, ${review.name} review 2026, ${review.name} pricing, ${review.name} pros cons, ${review.name} vs AIWholesail, best wholesaling software, ${review.name} alternative`}
        canonicalUrl={`https://aiwholesail.com/reviews/${review.slug}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Software Reviews', url: 'https://aiwholesail.com/reviews' },
          { name: `${review.name} Review`, url: `https://aiwholesail.com/reviews/${review.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          {/* Breadcrumbs */}
          <nav className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 mb-8">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/reviews" className="hover:text-white transition-colors">Reviews</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-400">{review.name}</span>
          </nav>

          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">SOFTWARE REVIEW</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {review.name} Review 2026
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Is It Worth It?
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light mb-8">
            {review.category} -- {review.pricing}. An honest breakdown of features, pricing, and how it stacks up against the competition.
          </p>
          <div className="flex justify-center">
            <StarRating rating={review.rating} />
          </div>
        </div>
      </section>

      {/* ===== QUICK FACTS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-6">Quick Facts</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <DollarSign className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Pricing</span>
                </div>
                <p className="text-sm font-semibold text-white">{review.pricing}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Award className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Category</span>
                </div>
                <p className="text-sm font-semibold text-white">{review.category}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Founded</span>
                </div>
                <p className="text-sm font-semibold text-white">{review.founded}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Target className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Rating</span>
                </div>
                <p className="text-sm font-semibold text-white">{review.rating}/5</p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/[0.06]">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Best For</span>
                  <p className="text-sm text-white mt-1">{review.bestFor}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== OVERVIEW ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Overview</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6">
            What is {review.name}?
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed font-light">
            {review.overview}
          </p>
        </div>
      </section>

      {/* ===== PROS & CONS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Pros & Cons</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-10">
            The good and the bad.
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pros */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Pros</h3>
              </div>
              <ul className="space-y-3.5">
                {review.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300 font-light leading-relaxed">{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <X className="h-4 w-4 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Cons</h3>
              </div>
              <ul className="space-y-3.5">
                {review.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300 font-light leading-relaxed">{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            What {review.name} offers.
          </h2>
          <div className="flex flex-wrap gap-3">
            {review.features.map((feature, i) => (
              <div
                key={i}
                className="px-4 py-2.5 border border-white/[0.06] bg-white/[0.02] rounded-lg text-sm text-neutral-300 font-light hover:border-cyan-500/20 transition-colors"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== VS AIWHOLESAIL ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Head to Head</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            {review.name} vs AIWholesail.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            How AIWholesail compares on the features that matter most to investors.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* AIWholesail Advantages */}
            <div className="border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">AIWholesail Advantages</h3>
              </div>
              <ul className="space-y-3.5">
                {review.vsAIWholesail.aiWholesailAdvantages.map((adv, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300 font-light leading-relaxed">{adv}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Competitor Advantages */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                  <Award className="h-4 w-4 text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{review.name} Advantages</h3>
              </div>
              <ul className="space-y-3.5">
                {review.vsAIWholesail.competitorAdvantages.map((adv, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-400 font-light leading-relaxed">{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== VERDICT ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 md:p-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Our Verdict</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6">
              The bottom line.
            </h2>
            <p className="text-base text-neutral-400 leading-relaxed font-light mb-8">
              {review.verdict}
            </p>
            <Link to="/pricing">
              <button className="inline-flex items-center gap-2 px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold rounded-md transition-colors">
                Try AIWholesail Free <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== RELATED REVIEWS ===== */}
      {relatedReviewData.length > 0 && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Related Reviews</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
              Compare more software.
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedReviewData.map((related) => (
                <Link
                  key={related.slug}
                  to={`/reviews/${related.slug}`}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{related.category}</span>
                    <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {related.name} Review
                  </h3>
                  <div className="flex items-center gap-2 mb-3">
                    <StarRating rating={related.rating} />
                  </div>
                  <p className="text-xs text-neutral-500">{related.pricing}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Ready to Switch?</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Skip the guesswork.
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Let AI find your deals.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            Start your 7-day free trial. No credit card required. See why investors are switching to AIWholesail.
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

      {/* ===== SCHEMA MARKUP ===== */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Review",
            "itemReviewed": {
              "@type": "SoftwareApplication",
              "name": review.name,
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": review.pricing.replace(/[^0-9.]/g, ''),
                "priceCurrency": "USD",
              },
            },
            "reviewRating": {
              "@type": "Rating",
              "ratingValue": review.rating,
              "bestRating": 5,
              "worstRating": 1,
            },
            "author": {
              "@type": "Organization",
              "name": "AIWholesail",
              "url": "https://aiwholesail.com",
            },
            "publisher": {
              "@type": "Organization",
              "name": "AIWholesail",
              "url": "https://aiwholesail.com",
            },
            "datePublished": "2026-01-15",
            "dateModified": "2026-04-30",
          }),
        }}
      />
    </PublicLayout>
  );
}
