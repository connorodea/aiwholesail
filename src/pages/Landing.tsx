import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, Play, X, Search, DollarSign, Brain,
  BarChart3, Bell, Users, Target, Shield, CheckCircle, Star,
  TrendingUp, ChevronRight, Sparkles, Mail, Zap, FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEOHead";
import { AmbientColor } from "@/components/proactiv/AmbientColor";
import { Heading, Subheading } from "@/components/proactiv/Heading";
import { Container } from "@/components/proactiv/Container";
import { FeatureIconContainer } from "@/components/proactiv/FeatureIconContainer";
import { NavbarAIWholesail } from "@/components/ui/navbar-aiwholesail";
import { Spotlight } from "@/components/ui/spotlight";

const aiWholesailLogo = "/logo-white.png";

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

      {/* Demo Modal */}
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

      {/* ===== HERO ===== */}
      <div className="relative flex flex-col min-h-[50rem] md:min-h-[60rem] pt-28 md:pt-40">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <AmbientColor />

        <Container className="flex flex-col items-center justify-center relative z-10">
          <motion.div {...heroFadeUp(0)}>
            <Heading as="h1" size="2xl" className="mt-6 py-6">
              Find profitable real estate deals —{" "}
              <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                before everyone else
              </span>
            </Heading>
          </motion.div>
          <motion.div {...heroFadeUp(0.1)}>
            <Subheading className="max-w-2xl">
              Stop spending hours searching. Our AI scans thousands of properties, calculates your profit instantly, and alerts you the moment new opportunities hit the market.
            </Subheading>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div {...heroFadeUp(0.2)} className="flex flex-col sm:flex-row gap-3 mt-8 relative z-10">
            <Link to="/pricing">
              <button className="bg-cyan-500 hover:bg-cyan-400 text-black text-sm md:text-base font-medium px-6 py-2.5 rounded-md transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-[0px_-1px_0px_0px_rgba(255,255,255,0.4)_inset,0px_1px_0px_0px_rgba(255,255,255,0.4)_inset] flex items-center gap-2">
                Start 7-Day Free Trial <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <button
              onClick={() => setShowDemo(true)}
              className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm md:text-base font-medium px-6 py-2.5 rounded-md transition-all border border-transparent hover:border-white/10 shadow-[0px_1px_0px_0px_rgba(255,255,255,0.1)_inset] flex items-center gap-2"
            >
              <Play className="h-4 w-4" /> Watch Demo
            </button>
          </motion.div>

          {/* Trust badges */}
          <motion.div {...heroFadeUp(0.3)} className="flex items-center gap-6 mt-6 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> 7-day free trial</span>
          </motion.div>

          {/* Social proof */}
          <motion.div {...heroFadeUp(0.3)} className="flex flex-col items-center mt-10 mb-10">
            <div className="flex -space-x-3 mb-3">
              {["SJ", "MC", "JD", "RM", "KL"].map((initials, i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-neutral-800 bg-gradient-to-br from-cyan-500/20 to-neutral-800 flex items-center justify-center text-[10px] font-semibold text-white/70">
                  {initials}
                </div>
              ))}
            </div>
            <div className="flex gap-0.5 mb-2">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
            </div>
            <p className="text-neutral-500 text-xs">Trusted by real estate professionals nationwide</p>
          </motion.div>
        </Container>

        {/* Gradient border reveal — simplified from Proactiv's conic gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      </div>

      {/* ===== FEATURES GRID ===== */}
      <motion.section className="relative py-20 sm:py-32" {...sectionFadeIn}>
        <Container>
          <FeatureIconContainer className="flex justify-center items-center mx-auto mb-4">
            <Sparkles className="h-5 w-5 text-cyan-500" />
          </FeatureIconContainer>
          <Heading className="pt-4">Everything you need to close more deals</Heading>
          <Subheading>
            Whether you're wholesaling, flipping, or building a rental portfolio — one platform handles it all.
          </Subheading>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-16">
            {[
              { icon: Search, title: "Smart Property Search", desc: "Just type a city, zip code, or address. We search multiple sources and show you every property with profit potential — sorted by the best deals first." },
              { icon: DollarSign, title: "Instant Profit Analysis", desc: "See exactly how much money is in every deal. We compare listing prices to market values so you know your numbers before you make an offer." },
              { icon: Brain, title: "AI-Powered Scoring", desc: "Every property gets a score from 0 to 100 based on profit potential, market conditions, and comparable sales. Focus on the deals that matter." },
              { icon: Bell, title: "Deal Alerts", desc: "Set your criteria once and we'll notify you instantly when new high-profit opportunities hit the market. Never miss a deal again." },
              { icon: Target, title: "Deal Pipeline", desc: "Track every deal from first contact to closing. Manage your pipeline visually, add notes, and never lose track of where a deal stands." },
              { icon: Users, title: "Buyer Matching", desc: "Build your buyer list and let AI match the right buyers to the right properties based on their criteria, location, and price range." },
              { icon: Mail, title: "Automated Follow-ups", desc: "Set up text and email sequences that run automatically. Stay in touch with sellers and buyers without lifting a finger." },
              { icon: FileText, title: "Contract Generator", desc: "Generate assignment agreements, purchase contracts, and letters of intent. Fill in the details and download a professional PDF." },
              { icon: BarChart3, title: "Market Intelligence", desc: "Understand any market in seconds. See median prices, trends, comparable sales, and neighborhood data all in one dashboard." },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                {...cardFadeIn(index)}
                className="relative group p-4 sm:p-6 rounded-xl border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent hover:border-cyan-500/20 transition-all duration-300"
              >
                {/* Grid pattern background */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div className="relative z-10">
                  <FeatureIconContainer className="mb-4">
                    <feature.icon className="h-4 w-4 text-cyan-500" />
                  </FeatureIconContainer>
                  <h3 className="text-sm font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </motion.section>

      {/* ===== WHO IT'S FOR ===== */}
      <motion.section className="relative py-20" {...sectionFadeIn}>
        <div className="absolute inset-0 h-px top-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <Container>
          <FeatureIconContainer className="flex justify-center items-center mx-auto mb-4">
            <Users className="h-5 w-5 text-cyan-500" />
          </FeatureIconContainer>
          <Heading className="pt-4">Built for every strategy</Heading>
          <Subheading>Wholesalers, flippers, landlords, agents — one platform for every approach to profitable real estate.</Subheading>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            {[
              { icon: TrendingUp, title: "Wholesalers", desc: "Find undervalued properties, calculate assignment fees, and match with cash buyers" },
              { icon: DollarSign, title: "Flippers", desc: "Estimate renovation costs, calculate after-repair values, and score every deal" },
              { icon: BarChart3, title: "Landlords", desc: "Analyze rental income, calculate returns, and find properties below market value" },
              { icon: Users, title: "Agents", desc: "Impress clients with instant market data and professional property analysis" },
            ].map((item, index) => (
              <motion.div key={item.title} {...cardFadeIn(index)} className="p-4 sm:p-6 rounded-xl border border-white/[0.05] bg-neutral-900/30 hover:border-cyan-500/20 transition-all duration-300 text-center group">
                <div className="w-12 h-12 mx-auto rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
                  <item.icon className="h-5 w-5 text-cyan-500" />
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-xs text-neutral-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </Container>
      </motion.section>

      {/* ===== TESTIMONIALS ===== */}
      <motion.section className="relative py-20" {...sectionFadeIn}>
        <div className="absolute inset-0 h-px top-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <Container>
          <FeatureIconContainer className="flex justify-center items-center mx-auto mb-4">
            <Star className="h-5 w-5 text-cyan-500" />
          </FeatureIconContainer>
          <Heading className="pt-4">Trusted by professionals</Heading>
          <Subheading>See what real estate investors are saying about AIWholesail.</Subheading>

          <div className="grid md:grid-cols-2 gap-4 mt-12 max-w-4xl mx-auto">
            {[
              { name: "Sarah Johnson", role: "Real Estate Investor", content: "AIWholesail helped me find 3 profitable deals in my first month. The analysis is incredibly accurate and saved me countless hours of research.", profit: "$85K" },
              { name: "Mike Chen", role: "Real Estate Investor", content: "The time I save on research has doubled my deal flow. This platform is a game-changer for serious investors.", profit: "$120K" },
              { name: "Jennifer Davis", role: "Property Flipper", content: "The profit calculations are spot-on every time. I understand market trends in seconds instead of spending days on research.", profit: "$95K" },
              { name: "Robert Martinez", role: "Investment Advisor", content: "We're closing 40% more transactions since implementing AIWholesail for our deal sourcing. My clients love the speed.", profit: "$150K" },
            ].map((t, i) => (
              <motion.div key={i} {...cardFadeIn(i)} className="p-4 sm:p-6 rounded-xl border border-white/[0.05] bg-neutral-900/30">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed mb-6">"{t.content}"</p>
                <div className="flex justify-between items-end border-t border-white/5 pt-4">
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-500">Profit</p>
                    <p className="text-sm font-bold text-cyan-400">{t.profit}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </motion.section>

      {/* ===== PRICING ===== */}
      <motion.section className="relative py-20 sm:py-32" {...sectionFadeIn}>
        <div className="absolute inset-0 h-px top-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <Container className="text-center">
          <FeatureIconContainer className="flex justify-center items-center mx-auto mb-4">
            <DollarSign className="h-5 w-5 text-cyan-500" />
          </FeatureIconContainer>
          <Heading className="pt-4">Simple pricing</Heading>
          <Subheading>Start free. Upgrade when you're ready. No credit card required.</Subheading>

          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-12 text-left">
            <div className="p-4 sm:p-6 rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/5 to-transparent relative">
              <span className="absolute -top-3 left-6 bg-cyan-500 text-black text-[10px] font-semibold px-3 py-0.5 rounded-full">Most Popular</span>
              <h3 className="text-lg font-semibold mb-1">Pro</h3>
              <div className="text-3xl font-bold mb-1">$29<span className="text-sm font-normal text-neutral-500">/mo</span></div>
              <p className="text-xs text-neutral-500 mb-6">For individual investors</p>
              <ul className="space-y-2 mb-6">
                {["5 alert locations", "24-hour updates", "Advanced matching", "Email notifications", "Market analytics"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-neutral-400"><CheckCircle className="h-3 w-3 text-cyan-500/60" />{f}</li>
                ))}
              </ul>
              <Link to="/pricing">
                <button className="w-full bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-medium py-2.5 rounded-md transition-all shadow-[0px_-1px_0px_0px_rgba(255,255,255,0.4)_inset,0px_1px_0px_0px_rgba(255,255,255,0.4)_inset]">
                  Start Free Trial
                </button>
              </Link>
            </div>
            <div className="p-4 sm:p-6 rounded-xl border border-white/[0.05] bg-neutral-900/30">
              <h3 className="text-lg font-semibold mb-1">Elite</h3>
              <div className="text-3xl font-bold mb-1">$99<span className="text-sm font-normal text-neutral-500">/mo</span></div>
              <p className="text-xs text-neutral-500 mb-6">For serious professionals</p>
              <ul className="space-y-2 mb-6">
                {["Unlimited locations", "4-hour updates", "Advanced AI analysis", "Skip tracing", "Lead scoring", "Priority support"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-neutral-400"><CheckCircle className="h-3 w-3 text-neutral-600" />{f}</li>
                ))}
              </ul>
              <Link to="/pricing">
                <button className="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium py-2.5 rounded-md transition-all border border-white/5 shadow-[0px_1px_0px_0px_rgba(255,255,255,0.1)_inset]">
                  Start Free Trial
                </button>
              </Link>
            </div>
          </div>
        </Container>
      </motion.section>

      {/* ===== CTA ===== */}
      <motion.section className="relative py-20 sm:py-32" {...sectionFadeIn}>
        <AmbientColor />
        <div className="absolute inset-0 h-px top-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <Container className="flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col text-center md:text-left">
            <h2 className="text-white text-xl md:text-3xl font-bold max-w-xl">
              Ready to find your next profitable deal?
            </h2>
            <p className="max-w-md mt-4 text-sm text-neutral-400">
              Join thousands of real estate professionals using AI to find deals faster than ever. Start your 7-day free trial today — no credit card required.
            </p>
            {/* Social proof */}
            <div className="flex items-center gap-3 mt-6 justify-center md:justify-start">
              <div className="flex -space-x-2">
                {["SJ", "MC", "JD"].map((initials, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-neutral-800 bg-neutral-700 flex items-center justify-center text-[9px] font-semibold">
                    {initials}
                  </div>
                ))}
              </div>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}
              </div>
              <span className="text-xs text-neutral-500">4.8/5 rating</span>
            </div>
          </div>
          <Link to="/pricing">
            <button className="bg-cyan-500 hover:bg-cyan-400 text-black text-base font-medium px-8 py-3 rounded-md transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-[0px_-1px_0px_0px_rgba(255,255,255,0.4)_inset,0px_1px_0px_0px_rgba(255,255,255,0.4)_inset] flex items-center gap-2 whitespace-nowrap">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </Container>
      </motion.section>

      {/* ===== FOOTER ===== */}
      <footer className="relative border-t border-white/[0.06] bg-[#060607]">
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
                  <img src={aiWholesailLogo} alt="AIWholesail" className="h-8 sm:h-9 w-auto" />
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
              <p className="text-[11px] text-neutral-600">&copy; {new Date().getFullYear()} AIWholesail. All rights reserved.</p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] text-neutral-600">All systems operational</span>
              </div>
            </div>
          </Container>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
