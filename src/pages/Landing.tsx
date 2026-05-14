import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, Play, X, Search, DollarSign, Brain,
  BarChart3, Bell, Users, Target, Shield, CheckCircle, Star,
  TrendingUp, ChevronRight, Sparkles, Mail, Zap, FileText, Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEOHead";
import { AmbientColor } from "@/components/proactiv/AmbientColor";
import { Heading, Subheading } from "@/components/proactiv/Heading";
import { Container } from "@/components/proactiv/Container";
import { NavbarAIWholesail } from "@/components/ui/navbar-aiwholesail";
import { Spotlight } from "@/components/ui/spotlight";
import { ShaderBackground } from "@/components/ShaderBackground";
import { WavyBackground } from "@/components/ui/wavy-background";
import { AIWholesailLogo } from "@/components/AIWholesailLogo";

const navItems = [
  { title: "Features", link: "/how-it-works" },
  { title: "Use Cases", link: "/use-cases" },
  { title: "Pricing", link: "/pricing" },
  { title: "Tools", link: "/tools" },
  { title: "Blog", link: "/blog" },
];

const Landing = () => {
  const { user } = useAuth();
  const [showDemo, setShowDemo] = useState(false);

  // Respect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Hero stagger: smooth fade on load
  const heroFadeUp = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 8 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { duration: 1, ease: [0.25, 0.1, 0.25, 1] as const, delay },
        };

  // Scroll-triggered smooth fade for sections below the fold
  const sectionFadeIn = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0 } as const,
        whileInView: { opacity: 1 } as const,
        viewport: { once: true, margin: "-50px" },
        transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const },
      };

  // Staggered card animation — pure fade, no movement
  const cardFadeIn = (index: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0 } as const,
          whileInView: { opacity: 1 } as const,
          viewport: { once: true, margin: "-50px" },
          transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const, delay: index * 0.06 },
        };

  return (
    <div className="relative overflow-hidden bg-[#08090a] text-white min-h-screen">
      <SEOHead />

      {/* Demo Modal -- rendered outside main for z-index layering */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDemo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl bg-neutral-900 rounded-xl border border-white/10 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowDemo(false)} className="absolute top-3 right-3 z-10 p-2 hover:bg-white/10 rounded-lg" aria-label="Close demo">
                <X className="h-4 w-4" />
              </button>
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe src="https://www.loom.com/embed/02baa8ef2cdb48bd9c5e21e800be6edd?sid=8f338d4e-71f1-4d64-b9a2-31f7ecdcc40b" frameBorder="0" allowFullScreen className="absolute inset-0 w-full h-full" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== NAVBAR — Aceternity Dark Shadow ===== */}
      <NavbarAIWholesail />

      <main>
      {/* ===== HERO — Two Column with Property Cards ===== */}
      <section className="relative pt-24 md:pt-28 pb-0 overflow-hidden bg-gradient-to-b from-[#08090a] to-[#060708]">
        {/* Wavy background — subtle, bottom of hero only */}
        <div className="absolute inset-0 z-0 opacity-40">
          <WavyBackground
            className="absolute inset-0"
            containerClassName="absolute inset-0"
            colors={["#155e75", "#164e63", "#0e7490", "#083344", "#0c4a6e"]}
            backgroundFill="#08090a"
            blur={14}
            speed="slow"
            waveOpacity={0.15}
          />
        </div>
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.12)" />

        <Container className="relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-6 items-center">
            {/* Left — Copy */}
            <div className="max-w-xl">
              <motion.div {...heroFadeUp(0)}>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-cyan-400 mb-5">
                  <Sparkles className="h-3 w-3" /> AI-Powered Deal Finder
                </span>
              </motion.div>

              <motion.h1 {...heroFadeUp(0.05)} className="text-4xl sm:text-5xl lg:text-[3.4rem] font-bold tracking-tight leading-[1.1] text-white">
                Find profitable<br />
                real estate deals<br />
                <span className="italic bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">before</span>{" "}
                everyone else
              </motion.h1>

              <motion.p {...heroFadeUp(0.1)} className="mt-6 text-[15px] sm:text-base text-neutral-400 leading-relaxed max-w-lg">
                Our AI scans thousands of properties, calculates profit potential, and alerts you the moment new opportunities hit the market.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div {...heroFadeUp(0.15)} className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link to="/pricing">
                  <button className="bg-cyan-500 hover:bg-cyan-400 text-black text-sm md:text-base font-semibold px-7 py-3 rounded-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-lg shadow-cyan-500/20 flex items-center gap-2">
                    Start 7-Day Free Trial <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <button
                  onClick={() => setShowDemo(true)}
                  className="bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm md:text-base font-medium px-7 py-3 rounded-lg transition-all border border-white/[0.08] hover:border-white/[0.15] flex items-center gap-2 justify-center"
                >
                  <Play className="h-4 w-4" /> Watch Demo
                </button>
              </motion.div>

              {/* Trust line */}
              <motion.div {...heroFadeUp(0.2)} className="flex items-center gap-5 mt-5 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> No credit card required</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> 7-day free trial</span>
              </motion.div>
            </div>

            {/* Right — Three Property Cards (angled, overlapping) */}
            <motion.div {...heroFadeUp(0.15)} className="relative h-[380px] sm:h-[420px] lg:h-[460px] hidden md:block">
              {/* Glow behind cards */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-emerald-500/5 rounded-3xl blur-2xl" />

              {/* Grid pattern overlay */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }} />

              {/* Card 1 — Left, tilted back */}
              <div className="absolute left-0 top-10 w-[210px] transform -rotate-[8deg] z-10 transition-transform duration-500 hover:-rotate-[4deg] hover:scale-105">
                <div className="bg-gradient-to-b from-[#0d1117] to-[#0a0d12] rounded-2xl border border-cyan-500/10 overflow-hidden shadow-2xl shadow-black/70" style={{ boxShadow: '0 0 40px rgba(6,182,212,0.06), 0 25px 50px rgba(0,0,0,0.6)' }}>
                  {/* Green JUST FOUND banner */}
                  <div className="bg-emerald-500 text-black text-[8px] font-bold tracking-widest uppercase text-center py-1">JUST FOUND</div>
                  <div className="relative h-[120px] overflow-hidden">
                    <img src="/generated/distressed-1.jpg" alt="Investment property" className="w-full h-full object-cover" loading="eager" onError={(e) => { (e.target as HTMLImageElement).src = '/generated/hero-property-1.jpg'; }} />
                    <div className="absolute top-2 left-2 bg-cyan-500 text-black text-[7px] font-bold px-2 py-0.5 rounded-sm tracking-wide">FOR SALE</div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="text-lg font-bold text-white leading-tight">$37,900</div>
                    <div className="text-[9px] text-neutral-500 leading-snug">9120 Conner St,<br/>Cleveland, OH 44105</div>
                    <div className="flex items-center gap-1.5 text-[8px] text-neutral-600">
                      <span className="flex items-center gap-0.5"><span>2</span> bed</span>
                      <span className="text-neutral-700">|</span>
                      <span className="flex items-center gap-0.5"><span>1</span> bath</span>
                      <span className="text-neutral-700">|</span>
                      <span>896 sq ft</span>
                    </div>
                    <div className="mt-2 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-lg py-2 text-center">
                      <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Est. Profit</div>
                      <div className="text-[17px] font-bold text-emerald-400 leading-tight">+$29,600</div>
                      <div className="text-[8px] text-emerald-400/60">ROI 78.1%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2 — Center, featured (largest) */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-[270px] z-30 transition-transform duration-500 hover:scale-105">
                <div className="bg-gradient-to-b from-[#0d1117] to-[#0a0d12] rounded-2xl border border-cyan-500/25 overflow-hidden" style={{ boxShadow: '0 0 60px rgba(6,182,212,0.1), 0 0 120px rgba(6,182,212,0.04), 0 30px 60px rgba(0,0,0,0.7)' }}>
                  {/* TOP DEAL yellow bar integrated into card top */}
                  <div className="bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[9px] font-bold tracking-widest uppercase text-center py-1.5 flex items-center justify-center gap-1">
                    <Star className="h-3 w-3 fill-current" /> TOP DEAL
                  </div>
                  <div className="relative h-[155px] overflow-hidden">
                    <img src="/generated/distressed-2.jpg" alt="Top deal property" className="w-full h-full object-cover" loading="eager" onError={(e) => { (e.target as HTMLImageElement).src = '/generated/hero-property-2.jpg'; }} />
                    <div className="absolute top-2 left-2 bg-cyan-500 text-black text-[7px] font-bold px-2 py-0.5 rounded-sm tracking-wide">FOR SALE</div>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="text-[22px] font-bold text-white leading-tight">$68,000</div>
                    <div className="text-[10px] text-neutral-500 leading-snug">1234 Mitchell St,<br/>Detroit, MI 48206</div>
                    <div className="flex items-center gap-2 text-[9px] text-neutral-600 mt-1">
                      <span>3 bed</span>
                      <span className="text-neutral-700">|</span>
                      <span>1 bath</span>
                      <span className="text-neutral-700">|</span>
                      <span>1,024 sq ft</span>
                    </div>
                    <div className="mt-3 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-xl py-3 text-center">
                      <div className="text-[8px] text-neutral-500 uppercase tracking-widest mb-0.5">Est. Profit</div>
                      <div className="text-2xl font-extrabold text-emerald-400 leading-tight">+$46,000</div>
                      <div className="text-[10px] text-emerald-400/60 mt-0.5">ROI 67.6%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3 — Right, tilted */}
              <div className="absolute right-0 top-10 w-[210px] transform rotate-[8deg] z-10 transition-transform duration-500 hover:rotate-[4deg] hover:scale-105">
                <div className="bg-gradient-to-b from-[#0d1117] to-[#0a0d12] rounded-2xl border border-cyan-500/10 overflow-hidden shadow-2xl shadow-black/70" style={{ boxShadow: '0 0 40px rgba(6,182,212,0.06), 0 25px 50px rgba(0,0,0,0.6)' }}>
                  <div className="relative h-[120px] overflow-hidden">
                    <img src="/generated/distressed-3.jpg" alt="New listing property" className="w-full h-full object-cover" loading="eager" onError={(e) => { (e.target as HTMLImageElement).src = '/generated/hero-property-3.jpg'; }} />
                    <div className="absolute top-2 left-2 bg-cyan-500 text-black text-[7px] font-bold px-2 py-0.5 rounded-sm tracking-wide">FOR SALE</div>
                    <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[7px] font-bold px-2 py-0.5 rounded-sm tracking-wide">NEW</div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="text-lg font-bold text-white leading-tight">$41,500</div>
                    <div className="text-[9px] text-neutral-500 leading-snug">2647 W North Ave,<br/>Baltimore, MD 21216</div>
                    <div className="flex items-center gap-1.5 text-[8px] text-neutral-600">
                      <span>3 bed</span>
                      <span className="text-neutral-700">|</span>
                      <span>1 bath</span>
                      <span className="text-neutral-700">|</span>
                      <span>1,112 sq ft</span>
                    </div>
                    <div className="mt-2 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-lg py-2 text-center">
                      <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Est. Profit</div>
                      <div className="text-[17px] font-bold text-emerald-400 leading-tight">+$32,700</div>
                      <div className="text-[8px] text-emerald-400/60">ROI 78.8%</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>

        {/* Stats Bar */}
        <motion.div {...heroFadeUp(0.25)} className="mt-14 md:mt-20 pb-8 relative z-20">
          <Container>
            <div className="bg-[#0b0d10] border border-white/[0.06] rounded-2xl py-6 md:py-8 px-4 md:px-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-white/[0.06]">
                {[
                  { icon: BarChart3, value: "16K+", label: "Deals Analyzed", iconBg: "bg-rose-500/10", iconColor: "text-rose-400" },
                  { icon: DollarSign, value: "$281K+", label: "Avg. Profit Potential", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400" },
                  { icon: Users, value: "10K+", label: "Investors Winning", iconBg: "bg-cyan-500/10", iconColor: "text-cyan-400" },
                  { icon: Star, value: "4.8/5", label: "User Rating", iconBg: "bg-amber-500/10", iconColor: "text-amber-400" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-center gap-3 md:px-6">
                    <div className={`w-10 h-10 rounded-full ${stat.iconBg} flex items-center justify-center shrink-0`}>
                      <stat.icon className={`h-4.5 w-4.5 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <div className="text-xl md:text-2xl font-bold text-white leading-tight">{stat.value}</div>
                      <div className="text-[10px] text-neutral-500">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </motion.div>

        {/* Bottom gradient fade into next section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060708] to-transparent z-[1] pointer-events-none" />
      </section>

      {/* ===== AS SEEN IN — Trust Logos (below hero) ===== */}
      <motion.div {...sectionFadeIn} className="relative z-20 bg-[#070809] py-8 md:py-10 -mt-12">
        {/* Top gradient fade from hero */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#060708] to-transparent z-[1] pointer-events-none" />
        {/* Bottom gradient fade into features */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#08090a] to-transparent z-[1] pointer-events-none" />
        <Container>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-neutral-500">As Seen In</span>
              <div className="hidden md:block w-px h-8 bg-neutral-700" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-10 md:gap-14">
              <img src="/logos/forbes-white.png" alt="Forbes" className="h-8 sm:h-10 hover:opacity-100 transition-opacity" style={{ opacity: 0.8 }} />
              <img src="/logos/biggerpockets.png" alt="BiggerPockets" className="h-8 sm:h-9 hover:opacity-100 transition-opacity" style={{ filter: 'grayscale(1) brightness(5)', opacity: 0.8 }} />
              <img src="/logos/rei-ink-white.png" alt="REI INK" className="h-10 sm:h-12 hover:opacity-100 transition-opacity" style={{ opacity: 0.8 }} />
              <img src="/logos/disruptors-white.png" alt="Real Estate Disruptors" className="h-10 sm:h-12 hover:opacity-100 transition-opacity" style={{ opacity: 0.8 }} />
              <img src="/logos/investor-fuel.png" alt="Investor Fuel" className="h-8 sm:h-9 hover:opacity-100 transition-opacity" style={{ opacity: 0.8 }} />
            </div>
          </div>
        </Container>
      </motion.div>

      {/* ===== FEATURES GRID (4-col with floating icon badges + CSS mockups) ===== */}
      <motion.section className="relative py-20 sm:py-32 bg-gradient-to-b from-[#08090a] to-[#030405] -mt-12" {...sectionFadeIn}>
        {/* Top gradient fade from trust logos */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#08090a] to-transparent z-[1] pointer-events-none" />
        {/* Bottom gradient fade into how it works */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030405] to-transparent z-[1] pointer-events-none" />
        <Container>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center text-white">
            Everything you need to{" "}
            <span className="italic bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">close more deals</span>
          </h2>
          <p className="text-center text-base md:text-lg text-neutral-400 mt-4 max-w-2xl mx-auto italic">
            Whether you're wholesaling, flipping, or building a rental portfolio — one platform handles it all.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mt-16">

            {/* Feature 1 — Smart Property Search */}
            <motion.div {...cardFadeIn(0)} className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-visible hover:border-cyan-500/20 transition-all duration-300">
              {/* Floating icon badge — top-left, overlapping */}
              <div className="absolute -top-5 left-5 z-20 w-12 h-12 rounded-full bg-[#0d1117] border-2 border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Search className="h-5 w-5 text-cyan-400" />
              </div>
              {/* Image area — dark map with green property dots */}
              <div className="relative h-[200px] overflow-hidden rounded-t-2xl">
                <img src="/generated/feature-bg-search.jpg" alt="Aerial neighborhood view with property markers" className="w-full h-full object-cover" loading="lazy" />
                {/* Dark map overlay with green dots */}
                <div className="absolute inset-0 bg-[#0a1628]/70">
                  <div className="relative w-full h-full">
                    {[
                      { top: '22%', left: '18%' }, { top: '38%', left: '52%' }, { top: '58%', left: '32%' },
                      { top: '28%', left: '68%' }, { top: '52%', left: '78%' }, { top: '72%', left: '42%' },
                      { top: '18%', left: '42%' }, { top: '62%', left: '62%' }, { top: '42%', left: '22%' },
                    ].map((pos, i) => (
                      <div key={i} className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40" style={{ top: pos.top, left: pos.left }}>
                        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" style={{ animationDelay: `${i * 200}ms`, animationDuration: '2.5s' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-[16px] font-bold text-white mb-2">Smart Property Search</h3>
                <p className="text-[13px] text-neutral-400 leading-relaxed flex-1">Search by city, zip code, or neighborhood and find the most profitable deals in seconds.</p>
                <Link to="/how-it-works" className="inline-flex items-center gap-1 text-[13px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors mt-4">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>

            {/* Feature 2 — Instant Profit Analysis (CSS mockup) */}
            <motion.div {...cardFadeIn(1)} className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-visible hover:border-cyan-500/20 transition-all duration-300">
              {/* Floating icon badge */}
              <div className="absolute -top-5 left-5 z-20 w-12 h-12 rounded-full bg-[#0d1117] border-2 border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <DollarSign className="h-5 w-5 text-cyan-400" />
              </div>
              {/* CSS Mockup — Deal Analysis UI */}
              <div className="h-[200px] bg-gradient-to-b from-[#0a0e14] to-[#0d1117] rounded-t-2xl p-4 pt-8 flex flex-col overflow-hidden">
                {/* Address bar */}
                <div className="text-[10px] font-semibold text-white truncate">123 Oakwood Avenue</div>
                <div className="text-[8px] text-neutral-500 mt-0.5">Detroit, MI 48201</div>
                {/* Tabs */}
                <div className="flex gap-1 mt-2.5 overflow-hidden">
                  {['Summary', 'Comparable', 'Rehab Est.', 'Photos', 'Notes', 'Analysis'].map((tab, i) => (
                    <span key={tab} className={`text-[7px] px-1.5 py-0.5 rounded-md whitespace-nowrap ${i === 0 ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-neutral-600'}`}>{tab}</span>
                  ))}
                </div>
                {/* Profit banner */}
                <div className="mt-3 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg px-3 py-2 text-center">
                  <div className="text-[8px] text-neutral-500 uppercase tracking-wider">Est. Profit</div>
                  <div className="text-[20px] font-extrabold text-emerald-400 leading-tight">+$81,000</div>
                  <div className="text-[9px] font-semibold text-emerald-400/80">Great Deal</div>
                </div>
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5">
                  {[
                    { label: 'ARV', value: '$180,000' },
                    { label: 'Repair Estimate', value: '$25,000' },
                    { label: 'Total Costs', value: '$74,000' },
                    { label: 'Estimated Profit', value: '$81,000', highlight: true },
                  ].map((stat) => (
                    <div key={stat.label} className="flex justify-between items-center">
                      <span className="text-[7px] text-neutral-600">{stat.label}</span>
                      <span className={`text-[8px] font-semibold ${stat.highlight ? 'text-emerald-400' : 'text-neutral-300'}`}>{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-[16px] font-bold text-white mb-2">Instant Profit Analysis</h3>
                <p className="text-[13px] text-neutral-400 leading-relaxed flex-1">See exact profit potential, repair estimates, and ROI before you even make an offer.</p>
                <Link to="/how-it-works" className="inline-flex items-center gap-1 text-[13px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors mt-4">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>

            {/* Feature 3 — AI-Powered Scoring (CSS circular gauge) */}
            <motion.div {...cardFadeIn(2)} className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-visible hover:border-cyan-500/20 transition-all duration-300">
              {/* Floating icon badge */}
              <div className="absolute -top-5 left-5 z-20 w-12 h-12 rounded-full bg-[#0d1117] border-2 border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Brain className="h-5 w-5 text-cyan-400" />
              </div>
              {/* CSS Gauge Mockup — Large circular gauge */}
              <div className="h-[200px] bg-gradient-to-b from-[#0a0e14] to-[#0d1117] rounded-t-2xl flex flex-col items-center justify-center relative overflow-hidden">
                {/* Radial glow behind gauge */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full bg-cyan-500/[0.06] blur-2xl" />
                </div>
                {/* Full circular gauge */}
                <div className="relative w-[110px] h-[110px]">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" style={{ overflow: 'visible' }}>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="url(#gaugeGradFeat)" strokeWidth="8" strokeLinecap="round" strokeDasharray="326.73" strokeDashoffset="26.14" />
                    <defs>
                      <linearGradient id="gaugeGradFeat" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="50%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Score in center */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-neutral-500">Deal Score</span>
                    <span className="text-[30px] font-extrabold text-white leading-none mt-0.5">92</span>
                    <span className="text-[10px] text-neutral-500 font-medium">/100</span>
                  </div>
                </div>
                {/* Label + badge below gauge */}
                <div className="text-[13px] font-bold text-emerald-400 mt-1">Great Deal</div>
                <span className="inline-flex items-center gap-1 bg-emerald-500/[0.12] border border-emerald-500/20 text-emerald-400 text-[8px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full mt-1.5">
                  <Star className="h-2.5 w-2.5 fill-current" /> High Profit Potential
                </span>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-[16px] font-bold text-white mb-2">AI-Powered Scoring</h3>
                <p className="text-[13px] text-neutral-400 leading-relaxed flex-1">Our AI analyzes market data, comps, and trends to score every deal so you focus only on winners.</p>
                <Link to="/how-it-works" className="inline-flex items-center gap-1 text-[13px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors mt-4">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>

            {/* Feature 4 — Real-Time Alerts (CSS iPhone mockup) */}
            <motion.div {...cardFadeIn(3)} className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-visible hover:border-cyan-500/20 transition-all duration-300">
              {/* Floating icon badge */}
              <div className="absolute -top-5 left-5 z-20 w-12 h-12 rounded-full bg-[#0d1117] border-2 border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Bell className="h-5 w-5 text-cyan-400" />
              </div>
              {/* CSS iPhone Frame Mockup */}
              <div className="h-[200px] bg-gradient-to-b from-[#0a0e14] to-[#0d1117] rounded-t-2xl flex items-center justify-center overflow-hidden">
                {/* iPhone frame */}
                <div className="relative w-[130px] h-[172px] bg-[#1a1a1a] rounded-[20px] border-2 border-neutral-700/60 shadow-2xl shadow-black/50 overflow-hidden">
                  {/* Dynamic Island */}
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[42px] h-[12px] bg-black rounded-full z-30" />
                  {/* Status bar */}
                  <div className="relative z-20 flex items-center justify-between px-4 pt-2.5">
                    <span className="text-[7px] font-semibold text-white">9:41</span>
                    <div className="flex items-center gap-0.5">
                      <div className="w-2.5 h-1.5 border border-white/60 rounded-[1px] relative">
                        <div className="absolute inset-[1px] bg-white/80 rounded-[0.5px]" style={{ width: '70%' }} />
                      </div>
                    </div>
                  </div>
                  {/* Date */}
                  <div className="text-center mt-3 relative z-20">
                    <div className="text-[7px] text-neutral-400">Tuesday, June 11</div>
                  </div>
                  {/* Push notification card */}
                  <div className="mx-2 mt-3 bg-white/[0.12] backdrop-blur-md rounded-xl p-2 border border-white/[0.08] relative z-20">
                    <div className="flex items-start gap-1.5">
                      {/* App icon */}
                      <div className="w-5 h-5 rounded-md bg-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="h-2.5 w-2.5 text-black" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[7px] font-bold text-white/90 uppercase tracking-wide">AIWholesail</div>
                        <div className="text-[7px] font-semibold text-white mt-0.5 leading-snug">New Deal Alert!</div>
                        <div className="text-[6px] text-white/70 leading-snug mt-0.5">123 Oakwood Ave, Lansing</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[7px] font-bold text-emerald-400">+$84,100 profit</span>
                          <span className="text-[5px] text-white/40">|</span>
                          <span className="text-[6px] text-white/50">2 bed, 1 bath</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Wallpaper gradient */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#0c1220] to-[#0a0e14] z-10" />
                  {/* Home indicator */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-10 h-[3px] bg-white/20 rounded-full z-20" />
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-[16px] font-bold text-white mb-2">Real-Time Alerts</h3>
                <p className="text-[13px] text-neutral-400 leading-relaxed flex-1">Get notified instantly when high-profit opportunities hit the market so you can act fast.</p>
                <Link to="/how-it-works" className="inline-flex items-center gap-1 text-[13px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors mt-4">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>

          </div>
        </Container>
      </motion.section>

      {/* ===== HOW IT WORKS ===== */}
      <motion.section className="relative py-28 sm:py-36 overflow-hidden -mt-16" {...sectionFadeIn}>
        {/* Top gradient fade from features */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#030405] to-transparent z-[2] pointer-events-none" />
        {/* Bottom gradient fade into testimonials */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#08090a] to-transparent z-[2] pointer-events-none" />
        {/* Very dark immersive background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030405] via-[#050607] to-[#08090a]" />
        {/* Investor laptop image — visible on right side */}
        <div className="absolute inset-0 z-0">
          <img
            src="/generated/investor-laptop.jpg"
            alt=""
            className="absolute right-0 top-0 h-full w-[55%] object-cover object-left opacity-[0.35]"
            loading="lazy"
          />
          {/* Gradient fades: strong left fade, subtle top/bottom */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#030405] via-[#030405]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#030405]/40 via-transparent to-[#030405]/60" />
        </div>

        <Container className="relative z-10">
          {/* Label: — HOW IT WORKS — */}
          <motion.div {...cardFadeIn(0)} className="flex items-center justify-center gap-4 mb-4">
            <span className="w-10 h-px bg-cyan-500/50" />
            <span className="text-[12px] font-semibold tracking-[0.3em] uppercase text-cyan-400">How It Works</span>
            <span className="w-10 h-px bg-cyan-500/50" />
          </motion.div>

          {/* Very large heading with neon glow */}
          <motion.h2
            {...cardFadeIn(0)}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-white text-center tracking-tight mb-20"
            style={{ textShadow: '0 0 80px rgba(6,182,212,0.15)' }}
          >
            How it{" "}
            <span className="italic bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent" style={{ textShadow: 'none' }}>works</span>
          </motion.h2>

          {/* Steps row */}
          <div className="relative max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-0 relative z-10">

              {/* Step 1 */}
              <motion.div {...cardFadeIn(0)} className="flex flex-col items-center text-center px-4">
                {/* Large double-ring circle */}
                <div className="relative w-[140px] h-[140px] lg:w-[160px] lg:h-[160px] rounded-full flex items-center justify-center mb-8">
                  {/* Outer glow ring */}
                  <div className="absolute inset-0 rounded-full border border-cyan-500/15" style={{ boxShadow: '0 0 50px rgba(6,182,212,0.1), 0 0 100px rgba(6,182,212,0.05)' }} />
                  {/* Inner circle */}
                  <div className="w-[110px] h-[110px] lg:w-[130px] lg:h-[130px] rounded-full border-2 border-cyan-500/40 bg-[#060708]/90 flex items-center justify-center">
                    <Search className="h-12 w-12 lg:h-14 lg:w-14 text-cyan-400" />
                  </div>
                </div>
                <span className="text-3xl lg:text-4xl font-extrabold italic text-cyan-400 mb-3 leading-none">01</span>
                <h3 className="text-xl font-bold text-white mb-3">Search Your Market</h3>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-[260px]">Enter your target market and set your deal criteria.</p>
              </motion.div>

              {/* Arrow 1→2 */}
              <div className="hidden md:flex absolute top-[70px] left-[33.33%] -translate-x-1/2 items-center justify-center z-20">
                <ArrowRight className="h-8 w-8 text-neutral-600" />
              </div>

              {/* Step 2 */}
              <motion.div {...cardFadeIn(1)} className="flex flex-col items-center text-center px-4">
                <div className="relative w-[140px] h-[140px] lg:w-[160px] lg:h-[160px] rounded-full flex items-center justify-center mb-8">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/15" style={{ boxShadow: '0 0 50px rgba(6,182,212,0.1), 0 0 100px rgba(6,182,212,0.05)' }} />
                  <div className="w-[110px] h-[110px] lg:w-[130px] lg:h-[130px] rounded-full border-2 border-cyan-500/40 bg-[#060708]/90 flex items-center justify-center">
                    <Brain className="h-12 w-12 lg:h-14 lg:w-14 text-cyan-400" />
                  </div>
                </div>
                <span className="text-3xl lg:text-4xl font-extrabold italic text-cyan-400 mb-3 leading-none">02</span>
                <h3 className="text-xl font-bold text-white mb-3">AI Scans Thousands<br />of Properties</h3>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-[260px]">Our AI analyzes data from multiple sources in real-time.</p>
              </motion.div>

              {/* Arrow 2→3 */}
              <div className="hidden md:flex absolute top-[70px] left-[66.66%] -translate-x-1/2 items-center justify-center z-20">
                <ArrowRight className="h-8 w-8 text-neutral-600" />
              </div>

              {/* Step 3 */}
              <motion.div {...cardFadeIn(2)} className="flex flex-col items-center text-center px-4">
                <div className="relative w-[140px] h-[140px] lg:w-[160px] lg:h-[160px] rounded-full flex items-center justify-center mb-8">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/15" style={{ boxShadow: '0 0 50px rgba(6,182,212,0.1), 0 0 100px rgba(6,182,212,0.05)' }} />
                  <div className="w-[110px] h-[110px] lg:w-[130px] lg:h-[130px] rounded-full border-2 border-cyan-500/40 bg-[#060708]/90 flex items-center justify-center">
                    <CheckCircle className="h-12 w-12 lg:h-14 lg:w-14 text-cyan-400" />
                  </div>
                </div>
                <span className="text-3xl lg:text-4xl font-extrabold italic text-cyan-400 mb-3 leading-none">03</span>
                <h3 className="text-xl font-bold text-white mb-3">Get Profitable Deals<br />Instantly</h3>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-[260px]">See the best deals, profit estimates, and act fast.</p>
              </motion.div>
            </div>
          </div>

          {/* Pill badges */}
          <motion.div {...cardFadeIn(3)} className="mt-20 flex flex-wrap justify-center items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-white/[0.08] bg-white/[0.02]">
              <CheckCircle className="h-4.5 w-4.5 text-cyan-400" />
              <span className="text-sm text-neutral-300 font-medium">Takes 30 seconds</span>
            </div>
            <div className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-white/[0.08] bg-white/[0.02]">
              <CheckCircle className="h-4.5 w-4.5 text-cyan-400" />
              <span className="text-sm text-neutral-300 font-medium">Scans 10,000+ properties</span>
            </div>
            <div className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-white/[0.08] bg-white/[0.02]">
              <CheckCircle className="h-4.5 w-4.5 text-cyan-400" />
              <span className="text-sm text-neutral-300 font-medium">Deals delivered instantly</span>
            </div>
          </motion.div>
        </Container>
      </motion.section>

      {/* ===== TESTIMONIALS ===== */}
      <motion.section className="relative py-20 sm:py-28 bg-gradient-to-b from-[#08090a] to-[#0a0b0d] -mt-16" {...sectionFadeIn}>
        {/* Top gradient fade from how it works */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#08090a] to-transparent z-[1] pointer-events-none" />
        {/* Bottom gradient fade into pricing */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0b0d] to-transparent z-[1] pointer-events-none" />
        <Container>
          {/* Label */}
          <p className="flex items-center justify-center gap-3 text-[11px] font-semibold tracking-[0.2em] uppercase text-cyan-400 text-center mb-4">
            <span className="text-cyan-400/40">&mdash;</span> TRUSTED BY INVESTORS <span className="text-cyan-400/40">&mdash;</span>
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center text-white">
            Trusted by real estate investors nationwide
          </h2>
          <p className="text-center text-base md:text-lg text-neutral-400 mt-4 max-w-2xl mx-auto">
            Real stories. Real results. Real profits.
          </p>

          {/* Testimonial Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mt-14">
            {[
              {
                name: "Sarah Johnson",
                role: "Real Estate Investor",
                quote: "AIWholesail helped me find 3 profitable deals in my first month. The data is spot on and saves me countless hours.",
                profit: "$85K+",
                profitLabel: "Profit",
                photo: "/generated/testimonial-investor-2.jpg",
                initials: "SJ",
              },
              {
                name: "Mike Chen",
                role: "Wholesaler",
                quote: "The time I save on research has doubled my deal flow. This platform is a game-changer for serious investors.",
                profit: "$120K+",
                profitLabel: "Profit",
                photo: "/generated/testimonial-investor-1.jpg",
                initials: "MC",
              },
              {
                name: "Jennifer Davis",
                role: "Property Flipper",
                quote: "The profit calculations are accurate every time. I close more deals and make more money.",
                profit: "$95K+",
                profitLabel: "Profit",
                photo: "/generated/testimonial-investor-3.jpg",
                initials: "JD",
              },
              {
                name: "Robert Martinez",
                role: "Investment Advisor",
                quote: "We're closing 40% more transactions since implementing AIWholesail for our deal sourcing.",
                profit: "$150K+",
                profitLabel: "Profit",
                photo: null,
                initials: "RM",
              },
            ].map((t, i) => (
              <motion.div
                key={i}
                {...cardFadeIn(i)}
                className="group relative p-6 rounded-2xl border border-white/[0.06] bg-[#0d1117] flex flex-col hover:border-cyan-500/15 transition-colors duration-300"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-cyan-400 text-cyan-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-[14px] leading-relaxed text-neutral-200 flex-1 mb-6">
                  <span className="text-cyan-400/60">&ldquo;</span>{t.quote}<span className="text-cyan-400/60">&rdquo;</span>
                </p>

                {/* Bottom area: person info left, profit right */}
                <div className="flex items-end justify-between gap-3 mt-auto">
                  {/* Person */}
                  <div className="flex items-center gap-3 min-w-0">
                    {t.photo ? (
                      <img
                        src={t.photo}
                        alt={t.name}
                        className="w-[52px] h-[52px] rounded-full object-cover border-2 border-white/10 flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-[52px] h-[52px] rounded-full bg-neutral-800 border-2 border-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-neutral-400">{t.initials}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{t.name}</p>
                      <p className="text-xs text-neutral-400">{t.role}</p>
                    </div>
                  </div>

                  {/* Profit */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-cyan-400 leading-tight">{t.profit}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">{t.profitLabel}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats Row */}
          <motion.div {...cardFadeIn(4)} className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 mt-16">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-cyan-400 leading-tight">10,000+</p>
                <p className="text-xs text-neutral-500 mt-0.5">investors already winning with AIWholesail</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-cyan-400 leading-tight">$281M+</p>
                <p className="text-xs text-neutral-500 mt-0.5">in profit generated on our platform</p>
              </div>
            </div>
          </motion.div>

        </Container>
      </motion.section>

      {/* ===== PRICING ===== */}
      <motion.section className="relative py-20 sm:py-32 overflow-hidden -mt-16" {...sectionFadeIn}>
        {/* Top gradient fade from testimonials */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0a0b0d] to-transparent z-[2] pointer-events-none" />
        {/* Bottom gradient fade into CTA */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#08090a] to-transparent z-[2] pointer-events-none" />
        {/* Subtle cityscape background */}
        <div className="absolute inset-0 z-0">
          <img src="/generated/cta-background.jpg" alt="" className="w-full h-full object-cover opacity-[0.05]" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0b0d] via-[#0a0b0d]/95 to-[#08090a]" />
        </div>
        <Container className="relative z-10 text-center">
          {/* PRICING label with em-dash decorations */}
          <p className="flex items-center justify-center gap-3 text-[11px] font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            <span className="text-cyan-400/40">&mdash;</span> PRICING <span className="text-cyan-400/40">&mdash;</span>
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Simple, transparent pricing
          </h2>
          <p className="text-base md:text-lg text-neutral-400 mt-4 max-w-2xl mx-auto">
            Start free. Upgrade when you're ready. No credit card required.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mt-14 text-left">
            {/* Pro Card */}
            <motion.div
              {...cardFadeIn(0)}
              className="relative p-6 sm:p-8 rounded-2xl border border-cyan-500/30 border-l-4 border-l-cyan-500 bg-gradient-to-b from-cyan-500/[0.06] to-[#0d0e10] shadow-lg shadow-cyan-500/5"
            >
              <span className="absolute -top-3 left-6 bg-cyan-500 text-black text-[10px] font-bold px-3 py-0.5 rounded-full tracking-wide uppercase">
                Most Popular
              </span>
              <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl sm:text-6xl font-bold text-white">$49</span>
                <span className="text-base font-normal text-neutral-500">/mo</span>
              </div>
              <p className="text-sm text-neutral-400 mb-6">For individual investors</p>
              <div className="h-px bg-white/[0.08] mb-6" />
              <ul className="space-y-3.5 mb-8">
                {[
                  "5 alert locations",
                  "24-hour updates",
                  "Property matching",
                  "Email notifications",
                  "Basic market analytics",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-neutral-300">
                    <CheckCircle className="h-4 w-4 text-cyan-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link to="/pricing">
                <button className="w-full bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold py-3 rounded-lg transition-all shadow-lg shadow-cyan-500/20 hover:-translate-y-0.5 active:scale-[0.98]">
                  Start Free Trial
                </button>
              </Link>
            </motion.div>

            {/* Elite Card */}
            <motion.div
              {...cardFadeIn(1)}
              className="relative p-6 sm:p-8 rounded-2xl border border-white/[0.08] bg-[#0d0e10]"
            >
              <h3 className="text-xl font-bold text-white mb-2">Elite</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl sm:text-6xl font-bold text-white">$99</span>
                <span className="text-base font-normal text-neutral-500">/mo</span>
              </div>
              <p className="text-sm text-neutral-400 mb-6">For serious professionals</p>
              <div className="h-px bg-white/[0.08] mb-6" />
              <ul className="space-y-3.5 mb-8">
                {[
                  "Unlimited locations",
                  "4-hour updates",
                  "Advanced AI analysis",
                  "Skip tracing",
                  "Lead scoring",
                  "Priority support",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-neutral-300">
                    <CheckCircle className="h-4 w-4 text-neutral-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link to="/pricing">
                <button className="w-full bg-transparent hover:bg-white/[0.04] text-white text-sm font-semibold py-3 rounded-lg transition-all border border-white/[0.12] hover:border-white/[0.2]">
                  Start Free Trial
                </button>
              </Link>
            </motion.div>
          </div>

          {/* Trust badges row */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-0 mt-10">
            <div className="flex items-center gap-1.5 px-4">
              <CheckCircle className="h-4 w-4 text-cyan-500 shrink-0" />
              <span className="text-[13px] text-neutral-400">No credit card required</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-neutral-700" />
            <div className="flex items-center gap-1.5 px-4">
              <CheckCircle className="h-4 w-4 text-cyan-500 shrink-0" />
              <span className="text-[13px] text-neutral-400">7-day free trial on all plans</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-neutral-700" />
            <div className="flex items-center gap-1.5 px-4">
              <CheckCircle className="h-4 w-4 text-cyan-500 shrink-0" />
              <span className="text-[13px] text-neutral-400">Cancel anytime</span>
            </div>
          </div>
        </Container>
      </motion.section>

      {/* ===== CTA ===== */}
      <motion.section className="relative py-24 sm:py-32 overflow-hidden bg-gradient-to-b from-[#08090a] to-[#08090a] -mt-16" {...sectionFadeIn}>
        {/* Top gradient fade from pricing */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#08090a] to-transparent z-[2] pointer-events-none" />
        {/* Background property image */}
        <div className="absolute inset-0 z-0">
          <img src="/generated/cta-background.jpg" alt="" className="w-full h-full object-cover opacity-[0.08]" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08090a]/90 via-[#08090a]/80 to-[#08090a]/95" />
        </div>
        <Container className="relative z-10 flex flex-col items-center text-center">
          <motion.h2
            {...cardFadeIn(0)}
            className="text-white text-2xl sm:text-3xl md:text-4xl font-bold max-w-2xl leading-tight"
          >
            Ready to find your next profitable deal?
          </motion.h2>
          <motion.p
            {...cardFadeIn(1)}
            className="max-w-lg mt-5 text-base text-neutral-400 leading-relaxed"
          >
            Join thousands of real estate professionals using AI to find deals faster than ever.
          </motion.p>
          <motion.div {...cardFadeIn(2)}>
            <Link to="/pricing" className="mt-8 inline-block">
              <button className="bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold px-10 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-lg shadow-cyan-500/20 flex items-center gap-2">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </motion.div>
          {/* Social proof */}
          <motion.div {...cardFadeIn(3)} className="flex items-center gap-3 mt-8">
            <div className="flex -space-x-2">
              {[
                { initials: "SJ", photo: "/generated/testimonial-investor-2.jpg" },
                { initials: "MC", photo: "/generated/testimonial-investor-1.jpg" },
                { initials: "JD", photo: "/generated/testimonial-investor-3.jpg" },
                { initials: "RM", photo: null },
              ].map((person, i) => (
                person.photo ? (
                  <img
                    key={i}
                    src={person.photo}
                    alt={person.initials}
                    className="w-8 h-8 rounded-full border-2 border-[#08090a] object-cover"
                  />
                ) : (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[#08090a] bg-neutral-700 flex items-center justify-center text-[9px] font-semibold text-white"
                  >
                    {person.initials}
                  </div>
                )
              ))}
            </div>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
            </div>
            <span className="text-sm text-neutral-400">4.8/5 from 200+ investors</span>
          </motion.div>
        </Container>
        {/* Bottom gradient fade into footer */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060607] to-transparent z-[2] pointer-events-none" />
      </motion.section>

      </main>

      {/* ===== FOOTER ===== */}
      <footer className="relative bg-[#060607]">
        <div className="border-b border-white/[0.06]">
          <Container>
            <div className="py-12 sm:py-16 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-white">Ready to find your next deal?</h3>
                <p className="text-sm text-neutral-500 mt-1">Start your 7-day free trial. No credit card required.</p>
              </div>
              <Link to="/auth?mode=signup" className="group flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold px-6 py-2.5 rounded-full transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-lg shadow-cyan-500/20">
                Get Started Free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Container>
        </div>
        <Container>
          <div className="py-12 sm:py-16">
            <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12">
              <div className="col-span-2 md:col-span-4 space-y-5">
                <Link to="/" className="inline-block">
                  <AIWholesailLogo variant="dark" className="text-[40px] sm:text-[48px]" />
                </Link>
                <p className="text-[13px] text-neutral-500 leading-relaxed max-w-xs">AI-powered platform for real estate professionals to find, analyze, and close profitable deals.</p>
                <div className="flex items-center gap-3 pt-1">
                  <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-white/10 transition-colors" aria-label="X (Twitter)">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-white/10 transition-colors" aria-label="LinkedIn">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                  <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-white/10 transition-colors" aria-label="YouTube">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </a>
                  <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-white/10 transition-colors" aria-label="Instagram">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  </a>
                </div>
              </div>
              {[
                { title: "Product", links: [{ l: "Features", t: "/how-it-works" }, { l: "Use Cases", t: "/use-cases" }, { l: "Pricing", t: "/pricing" }, { l: "Calculators", t: "/tools" }] },
                { title: "Resources", links: [{ l: "Blog", t: "/blog" }, { l: "Guides", t: "/guides" }, { l: "Markets", t: "/markets" }, { l: "Glossary", t: "/glossary" }, { l: "State Laws", t: "/laws" }] },
                { title: "Company", links: [{ l: "About", t: "/about" }, { l: "FAQ", t: "/faq" }, { l: "Contact", t: "/contact" }] },
                { title: "Legal", links: [{ l: "Privacy Policy", t: "/privacy" }, { l: "Terms of Service", t: "/terms" }, { l: "Refund Policy", t: "/refund" }] },
              ].map(section => (
                <div key={section.title} className="col-span-1 md:col-span-2">
                  <h4 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-400 mb-4">{section.title}</h4>
                  <ul className="space-y-2.5">
                    {section.links.map(link => (
                      <li key={link.l}><Link to={link.t} className="text-[13px] text-neutral-500 hover:text-white transition-colors">{link.l}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Container>
        <div className="border-t border-white/[0.06]">
          <Container>
            <div className="py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-[11px] text-neutral-500">&copy; {new Date().getFullYear()} AIWholesail. All rights reserved.</p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] text-neutral-500">All systems operational</span>
              </div>
            </div>
          </Container>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
