import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  ArrowRight, Play, X, Menu, Zap, Brain, Search, DollarSign,
  BarChart3, Bell, Users, Target, Shield, CheckCircle, Star,
  TrendingUp, MapPin, ChevronRight, Sparkles, Eye,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEOHead";
import { GradientOrbs } from "@/components/effects/GradientOrbs";

const aiWholesailLogo = "/lovable-uploads/8dcdb5d0-ddfb-406f-a5f0-b3c5112d210a.png";

const Landing = () => {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "How It Works", href: "/how-it-works" },
    { label: "Use Cases", href: "/use-cases" },
    { label: "Pricing", href: "/pricing" },
    { label: "Tools", href: "/tools" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead />

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDemo(false)}>
          <div className="relative w-full max-w-4xl bg-background rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowDemo(false)} className="absolute top-4 right-4 z-10 p-2 bg-background/80 hover:bg-background rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe src="https://www.loom.com/embed/02baa8ef2cdb48bd9c5e21e800be6edd?sid=8f338d4e-71f1-4d64-b9a2-31f7ecdcc40b" frameBorder="0" allowFullScreen className="absolute inset-0 w-full h-full rounded-2xl" />
            </div>
          </div>
        </div>
      )}

      {/* ===== NAVBAR ===== */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "py-2" : "py-4"}`}>
        <div className="container mx-auto max-w-7xl px-4">
          <div className={`relative rounded-2xl transition-all duration-500 ${
            scrolled
              ? "bg-background/80 backdrop-blur-2xl border border-border/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
              : "bg-transparent"
          }`}>
            <div className="px-6 py-3 flex items-center justify-between">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2.5 group shrink-0">
                <img src={aiWholesailLogo} alt="AIWholesail" className="h-8 w-auto object-contain" />
                <span className="hidden sm:block text-lg font-bold tracking-tight">AIWholesail</span>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map(link => (
                  <Link key={link.label} to={link.href} className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg">
                    {link.label}
                  </Link>
                ))}
              </nav>

              {/* CTA */}
              <div className="flex items-center gap-2">
                {user ? (
                  <Link to="/app">
                    <Button size="sm" className="rounded-full px-5 gap-2 bg-primary hover:bg-primary/90">
                      <Sparkles className="h-3.5 w-3.5" /> Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/auth" className="hidden sm:block">
                      <Button variant="ghost" size="sm" className="rounded-full px-4">Sign In</Button>
                    </Link>
                    <Link to="/pricing">
                      <Button size="sm" className="rounded-full px-5 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                        <Zap className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Start Free Trial</span>
                        <span className="sm:hidden">Try Free</span>
                      </Button>
                    </Link>
                  </>
                )}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><Menu className="h-4 w-4" /></Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72 pt-10">
                    <nav className="flex flex-col gap-1">
                      {navLinks.map(link => (
                        <Link key={link.label} to={link.href} onClick={() => setMobileOpen(false)} className="px-4 py-3 text-base font-medium hover:bg-muted/50 rounded-lg">{link.label}</Link>
                      ))}
                    </nav>
                    <div className="mt-6 pt-6 border-t flex flex-col gap-2">
                      {!user && <Link to="/auth" onClick={() => setMobileOpen(false)}><Button variant="outline" className="w-full rounded-full">Sign In</Button></Link>}
                      <Link to="/pricing" onClick={() => setMobileOpen(false)}><Button className="w-full rounded-full gap-2"><Zap className="h-4 w-4" /> Start Free Trial</Button></Link>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== HERO — DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <GradientOrbs variant="hero" />

        <div className="relative container mx-auto max-w-6xl px-4 pt-40 pb-24 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <Sparkles className="h-3 w-3 mr-1.5" /> Trusted by Real Estate Professionals Nationwide
          </Badge>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            Find Profitable
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              Real Estate Deals.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light mb-10">
            Stop spending hours searching for deals. Our AI finds undervalued properties, calculates your profit instantly, and alerts you the moment new opportunities hit the market.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/pricing">
              <Button size="lg" className="rounded-full px-8 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2">
                Start 7-Day Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="rounded-full px-8 text-base font-semibold border-white/20 text-white hover:bg-white/10 gap-2" onClick={() => setShowDemo(true)}>
              <Play className="h-4 w-4" /> Watch Demo
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-white/40 mt-8">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> Cancel Anytime</span>
          </div>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== PLATFORM SECTION — WHITE ===== */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">How It Works</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] max-w-2xl mb-6">
            Your unfair advantage
            <br />in real estate
          </h2>
          <p className="text-lg text-muted-foreground font-light max-w-xl mb-16">
            Whether you're wholesaling, flipping, or building a rental portfolio — AIWholesail does the heavy lifting so you can focus on closing.
          </p>

          {/* Bento Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1 — Large */}
            <div className="lg:col-span-2 bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8 md:p-10 flex flex-col justify-between min-h-[320px] group hover:border-primary/20 transition-all duration-300">
              <div>
                <Badge className="bg-primary/10 text-primary border-0 mb-4">
                  <Search className="h-3 w-3 mr-1" /> Smart Search
                </Badge>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
                  Search any market.<br />Find deals instantly.
                </h3>
                <p className="text-muted-foreground font-light max-w-md">
                  Just type in a city, zip code, or address. We'll show you every property with profit potential — sorted by the best deals first.
                </p>
              </div>
              <Link to="/how-it-works" className="mt-6 flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                Learn more <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Card 2 */}
            <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8 flex flex-col justify-between min-h-[320px] group hover:border-primary/20 transition-all duration-300">
              <div>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-0 mb-4">
                  <DollarSign className="h-3 w-3 mr-1" /> Spread Analysis
                </Badge>
                <h3 className="text-xl font-bold tracking-tight mb-3">
                  Know your profit before you offer.
                </h3>
                <p className="text-sm text-muted-foreground font-light">
                  See exactly how much profit is in every deal. We compare listing prices to market values so you know your numbers instantly.
                </p>
              </div>
              <Link to="/how-it-works" className="mt-6 flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                Learn more <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Card 3 */}
            <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8 flex flex-col justify-between min-h-[280px] group hover:border-primary/20 transition-all duration-300">
              <div>
                <Badge className="bg-violet-500/10 text-violet-600 border-0 mb-4">
                  <Brain className="h-3 w-3 mr-1" /> AI Analysis
                </Badge>
                <h3 className="text-xl font-bold tracking-tight mb-3">
                  AI-powered due diligence.
                </h3>
                <p className="text-sm text-muted-foreground font-light">
                  Get a full property analysis in seconds — estimated value after repairs, comparable sales, and an investment score to guide your decision.
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8 flex flex-col justify-between min-h-[280px] group hover:border-primary/20 transition-all duration-300">
              <div>
                <Badge className="bg-orange-500/10 text-orange-600 border-0 mb-4">
                  <Bell className="h-3 w-3 mr-1" /> Alerts
                </Badge>
                <h3 className="text-xl font-bold tracking-tight mb-3">
                  Never miss a deal.
                </h3>
                <p className="text-sm text-muted-foreground font-light">
                  Set your criteria. Get instant alerts when properties with +$30K spreads hit the market.
                </p>
              </div>
            </div>

            {/* Card 5 */}
            <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8 flex flex-col justify-between min-h-[280px] group hover:border-primary/20 transition-all duration-300">
              <div>
                <Badge className="bg-cyan-500/10 text-cyan-600 border-0 mb-4">
                  <Target className="h-3 w-3 mr-1" /> Pipeline
                </Badge>
                <h3 className="text-xl font-bold tracking-tight mb-3">
                  Track deals to close.
                </h3>
                <p className="text-sm text-muted-foreground font-light">
                  Track every deal from first contact to closing. Manage your pipeline visually, match with buyers, and generate contracts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHO IT'S FOR — Clean cards ===== */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4 text-center">Built For</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-12">
            Every real estate professional.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, title: "Wholesalers", desc: "Find spreads, assign contracts, match buyers" },
              { icon: DollarSign, title: "Flippers", desc: "Estimate renovation costs, property values, and profit" },
              { icon: BarChart3, title: "Landlords", desc: "Analyze cash flow, cap rates, rental potential" },
              { icon: Users, title: "Agents", desc: "Impress clients with AI-powered market data" },
            ].map(item => (
              <div key={item.title} className="bg-background border border-border/50 rounded-2xl p-6 text-center hover:border-primary/20 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground font-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI SECTION — DARK ===== */}
      <section className="relative bg-[#0a0a0a] text-white py-24 px-4 overflow-hidden">
        <GradientOrbs variant="section" />
        <div className="relative container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Smart Technology</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
                We do the
                <br />research.
                <br />You close
                <br />the deals.
              </h2>
              <Link to="/how-it-works">
                <Button className="rounded-full px-6 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 mt-4">
                  See How It Works <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Brain, label: "AI Deal Scoring", desc: "Every property scored 0-100" },
                { icon: Search, label: "Smart Search", desc: "Multiple data sources combined" },
                { icon: BarChart3, label: "Market Intel", desc: "Comps, trends, demographics" },
                { icon: Zap, label: "Instant Alerts", desc: "High-profit deals, owner sales, auctions" },
              ].map(item => (
                <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                  <item.icon className="h-6 w-6 text-primary mb-3" />
                  <h4 className="font-semibold text-sm mb-1">{item.label}</h4>
                  <p className="text-xs text-white/50">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR — DARK ===== */}
      <section className="bg-[#0a0a0a] border-t border-white/5 py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10K+", label: "Properties Analyzed Daily" },
              { value: "50", label: "States Covered" },
              { value: "$2.3B+", label: "Deal Volume Tracked" },
              { value: "4.8/5", label: "User Rating" },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-4xl md:text-5xl font-bold text-white tracking-tight">{stat.value}</div>
                <div className="text-sm text-white/40 mt-2 font-light">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fade dark to white */}
      <div className="h-16 bg-gradient-to-b from-[#0a0a0a] to-background" />

      {/* ===== TESTIMONIALS — WHITE ===== */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4 text-center">Testimonials</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-12">
            Trusted by real estate professionals.
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { name: "Sarah Johnson", role: "Real Estate Investor", content: "AIWholesail helped me find 3 profitable deals in my first month. The AI analysis is incredibly accurate.", profit: "$85K" },
              { name: "Mike Chen", role: "Real Estate Investor", content: "The time I save on research has doubled my deal flow. This is a game-changer for serious investors.", profit: "$120K" },
              { name: "Jennifer Davis", role: "Property Flipper", content: "The ROI calculations are spot-on every time. The AI chat helps me understand market trends in seconds.", profit: "$95K" },
              { name: "Robert Martinez", role: "Investment Advisor", content: "We're closing 40% more transactions since implementing AIWholesail for our deal sourcing.", profit: "$150K" },
            ].map((t, i) => (
              <div key={i} className="bg-muted/30 border border-border/50 rounded-2xl p-8 hover:shadow-lg transition-all duration-300">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-primary text-primary" />)}
                </div>
                <p className="text-muted-foreground leading-relaxed font-light mb-6">"{t.content}"</p>
                <div className="flex justify-between items-end border-t border-border/30 pt-4">
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Profit</p>
                    <p className="font-bold text-primary">{t.profit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING PREVIEW — WHITE ===== */}
      <section className="py-24 px-4 bg-muted/20">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Simple, transparent pricing.
          </h2>
          <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto mb-12">
            Start with a 7-day free trial. No commitment.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Pro */}
            <div className="bg-background border-2 border-primary/30 rounded-2xl p-8 text-left shadow-lg shadow-primary/5 relative">
              <Badge className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs">Most Popular</Badge>
              <h3 className="text-lg font-bold mb-1">Pro</h3>
              <div className="text-4xl font-bold mb-1">$29<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <p className="text-sm text-muted-foreground font-light mb-6">Perfect for individual investors</p>
              <ul className="space-y-2.5 mb-8">
                {["5 alert locations", "24-hour updates", "Advanced property matching", "Email notifications", "Basic market analytics"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />{f}</li>
                ))}
              </ul>
              <Link to="/pricing"><Button className="w-full rounded-full">Start Free Trial</Button></Link>
            </div>
            {/* Elite */}
            <div className="bg-background border border-border/50 rounded-2xl p-8 text-left">
              <h3 className="text-lg font-bold mb-1">Elite</h3>
              <div className="text-4xl font-bold mb-1">$99<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <p className="text-sm text-muted-foreground font-light mb-6">For serious professionals</p>
              <ul className="space-y-2.5 mb-8">
                {["Unlimited locations", "4-hour updates", "Advanced AI analysis", "Skip tracing", "Lead scoring", "Priority support"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />{f}</li>
                ))}
              </ul>
              <Link to="/pricing"><Button variant="outline" className="w-full rounded-full">Start Free Trial</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA — DARK with gradient ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#0f1a14] text-white py-32 px-4 overflow-hidden">
        <GradientOrbs variant="cta" />

        <div className="relative container mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Ready to find
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              your next deal?
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            Join thousands of investors using AI to find profitable real estate deals faster than ever.
          </p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full px-10 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ===== FOOTER — DARK ===== */}
      <footer className="bg-[#0a0a0a] text-white border-t border-white/5 px-4 py-16">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Brand */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <img src={aiWholesailLogo} alt="AIWholesail" className="h-8 w-auto" />
                <span className="text-lg font-bold tracking-tight">AIWholesail</span>
              </div>
              <p className="text-sm text-white/40 font-light max-w-xs leading-relaxed">
                AI-powered platform for real estate professionals to find, analyze, and close profitable deals.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-white/60 mb-4">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "How It Works", to: "/how-it-works" },
                  { label: "Use Cases", to: "/use-cases" },
                  { label: "Pricing", to: "/pricing" },
                ].map(link => (
                  <li key={link.label}><Link to={link.to} className="text-sm text-white/40 hover:text-white transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-white/60 mb-4">Resources</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Blog", to: "/blog" },
                  { label: "Free Tools", to: "/tools" },
                  { label: "About Us", to: "/about" },
                  { label: "FAQ", to: "/faq" },
                  { label: "Contact", to: "/contact" },
                ].map(link => (
                  <li key={link.label}><Link to={link.to} className="text-sm text-white/40 hover:text-white transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-white/60 mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Privacy Policy", to: "/privacy" },
                  { label: "Terms of Service", to: "/terms" },
                  { label: "Refund Policy", to: "/refund" },
                ].map(link => (
                  <li key={link.label}><Link to={link.to} className="text-sm text-white/40 hover:text-white transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-white/30">&copy; 2026 AIWholesail. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-xs text-white/30 border-white/10"><Zap className="h-3 w-3 mr-1" /> AI-Powered</Badge>
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 bg-primary rounded-full animate-pulse" /><span className="text-xs text-white/30">Live Updates</span></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
