import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  Search,
  Brain,
  SlidersHorizontal,
  LineChart,
  Phone,
  FileSignature,
  Sparkles,
  CheckCircle,
  Shield,
  Zap,
  BarChart3,
  Bell,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

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
  return (
    <PublicLayout>
      <SEOHead
        title="How It Works"
        description="Learn how AIWholesail helps you find profitable real estate deals in 6 simple steps. From market search to closing, powered by AI analysis and real-time data."
        keywords="how AIWholesail works, real estate deal finding steps, AI property analysis process, wholesale real estate workflow, automated deal scoring"
      />

      {/* ===== HERO -- DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-6xl px-4 pt-28 pb-20 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <Sparkles className="h-3 w-3 mr-1.5" /> From Search to Close in Minutes
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[0.95] mb-6">
            How
            <br />
            <span className="bg-gradient-to-r from-neutral-800 via-white to-white bg-clip-text text-transparent">
              AIWholesail works.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
            Six straightforward steps between you and your next profitable deal. No learning curve, no complicated setup -- just results.
          </p>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-[#08090a]" />
      </section>

      {/* ===== 6 STEPS -- LIGHT ===== */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">The Process</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Your path from search to closing.
          </h2>
          <p className="text-lg text-neutral-400 font-light max-w-xl mb-16">
            Every step is designed to save you time and surface the most profitable opportunities first.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((step) => (
              <div
                key={step.number}
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI TECH CALLOUT -- DARK ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
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
              ].map(item => (
                <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                  <item.icon className="h-6 w-6 text-cyan-400 mb-3" />
                  <h4 className="font-semibold text-sm mb-1">{item.label}</h4>
                  <p className="text-xs text-white/50">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Fade dark to white */}
      <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-[#08090a]" />

      {/* ===== CTA -- LIGHT ===== */}
      <section className="py-24 px-4">
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
      </section>
    </PublicLayout>
  );
}
