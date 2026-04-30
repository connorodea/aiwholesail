import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Zap, Check, X, ChevronRight,
  Calculator, BookOpen, Search, Shield, Star,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { GradientOrbs } from '@/components/effects/GradientOrbs';
import competitors from '@/data/competitors.json';

interface Competitor {
  slug: string;
  name: string;
  tagline: string;
  pricing: string;
  weaknesses: string[];
  aiwholesailAdvantages: string[];
}

interface FeatureRow {
  feature: string;
  aiwholesail: boolean | string;
  competitor: boolean | string;
}

function buildFeatureTable(comp: Competitor): FeatureRow[] {
  return [
    { feature: 'AI-Powered Deal Scoring', aiwholesail: true, competitor: false },
    { feature: 'Automated Property Analysis', aiwholesail: true, competitor: false },
    { feature: 'Off-Market Lead Generation', aiwholesail: true, competitor: comp.slug === 'batchleads' || comp.slug === 'dealmachine' },
    { feature: 'Comparable Sales / Comps', aiwholesail: true, competitor: comp.slug === 'propstream' || comp.slug === 'privy' },
    { feature: 'Skip Tracing', aiwholesail: true, competitor: comp.slug === 'batchleads' || comp.slug === 'dealmachine' },
    { feature: 'Seller Outreach Sequences', aiwholesail: true, competitor: comp.slug === 'dealmachine' || comp.slug === 'batchleads' },
    { feature: 'Deal Pipeline / CRM', aiwholesail: true, competitor: comp.slug === 'reipro' || comp.slug === 'wholesaler-inc' },
    { feature: 'Buyer Matching & Disposition', aiwholesail: true, competitor: comp.slug === 'investorlift' },
    { feature: 'Investment Calculators', aiwholesail: true, competitor: comp.slug === 'propstream' || comp.slug === 'reipro' },
    { feature: 'Market Intelligence Dashboard', aiwholesail: true, competitor: comp.slug === 'propstream' },
    { feature: 'Mobile-Optimized Interface', aiwholesail: true, competitor: comp.slug !== 'reipro' },
    { feature: 'Starting Price', aiwholesail: '$29/mo', competitor: comp.pricing },
  ];
}

export default function ComparisonPage() {
  const { slug } = useParams<{ slug: string }>();
  const comp = (competitors as Competitor[]).find((c) => c.slug === slug);

  if (!comp) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <h1 className="text-3xl font-bold mb-4">Comparison Not Found</h1>
        <p className="text-muted-foreground mb-6">We could not find this competitor comparison.</p>
        <Link to="/">
          <Button variant="outline" className="gap-2 rounded-full">
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  const features = buildFeatureTable(comp);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`AIWholesail vs ${comp.name} -- Better Alternative`}
        description={`Compare AIWholesail vs ${comp.name}. See why investors switch from ${comp.name} (${comp.pricing}) to AIWholesail's AI-powered deal scoring starting at $29/mo.`}
        keywords={`AIWholesail vs ${comp.name}, ${comp.name} alternative, ${comp.name} competitor, best wholesale real estate software, ${comp.name} review, better than ${comp.name}`}
      />

      {/* ===== HERO -- DARK ===== */}
      <section className="relative bg-[#0a0a0a] text-white overflow-hidden">
        <GradientOrbs variant="hero" />

        {/* Nav */}
        <div className="relative container mx-auto max-w-7xl px-4 pt-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
              <span>AIWholesail</span>
            </Link>
            <Link to="/pricing">
              <Button size="sm" className="rounded-full px-5 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Zap className="h-3.5 w-3.5" /> Start Free Trial
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative container mx-auto max-w-5xl px-4 pt-20 pb-24 text-center">
          <Badge variant="outline" className="mb-6 text-xs border-white/20 text-white/60">
            Comparison
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] mb-6">
            AIWholesail vs
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              {comp.name}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {comp.name}: {comp.tagline}. See how AIWholesail delivers more features, AI-powered analysis, and a lower price point.
          </p>
        </div>

        <div className="h-20 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Feature Comparison</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">
            Side-by-side breakdown.
          </h2>

          <div className="bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-border/50 bg-muted/30">
              <div className="text-sm font-semibold">Feature</div>
              <div className="text-sm font-semibold text-center text-primary">AIWholesail</div>
              <div className="text-sm font-semibold text-center text-muted-foreground">{comp.name}</div>
            </div>

            {/* Rows */}
            {features.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 gap-4 px-6 py-4 ${i < features.length - 1 ? 'border-b border-border/30' : ''}`}
              >
                <div className="text-sm font-light">{row.feature}</div>
                <div className="flex justify-center">
                  {typeof row.aiwholesail === 'boolean' ? (
                    row.aiwholesail ? (
                      <Check className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30" />
                    )
                  ) : (
                    <span className="text-sm font-semibold text-primary">{row.aiwholesail}</span>
                  )}
                </div>
                <div className="flex justify-center">
                  {typeof row.competitor === 'boolean' ? (
                    row.competitor ? (
                      <Check className="h-5 w-5 text-muted-foreground/50" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30" />
                    )
                  ) : (
                    <span className="text-sm font-light text-muted-foreground">{row.competitor}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY SWITCH ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Why Switch</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 max-w-lg">
            Why investors choose AIWholesail.
          </h2>
          <p className="text-muted-foreground font-light mb-10 max-w-xl">
            Every advantage you get when you switch from {comp.name} to AIWholesail.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comp.aiwholesailAdvantages.map((adv, i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 rounded-3xl p-7 hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Check className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium leading-relaxed">{adv}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPETITOR WEAKNESSES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">{comp.name} Limitations</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 max-w-lg">
            Where {comp.name} falls short.
          </h2>
          <p className="text-muted-foreground font-light mb-10 max-w-xl">
            Common complaints from {comp.name} users that AIWholesail solves.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comp.weaknesses.map((w, i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 rounded-3xl p-7 hover:border-red-500/10 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                  <X className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-sm font-light leading-relaxed text-muted-foreground">{w}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 bg-muted/30 border border-border/50 rounded-2xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-primary mb-4">Explore More</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to="/tools" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50">
                <Calculator className="h-4 w-4 text-primary" /> Free Calculators
              </Link>
              <Link to="/blog" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50">
                <BookOpen className="h-4 w-4 text-primary" /> Blog & Guides
              </Link>
              <Link to="/use-cases" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50">
                <Search className="h-4 w-4 text-primary" /> Use Cases
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA -- DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#0f1a14] text-white py-32 px-4 overflow-hidden">
        <GradientOrbs variant="cta" />

        <div className="relative container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-6">Make the Switch</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Upgrade from {comp.name}
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              to AI-powered deals.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            Start your 7-day free trial. No credit card required. See why investors are switching to AIWholesail.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/pricing">
              <Button size="lg" className="rounded-full px-10 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-white/40 mt-6">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="font-light">No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-primary" />
              <span className="font-light">4.8/5 User Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER -- DARK ===== */}
      <footer className="bg-[#0a0a0a] text-white border-t border-white/5 px-4 py-12">
        <div className="container mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight">AIWholesail</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/markets" className="hover:text-white transition-colors">Markets</Link>
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <p className="text-xs text-white/30">&copy; 2026 AIWholesail</p>
        </div>
      </footer>
    </div>
  );
}
