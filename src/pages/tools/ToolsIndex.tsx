import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Calculator, Home, DollarSign, TrendingUp,
  Wrench, BarChart3, Target, Repeat, Percent, Zap, ChevronRight,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { GradientOrbs } from '@/components/effects/GradientOrbs';

const tools = [
  {
    slug: 'mortgage-calculator',
    title: 'Mortgage Calculator',
    description: 'Monthly payments, total interest, and amortization for any loan amount.',
    icon: Home,
    category: 'Finance',
  },
  {
    slug: 'wholesale-deal-calculator',
    title: 'Wholesale Deal Calculator',
    description: 'MAO, spreads, and assignment fees. Know your profit before you offer.',
    icon: DollarSign,
    category: 'Wholesale',
  },
  {
    slug: 'arv-calculator',
    title: 'ARV Calculator',
    description: 'After Repair Value from comparable sales, adjustments, and market trends.',
    icon: TrendingUp,
    category: 'Valuation',
  },
  {
    slug: 'cash-flow-calculator',
    title: 'Cash Flow Calculator',
    description: 'Rental cash flow, cash-on-cash return, cap rate, and GRM analysis.',
    icon: BarChart3,
    category: 'Rental',
  },
  {
    slug: 'rehab-estimator',
    title: 'Rehab Cost Estimator',
    description: 'Room-by-room renovation costs with low, mid, and high ranges.',
    icon: Wrench,
    category: 'Renovation',
  },
  {
    slug: 'brrrr-calculator',
    title: 'BRRRR Calculator',
    description: 'Buy, Rehab, Rent, Refinance, Repeat — full cycle return analysis.',
    icon: Repeat,
    category: 'Strategy',
  },
  {
    slug: 'offer-price-calculator',
    title: 'Offer Price Calculator',
    description: 'Maximum allowable offer using the 70% rule and custom margins.',
    icon: Target,
    category: 'Wholesale',
  },
  {
    slug: 'cap-rate-calculator',
    title: 'Cap Rate Calculator',
    description: 'Capitalization rate, NOI, and property value at different cap rates.',
    icon: Percent,
    category: 'Rental',
  },
];

export default function ToolsIndex() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Real Estate Calculators & Tools"
        description="Free real estate calculators: mortgage, wholesale deal, ARV, cash flow, rehab cost, BRRRR, cap rate, and offer price calculators for investors."
        keywords="real estate calculators, free investment tools, mortgage calculator, arv calculator, wholesale calculator, rental property calculator, cap rate calculator"
      />

      {/* ===== HERO — DARK ===== */}
      <section className="relative bg-[#0a0a0a] text-white overflow-hidden">
        <GradientOrbs variant="hero" />

        {/* Nav */}
        <div className="relative container mx-auto max-w-7xl px-4 pt-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight text-white">AIWholesail</span>
            </Link>
            <Link to="/pricing">
              <Button size="sm" className="rounded-full px-5 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Zap className="h-3.5 w-3.5" /> Start Free Trial
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative container mx-auto max-w-5xl px-4 pt-24 pb-28 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Free Tools</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            Real Estate
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              Calculators.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Professional-grade tools for every real estate strategy.
            No sign up. No cost. Just results.
          </p>
        </div>

        <div className="h-20 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== TOOLS GRID — WHITE ===== */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Calculators</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-16 max-w-lg">
            Pick a calculator.
            <br />Run the numbers.
          </h2>

          {/* Bento grid — 2 large + 6 small */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Featured tools — large */}
            {tools.slice(0, 2).map((tool, i) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.slug} to={`/tools/${tool.slug}`} className="lg:col-span-2 group">
                  <div className="h-full bg-gradient-to-br from-muted/50 to-muted/20 border border-white/[0.06] rounded-3xl p-8 md:p-10 flex flex-col justify-between min-h-[300px] hover:border-primary/20 transition-all duration-300">
                    <div>
                      <Badge className={`${i === 0 ? 'bg-primary/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-600'} border-0 mb-5`}>
                        <Icon className="h-3 w-3 mr-1" /> {tool.category}
                      </Badge>
                      <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{tool.title}</h3>
                      <p className="text-neutral-400 font-light max-w-sm">{tool.description}</p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-sm font-medium text-cyan-400 group-hover:gap-3 transition-all">
                      Open calculator <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Remaining tools — standard cards */}
            {tools.slice(2).map(tool => {
              const Icon = tool.icon;
              return (
              <Link key={tool.slug} to={`/tools/${tool.slug}`} className="group">
                <div className="h-full bg-gradient-to-br from-muted/50 to-muted/20 border border-white/[0.06] rounded-3xl p-7 flex flex-col justify-between min-h-[220px] hover:border-primary/20 transition-all duration-300">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                      <Icon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <h3 className="font-bold tracking-tight mb-2">{tool.title}</h3>
                    <p className="text-sm text-neutral-400 font-light leading-relaxed">{tool.description}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CTA — DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#0f1a14] text-white py-32 px-4 overflow-hidden">
        <GradientOrbs variant="cta" />

        <div className="relative container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Go Further</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Want AI to run
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              the numbers for you?
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail analyzes thousands of properties daily — running every calculation automatically so you can focus on closing deals.
          </p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full px-10 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ===== FOOTER — DARK ===== */}
      <footer className="bg-[#0a0a0a] text-white border-t border-white/5 px-4 py-12">
        <div className="container mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-white">AIWholesail</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
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
