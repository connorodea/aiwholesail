import { useState } from "react";
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
          <Heading as="h1" size="2xl" className="mt-6 py-6">
            Find profitable real estate deals —{" "}
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              before everyone else
            </span>
          </Heading>
          <Subheading className="max-w-2xl">
            Stop spending hours searching. Our AI scans thousands of properties, calculates your profit instantly, and alerts you the moment new opportunities hit the market.
          </Subheading>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8 relative z-10">
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
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-6 mt-6 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> 7-day free trial</span>
          </div>

          {/* Social proof */}
          <div className="flex flex-col items-center mt-10 mb-10">
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
          </div>
        </Container>

        {/* Gradient border reveal — simplified from Proactiv's conic gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      </div>

      {/* ===== FEATURES GRID ===== */}
      <section className="relative py-20 sm:py-32">
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
            ].map((feature) => (
              <div
                key={feature.title}
                className="relative group p-6 rounded-xl border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent hover:border-cyan-500/20 transition-all duration-300"
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
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ===== WHO IT'S FOR ===== */}
      <section className="relative py-20">
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
            ].map(item => (
              <div key={item.title} className="p-6 rounded-xl border border-white/[0.05] bg-neutral-900/30 hover:border-cyan-500/20 transition-all duration-300 text-center group">
                <div className="w-12 h-12 mx-auto rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
                  <item.icon className="h-5 w-5 text-cyan-500" />
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-xs text-neutral-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="relative py-20">
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
              <div key={i} className="p-6 rounded-xl border border-white/[0.05] bg-neutral-900/30">
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
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ===== PRICING ===== */}
      <section className="relative py-20 sm:py-32">
        <div className="absolute inset-0 h-px top-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <Container className="text-center">
          <FeatureIconContainer className="flex justify-center items-center mx-auto mb-4">
            <DollarSign className="h-5 w-5 text-cyan-500" />
          </FeatureIconContainer>
          <Heading className="pt-4">Simple pricing</Heading>
          <Subheading>Start free. Upgrade when you're ready. No credit card required.</Subheading>

          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-12 text-left">
            <div className="p-6 rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/5 to-transparent relative">
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
            <div className="p-6 rounded-xl border border-white/[0.05] bg-neutral-900/30">
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
      </section>

      {/* ===== CTA ===== */}
      <section className="relative py-20 sm:py-32">
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
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 py-12 px-4 bg-[#08090a]">
        <Container>
          <div className="grid lg:grid-cols-5 gap-10">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <img src={aiWholesailLogo} alt="AIWholesail" className="h-18 w-auto opacity-60" />
                <span className="text-sm font-semibold tracking-tight text-neutral-400">AIWholesail</span>
              </div>
              <p className="text-xs text-neutral-600 max-w-xs leading-relaxed">
                AI-powered platform for real estate professionals to find, analyze, and close profitable deals.
              </p>
            </div>
            {[
              { title: "Product", links: [{ l: "Features", t: "/how-it-works" }, { l: "Use Cases", t: "/use-cases" }, { l: "Pricing", t: "/pricing" }, { l: "Developers", t: "/developers" }] },
              { title: "Resources", links: [{ l: "Blog", t: "/blog" }, { l: "Free Tools", t: "/tools" }, { l: "Markets", t: "/markets" }, { l: "About", t: "/about" }, { l: "FAQ", t: "/faq" }, { l: "Contact", t: "/contact" }] },
              { title: "Legal", links: [{ l: "Privacy Policy", t: "/privacy" }, { l: "Terms of Service", t: "/terms" }, { l: "Refund Policy", t: "/refund" }] },
            ].map(section => (
              <div key={section.title}>
                <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-neutral-500 mb-4">{section.title}</h4>
                <ul className="space-y-2">
                  {section.links.map(link => (
                    <li key={link.l}><Link to={link.t} className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors">{link.l}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-[11px] text-neutral-700">&copy; 2026 AIWholesail. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] text-neutral-700">All systems operational</span>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default Landing;
