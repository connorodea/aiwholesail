import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  BarChart3,
  Zap,
  Users,
  Building2,
  MapPin,
  TrendingUp,
  Star,
  CheckCircle,
  Shield,
  Sparkles,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

const values = [
  {
    icon: BarChart3,
    title: 'Data-Driven Decisions',
    description:
      'Every recommendation is backed by real market data and comparable sales. No guesswork, no gut feelings -- just numbers that tell the truth.',
  },
  {
    icon: Zap,
    title: 'Speed to Deal',
    description:
      'In real estate, the fastest investor wins. Our platform surfaces profitable opportunities in seconds so you can move before the competition.',
  },
  {
    icon: Users,
    title: 'Accessible to Everyone',
    description:
      'Whether you are closing your first deal or your hundredth, AIWholesail gives you the same professional-grade tools that top firms rely on.',
  },
];

const stats = [
  { value: '10K+', label: 'Properties Analyzed Daily', icon: Building2 },
  { value: '50', label: 'States Covered', icon: MapPin },
  { value: '$2.3B+', label: 'Deal Volume Tracked', icon: TrendingUp },
  { value: '4.8/5', label: 'User Rating', icon: Star },
];

export default function About() {
  return (
    <PublicLayout>
      <SEOHead
        title="About Us"
        description="AIWholesail was built by real estate investors, for real estate investors. Learn how we are democratizing access to profitable deals with AI-powered analysis."
        keywords="about AIWholesail, real estate AI company, property analysis platform, real estate investing tools, AI deal finding"
      />

      {/* ===== HERO -- DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-6xl px-4 pt-28 pb-20 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <Sparkles className="h-3 w-3 mr-1.5" /> Our Mission
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[0.95] mb-6">
            Built by investors,
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              for investors.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
            We believe every investor deserves the same analytical edge that top firms have. AIWholesail puts AI-powered deal finding and market intelligence in your hands -- so the best deals are never out of reach.
          </p>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== VALUES -- LIGHT (Bento) ===== */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">What Drives Us</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Three principles behind every feature.
          </h2>
          <p className="text-lg text-muted-foreground font-light max-w-xl mb-16">
            These values guide every decision we make and every tool we build.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {values.map((item) => (
              <div
                key={item.title}
                className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8 group hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold tracking-tight mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed font-light">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== OUR STORY -- LIGHT (muted bg) ===== */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4 text-center">Our Story</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-center mb-12">
            Why we built AIWholesail.
          </h2>

          <div className="space-y-6 text-muted-foreground font-light leading-relaxed text-base md:text-lg">
            <p>
              We started AIWholesail because finding profitable real estate
              deals should not require a team of analysts, a massive data
              budget, or decades of market experience. The information is out
              there -- scattered across dozens of listing sites, public records,
              and market feeds -- but piecing it together manually takes hours
              per property.
            </p>
            <p>
              As active investors ourselves, we felt the frustration firsthand.
              We would spend entire weekends combing through listings, county
              records, and spreadsheets just to find a handful of properties
              worth pursuing. Meanwhile, larger firms with dedicated research
              teams were locking up deals before we even finished our analysis.
              We knew there had to be a better way.
            </p>
            <p>
              So we built it. AIWholesail combines real-time property data from
              multiple sources with advanced AI analysis to surface the
              highest-potential deals in any market -- in seconds. What used to
              take a team of analysts an entire week now happens automatically,
              around the clock, for every zip code in the country. Our mission
              is simple: level the playing field so that independent investors
              can compete with anyone.
            </p>
          </div>
        </div>
      </section>

      {/* ===== BY THE NUMBERS -- DARK ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4 text-center">By the Numbers</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-4">
            The scale of our platform means more opportunities for you.
          </h2>
          <p className="text-lg text-white/60 font-light max-w-2xl mx-auto text-center mb-16">
            Our platform grows every day -- and so does your edge.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:bg-white/10 transition-colors"
              >
                <stat.icon className="h-6 w-6 text-primary mx-auto mb-4" />
                <div className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
                  {stat.value}
                </div>
                <p className="text-sm text-white/50 font-light">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fade dark to white */}
      <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-background" />

      {/* ===== CTA -- LIGHT ===== */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
            Ready to find your next deal?
          </h2>
          <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto mb-10">
            Join thousands of investors using AIWholesail to uncover profitable opportunities faster than ever before.
          </p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full px-10 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-6">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-primary" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Cancel Anytime</span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
