import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Search,
  Brain,
  SlidersHorizontal,
  LineChart,
  Phone,
  FileSignature,
  CheckCircle,
  Shield,
  Zap,
  BarChart3,
  Bell,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Search Any Market',
    description:
      'Enter a city, zip code, or address. Our system pulls live data from multiple listing sources and off-market databases to give you a complete picture of every available opportunity in that area.',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI Analyzes Every Property',
    description:
      'Each result is instantly scored by our AI. It compares listing prices against market values, calculates the profit potential, estimates repair costs, and assigns a deal score from 0 to 100 so you can see profitability at a glance.',
  },
  {
    number: '03',
    icon: SlidersHorizontal,
    title: 'Filter and Sort by Profit',
    description:
      'Narrow your results with advanced filters. Sort by profit potential to surface the biggest opportunities first. Set price ranges, property types, and minimum deal scores to match your investment criteria.',
  },
  {
    number: '04',
    icon: LineChart,
    title: 'Deep-Dive Analysis',
    description:
      'Click into any property to unlock a full AI-powered breakdown -- estimated value after repairs, comparable sales in the area, neighborhood trends, and a recommended maximum offer price.',
  },
  {
    number: '05',
    icon: Phone,
    title: 'Contact and Track',
    description:
      'Found a deal worth pursuing? Find the owner\'s contact information, add the property to your deal pipeline, set follow-up reminders, and create outreach sequences to stay on top of every lead.',
  },
  {
    number: '06',
    icon: FileSignature,
    title: 'Close the Deal',
    description:
      'When you are ready to lock in a deal, generate contracts directly from the platform. Match the property to buyers in your network, coordinate the closing timeline, and track the deal through to funding.',
  },
];

export default function HowItWorks() {
  // Respect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Hero stagger: fade-up on load
  const heroFadeUp = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { duration: 0.8, ease: 'easeOut' as const, delay },
        };

  // Scroll-triggered fade-in for sections below the fold
  const sectionFadeIn = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 30 } as const,
        whileInView: { opacity: 1, y: 0 } as const,
        viewport: { once: true, margin: '-100px' },
        transition: { duration: 0.6, ease: 'easeOut' as const },
      };

  // Staggered card animation
  const cardFadeIn = (index: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 30 } as const,
          whileInView: { opacity: 1, y: 0 } as const,
          viewport: { once: true, margin: '-100px' },
          transition: { duration: 0.5, ease: 'easeOut' as const, delay: index * 0.08 },
        };

  return (
    <PublicLayout>
      <SEOHead
        title="How It Works"
        description="Learn how AIWholesail helps you find profitable real estate deals in 6 simple steps. From market search to closing, powered by AI analysis and real-time data."
        keywords="how AIWholesail works, real estate deal finding steps, AI property analysis process, wholesale real estate workflow, automated deal scoring"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <motion.p {...heroFadeUp(0)} className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">HOW IT WORKS</motion.p>
          <motion.h1 {...heroFadeUp(0.1)} className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            How
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              AIWholesail Works.
            </span>
          </motion.h1>
          <motion.p {...heroFadeUp(0.2)} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Six straightforward steps between you and your next profitable deal. No learning curve, no complicated setup -- just results.
          </motion.p>
        </div>
      </section>

      {/* ===== 6 STEPS -- LIGHT ===== */}
      <motion.section className="py-24 px-4" {...sectionFadeIn}>
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">The Process</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Your path from search to closing.
          </h2>
          <p className="text-lg text-neutral-400 font-light max-w-xl mb-16">
            Every step is designed to save you time and surface the most profitable opportunities first.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                {...cardFadeIn(index)}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 flex flex-col justify-between min-h-[300px] group hover:border-cyan-500/20 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <step.icon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <span className="text-xs font-semibold tracking-[0.15em] uppercase text-neutral-400">
                      Step {step.number}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight mb-3">
                    {step.title}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ===== AI TECH CALLOUT -- DARK ===== */}
      <motion.section className="bg-[#0a0a0a] text-white py-24 px-4" {...sectionFadeIn}>
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Smart Technology</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] mb-6">
                We do the
                <br />research.
                <br />You close
                <br />the deals.
              </h2>
              <p className="text-lg text-white/60 font-light max-w-md mb-8">
                Behind every deal score and property analysis is advanced AI and real-time market data built for speed and accuracy.
              </p>
              <Link to="/pricing">
                <Button className="rounded-full px-6 gap-2 bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Brain, label: 'AI Deal Scoring', desc: 'Every property scored 0-100 based on profit potential' },
                { icon: Search, label: 'Smart Search', desc: 'Multiple data sources combined into one search' },
                { icon: BarChart3, label: 'Market Intel', desc: 'Comparable sales, trends, and neighborhood data' },
                { icon: Bell, label: 'Instant Alerts', desc: 'Get notified the moment high-profit deals appear' },
              ].map((item, index) => (
                <motion.div key={item.label} {...cardFadeIn(index)} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                  <item.icon className="h-6 w-6 text-cyan-400 mb-3" />
                  <h4 className="font-semibold text-sm mb-1">{item.label}</h4>
                  <p className="text-xs text-white/50">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Fade dark to white */}
      <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-[#08090a]" />

      {/* ===== CTA -- LIGHT ===== */}
      <motion.section className="py-24 px-4" {...sectionFadeIn}>
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
            Ready to find your next deal?
          </h2>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto mb-10">
            See it in action. Start your free trial and search your first market in under two minutes.
          </p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full px-10 text-base font-semibold bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 gap-2">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-cyan-400" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Cancel Anytime</span>
          </div>
        </div>
      </motion.section>
    </PublicLayout>
  );
}
