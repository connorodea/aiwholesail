import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  BarChart3,
  Zap,
  Users,
  Building2,
  MapPin,
  TrendingUp,
  Star,
  ArrowRight,
  CheckCircle,
  Shield,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

const values = [
  {
    icon: BarChart3,
    title: 'Data-Driven Decisions',
    description:
      'Every recommendation is backed by real market data, comparable sales, and AI-powered analysis. No guesswork, no gut feelings — just numbers that tell the truth.',
  },
  {
    icon: Zap,
    title: 'Speed to Deal',
    description:
      'In real estate, the fastest investor wins. Our platform surfaces profitable opportunities in seconds, not days, so you can move before the competition even sees the listing.',
  },
  {
    icon: Users,
    title: 'Accessible to Everyone',
    description:
      'Whether you are closing your first wholesale deal or your hundredth, AIWholesail gives you the same institutional-grade tools that hedge funds and REITs rely on.',
  },
];

const stats = [
  { value: '10,000+', label: 'Properties Analyzed Daily', icon: Building2 },
  { value: '50', label: 'States Covered', icon: MapPin },
  { value: '$2.3B+', label: 'Deal Volume Tracked', icon: TrendingUp },
  { value: '4.8/5', label: 'User Rating', icon: Star },
];

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title="About Us"
        description="AIWholesail was built by real estate investors, for real estate investors. Learn how we are democratizing access to profitable deals with AI-powered analysis."
        keywords="about AIWholesail, real estate AI company, property analysis platform, real estate investing tools, AI deal finding"
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
              <div className="text-lg font-semibold">About Us</div>
              <div className="w-20" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="space-y-6">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight leading-tight">
              Built by Real Estate Investors,{' '}
              <span className="text-primary">for Real Estate Investors</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed max-w-3xl mx-auto">
              We believe every investor deserves the same analytical edge that
              institutional players have. AIWholesail puts AI-powered deal
              finding, market intelligence, and automated scoring in your hands
              — so the best deals are never out of reach.
            </p>
          </div>
        </div>
      </section>

      {/* Mission / Values */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              What drives <span className="text-primary">us</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              Three principles guide every feature we build and every decision
              we make.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((item) => (
              <Card
                key={item.title}
                className="group bg-card/50 border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 rounded-2xl"
              >
                <CardContent className="pt-8 pb-8 px-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-light">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              Our <span className="text-primary">story</span>
            </h2>
          </div>

          <div className="space-y-6 text-muted-foreground font-light leading-relaxed text-base md:text-lg">
            <p>
              We started AIWholesail because finding profitable real estate
              deals should not require a team of analysts, a six-figure data
              budget, or decades of market experience. The information is out
              there — scattered across dozens of listing sites, public records,
              and market feeds — but piecing it together manually takes hours
              per property. AI changed that.
            </p>
            <p>
              As active wholesalers and investors ourselves, we felt the
              frustration firsthand. We would spend entire weekends combing
              through Zillow, county records, and spreadsheets just to find a
              handful of properties worth pursuing. Meanwhile, institutional
              buyers with dedicated research teams were snapping up deals before
              we even finished our analysis. We knew there had to be a better
              way.
            </p>
            <p>
              So we built it. AIWholesail combines real-time property data from
              multiple sources with advanced AI analysis to surface the
              highest-potential deals in any market — in seconds. What used to
              take a team of analysts an entire week now happens automatically,
              around the clock, for every zip code in the country. Our mission
              is simple: level the playing field so that independent investors
              can compete with anyone.
            </p>
          </div>
        </div>
      </section>

      {/* By the Numbers */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              By the <span className="text-primary">numbers</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              The scale of our platform means more opportunities for you.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <Card
                key={stat.label}
                className="bg-card/50 border-border/50 rounded-2xl text-center hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <CardContent className="pt-8 pb-8 px-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-3xl md:text-4xl font-medium tracking-tight mb-2">
                    {stat.value}
                  </div>
                  <p className="text-sm text-muted-foreground font-light">
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <div className="space-y-8">
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-tight">
              Ready to find your{' '}
              <span className="block text-primary">next deal?</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto">
              Join thousands of investors using AIWholesail to uncover
              profitable opportunities faster than ever before.
            </p>
            <div className="pt-4">
              <Link to="/pricing">
                <Button
                  size="lg"
                  className="text-base font-medium px-8 py-3 rounded-full gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span className="font-light">7-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="font-light">Credit Card Required</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
