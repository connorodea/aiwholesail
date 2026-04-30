import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  ArrowRight, Play, X, Menu, Zap, Brain, Search, DollarSign,
  BarChart3, Bell, Users, Target, Shield, CheckCircle, Star,
  TrendingUp, ChevronRight, Sparkles, Code, LineChart, Mail,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEOHead";

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
    { label: "Blog", href: "/blog" },
  ];

  return (
    <div className="min-h-screen bg-[#000] text-white">
      <SEOHead />

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDemo(false)}>
          <div className="relative w-full max-w-4xl bg-[#111] rounded-xl border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowDemo(false)} className="absolute top-3 right-3 z-10 p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label="Close demo video">
              <X className="h-4 w-4" />
            </button>
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe src="https://www.loom.com/embed/02baa8ef2cdb48bd9c5e21e800be6edd?sid=8f338d4e-71f1-4d64-b9a2-31f7ecdcc40b" frameBorder="0" allowFullScreen className="absolute inset-0 w-full h-full" />
            </div>
          </div>
        </div>
      )}

      {/* ===== NAV ===== */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#000]/80 backdrop-blur-xl border-b border-white/5" : ""}`}>
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2">
              <img src={aiWholesailLogo} alt="AIWholesail" className="h-7 w-auto" />
              <span className="text-sm font-semibold tracking-tight">AIWholesail</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(link => (
                <Link key={link.label} to={link.href} className="text-[13px] text-white/50 hover:text-white transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {user ? (
                <Link to="/app">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg border-white/10 bg-white/5 text-white text-xs hover:bg-white/10">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="hidden sm:block text-[13px] text-white/50 hover:text-white transition-colors">Sign In</Link>
                  <Link to="/pricing">
                    <Button size="sm" className="h-8 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <button className="p-2 hover:bg-white/10 rounded-lg"><Menu className="h-4 w-4" /></button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 bg-[#0a0a0a] border-white/5 pt-10">
                  <nav className="flex flex-col gap-1">
                    {navLinks.map(link => (
                      <Link key={link.label} to={link.href} onClick={() => setMobileOpen(false)} className="px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg">{link.label}</Link>
                    ))}
                  </nav>
                  <div className="mt-6 pt-6 border-t border-white/5 space-y-2">
                    {!user && <Link to="/auth" onClick={() => setMobileOpen(false)}><Button variant="outline" className="w-full h-9 rounded-lg border-white/10 bg-white/5 text-white text-sm">Sign In</Button></Link>}
                    <Link to="/pricing" onClick={() => setMobileOpen(false)}><Button className="w-full h-9 rounded-lg bg-white text-black text-sm font-medium">Get Started</Button></Link>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-white/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative container mx-auto max-w-4xl text-center">
          <h1 className="text-5xl md:text-7xl lg:text-[80px] font-bold tracking-tight leading-[0.95] mb-6">
            Find profitable
            <br />
            real estate <em className="not-italic bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">deals.</em>
          </h1>

          <p className="text-base md:text-lg text-white/40 max-w-xl mx-auto leading-relaxed mb-10">
            AI analyzes thousands of properties in seconds. Instant spread calculations, deal scoring, and market intelligence — so you close deals others miss.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/pricing">
              <Button className="h-10 rounded-lg bg-white text-black text-sm font-medium px-6 hover:bg-white/90 gap-2">
                Start for free <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button variant="outline" className="h-10 rounded-lg border-white/10 bg-white/5 text-white text-sm px-6 hover:bg-white/10 gap-2" onClick={() => setShowDemo(true)}>
              <Play className="h-3.5 w-3.5" /> Watch demo
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-white/25 mt-8">
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> 7-day free trial</span>
          </div>
        </div>
      </section>

      {/* ===== LOGO BAR ===== */}
      <section className="border-y border-white/5 py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-[11px] text-white/20 uppercase tracking-[0.2em] text-center mb-6">Powered by</p>
          <div className="flex items-center justify-center gap-8 md:gap-12 flex-wrap opacity-30">
            {["Zillow", "Stripe", "Claude AI", "Twilio", "Mapbox", "RapidAPI"].map(name => (
              <span key={name} className="text-sm font-medium tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INTEGRATE TONIGHT (How it works) ===== */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Start finding deals <em className="not-italic text-white/40">tonight.</em>
          </h2>
          <p className="text-white/30 text-base max-w-lg mb-16">
            Search any market, get AI analysis on every property, and identify profitable opportunities — all in one platform.
          </p>

          {/* Code-style steps */}
          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 py-3 border-b border-white/5">
              {["1. Search", "2. Analyze", "3. Score", "4. Close"].map((tab, i) => (
                <span key={tab} className={`px-3 py-1 text-xs rounded-md ${i === 0 ? "bg-white/10 text-white" : "text-white/30"}`}>{tab}</span>
              ))}
            </div>
            {/* Content */}
            <div className="p-6 md:p-8 space-y-4">
              <div className="font-mono text-sm space-y-2">
                <p><span className="text-white/30">{"// "}</span><span className="text-white/50">Search any location</span></p>
                <p><span className="text-blue-400">const</span> results = <span className="text-blue-400">await</span> <span className="text-emerald-400">aiWholesail</span>.<span className="text-yellow-300">search</span>({"{"}</p>
                <p className="pl-6"><span className="text-white/50">location:</span> <span className="text-orange-300">"Houston, TX"</span>,</p>
                <p className="pl-6"><span className="text-white/50">maxPrice:</span> <span className="text-purple-300">300000</span>,</p>
                <p className="pl-6"><span className="text-white/50">minSpread:</span> <span className="text-purple-300">30000</span></p>
                <p>{"}"})</p>
                <p className="mt-4"><span className="text-white/30">{"// "}</span><span className="text-white/50">→ 47 properties found, 12 with +$30K spreads</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            First-class
            <br />
            <span className="text-white/40">deal-finding experience.</span>
          </h2>
          <p className="text-white/30 text-base max-w-lg mb-16">
            Everything you need to find, analyze, and close profitable real estate deals — powered by AI that works around the clock.
          </p>

          <div className="grid md:grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden">
            {[
              { icon: Search, title: "Smart Property Search", desc: "Search any market by location, zip, or address. Filter by price, property type, beds, baths, and profit potential." },
              { icon: Brain, title: "AI Deal Scoring", desc: "Every property scored 0-100 based on spread, days on market, condition, and comparable sales. Know instantly if it's worth pursuing." },
              { icon: DollarSign, title: "Instant Spread Analysis", desc: "Automatic Zestimate comparison calculates the spread between listing price and estimated value on every property." },
              { icon: Bell, title: "Property Alerts", desc: "Set your criteria once. Get notified instantly when new properties with +$30K spreads hit the market." },
              { icon: Target, title: "Deal Pipeline", desc: "Track every deal from lead to close with a visual kanban board. Notes, stage changes, and activity timeline." },
              { icon: Users, title: "Buyer Matching", desc: "Maintain your cash buyer list. AI matches buyers to properties based on their criteria, location, and price range." },
              { icon: Mail, title: "Follow-up Sequences", desc: "Automated SMS and email drip campaigns. Pre-built templates for seller outreach, post-offer, and re-engagement." },
              { icon: Code, title: "Contract Generator", desc: "Generate assignment agreements, purchase contracts, and letters of intent. Auto-fill from deal data. Download as PDF." },
            ].map((feature) => (
              <div key={feature.title} className="bg-[#000] p-8 group">
                <feature.icon className="h-5 w-5 text-white/30 mb-4 group-hover:text-white/60 transition-colors" />
                <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                <p className="text-[13px] text-white/30 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHO IT'S FOR ===== */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Built for every
            <br />
            <span className="text-white/40">real estate strategy.</span>
          </h2>
          <p className="text-white/30 text-base max-w-lg mb-16">
            Wholesalers, flippers, landlords, agents — one platform for every approach to profitable real estate.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: TrendingUp, title: "Wholesalers", desc: "Find spreads, assign contracts, match buyers" },
              { icon: DollarSign, title: "Flippers", desc: "Estimate rehab, calculate ARV, score deals" },
              { icon: BarChart3, title: "Landlords", desc: "Analyze cash flow, cap rates, rental yield" },
              { icon: Users, title: "Agents", desc: "AI-powered market data for your clients" },
            ].map(item => (
              <div key={item.title} className="p-6 border border-white/5 rounded-xl hover:border-white/10 transition-colors group">
                <item.icon className="h-5 w-5 text-white/20 mb-4 group-hover:text-white/50 transition-colors" />
                <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                <p className="text-xs text-white/30">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10K+", label: "Properties analyzed daily" },
              { value: "50", label: "States covered" },
              { value: "$2.3B+", label: "Deal volume tracked" },
              { value: "4.8/5", label: "User rating" },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-3xl md:text-4xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-xs text-white/25 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIAL (single, centered like Resend) ===== */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-2xl text-center">
          {/* Quote */}
          <p className="text-lg md:text-xl text-white/60 leading-relaxed mb-8 italic">
            "AIWholesail helped me find 3 profitable deals in my first month. The AI analysis is incredibly accurate and saved me countless hours of research."
          </p>
          {/* Author */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold">SJ</div>
            <div className="text-left">
              <p className="text-sm font-medium">Sarah Johnson</p>
              <p className="text-xs text-white/30">Real Estate Investor — $85K profit</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Simple <em className="not-italic text-white/40">pricing.</em>
          </h2>
          <p className="text-white/30 text-base max-w-md mx-auto mb-12">
            Start with a 7-day free trial. No credit card required.
          </p>

          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
            {/* Pro */}
            <div className="p-6 border border-white/10 rounded-xl hover:border-white/20 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Pro</h3>
                <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded">Popular</span>
              </div>
              <div className="text-3xl font-bold mb-1">$29<span className="text-sm font-normal text-white/30">/mo</span></div>
              <p className="text-xs text-white/30 mb-6">For individual investors</p>
              <ul className="space-y-2 mb-6">
                {["5 alert locations", "24-hour updates", "Advanced matching", "Email notifications", "Market analytics"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/40"><CheckCircle className="h-3 w-3 text-white/20" />{f}</li>
                ))}
              </ul>
              <Link to="/pricing"><Button className="w-full h-9 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90">Start free trial</Button></Link>
            </div>

            {/* Elite */}
            <div className="p-6 border border-white/5 rounded-xl bg-white/[0.02]">
              <h3 className="text-sm font-semibold mb-4">Elite</h3>
              <div className="text-3xl font-bold mb-1">$99<span className="text-sm font-normal text-white/30">/mo</span></div>
              <p className="text-xs text-white/30 mb-6">For serious professionals</p>
              <ul className="space-y-2 mb-6">
                {["Unlimited locations", "4-hour updates", "Advanced AI analysis", "Skip tracing", "Lead scoring", "Priority support"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/40"><CheckCircle className="h-3 w-3 text-white/20" />{f}</li>
                ))}
              </ul>
              <Link to="/pricing"><Button variant="outline" className="w-full h-9 rounded-lg border-white/10 bg-white/5 text-white text-xs hover:bg-white/10">Start free trial</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FREE TOOLS ===== */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Everything in
            <br />
            <span className="text-white/40">your control.</span>
          </h2>
          <p className="text-white/30 text-base max-w-lg mb-12">
            Free calculators, market data, and analysis tools — no account required.
          </p>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Mortgage Calculator", href: "/tools/mortgage-calculator" },
              { label: "ARV Calculator", href: "/tools/arv-calculator" },
              { label: "Cash Flow Calculator", href: "/tools/cash-flow-calculator" },
              { label: "BRRRR Calculator", href: "/tools/brrrr-calculator" },
              { label: "Rehab Estimator", href: "/tools/rehab-estimator" },
              { label: "Cap Rate Calculator", href: "/tools/cap-rate-calculator" },
              { label: "Offer Calculator", href: "/tools/offer-price-calculator" },
              { label: "Deal Calculator", href: "/tools/wholesale-deal-calculator" },
            ].map(tool => (
              <Link key={tool.label} to={tool.href} className="group">
                <div className="p-4 border border-white/5 rounded-lg hover:border-white/10 transition-colors">
                  <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">{tool.label}</span>
                  <ChevronRight className="h-3 w-3 text-white/10 mt-2 group-hover:text-white/30 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-32 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Deals reimagined.
            <br />
            <span className="text-white/40">Available today.</span>
          </h2>
          <div className="flex gap-3 justify-center mt-8">
            <Link to="/pricing">
              <Button className="h-10 rounded-lg bg-white text-black text-sm font-medium px-6 hover:bg-white/90 gap-2">
                Start for free <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="outline" className="h-10 rounded-lg border-white/10 bg-white/5 text-white text-sm px-6 hover:bg-white/10">
                How it works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-5 gap-10">
            {/* Brand */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <img src={aiWholesailLogo} alt="AIWholesail" className="h-6 w-auto opacity-60" />
                <span className="text-sm font-semibold tracking-tight text-white/60">AIWholesail</span>
              </div>
              <p className="text-xs text-white/20 max-w-xs leading-relaxed">
                AI-powered platform for real estate professionals to find, analyze, and close profitable deals.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-white/30 mb-4">Product</h4>
              <ul className="space-y-2">
                {[
                  { label: "How It Works", to: "/how-it-works" },
                  { label: "Use Cases", to: "/use-cases" },
                  { label: "Pricing", to: "/pricing" },
                  { label: "Developers", to: "/developers" },
                ].map(link => (
                  <li key={link.label}><Link to={link.to} className="text-xs text-white/20 hover:text-white/50 transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-white/30 mb-4">Resources</h4>
              <ul className="space-y-2">
                {[
                  { label: "Blog", to: "/blog" },
                  { label: "Free Tools", to: "/tools" },
                  { label: "Markets", to: "/markets" },
                  { label: "About Us", to: "/about" },
                  { label: "FAQ", to: "/faq" },
                  { label: "Contact", to: "/contact" },
                ].map(link => (
                  <li key={link.label}><Link to={link.to} className="text-xs text-white/20 hover:text-white/50 transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-white/30 mb-4">Legal</h4>
              <ul className="space-y-2">
                {[
                  { label: "Privacy Policy", to: "/privacy" },
                  { label: "Terms of Service", to: "/terms" },
                  { label: "Refund Policy", to: "/refund" },
                ].map(link => (
                  <li key={link.label}><Link to={link.to} className="text-xs text-white/20 hover:text-white/50 transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-[11px] text-white/15">&copy; 2026 AIWholesail. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] text-white/15">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
