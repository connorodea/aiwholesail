import { Link } from 'react-router-dom';
import {
  Calculator, Home, DollarSign, TrendingUp,
  Wrench, BarChart3, Target, Repeat, Percent, ChevronRight, ArrowRight,
  Receipt, Clock, Building2, Shield,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

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
  {
    slug: 'wholesale-fee-calculator',
    title: 'Wholesale Fee Calculator',
    description: 'Assignment fee range, MAO at 65/70/75% rules, and wholesaler profit analysis.',
    icon: Receipt,
    category: 'Wholesale',
  },
  {
    slug: 'holding-cost-calculator',
    title: 'Holding Cost Calculator',
    description: 'Total carrying costs by category with impact on profit over your hold period.',
    icon: Clock,
    category: 'Finance',
  },
  {
    slug: '70-percent-rule-calculator',
    title: '70% Rule Calculator',
    description: 'Max offer at 60%, 65%, 70%, 75%, 80%, and custom percentages with profit comparison.',
    icon: Percent,
    category: 'Wholesale',
  },
  {
    slug: 'rental-roi-calculator',
    title: 'Rental ROI Calculator',
    description: 'Cash-on-cash return, cap rate, GRM, monthly cash flow, and 5-year projection.',
    icon: Building2,
    category: 'Rental',
  },
  {
    slug: 'dscr-calculator',
    title: 'DSCR Calculator',
    description: 'Debt service coverage ratio with lender threshold analysis and rent needed to qualify.',
    icon: Shield,
    category: 'Finance',
  },
];

export default function ToolsIndex() {
  return (
    <PublicLayout>
      <SEOHead
        title="Free Real Estate Calculators & Tools"
        description="Free real estate calculators: mortgage, wholesale deal, ARV, cash flow, rehab cost, BRRRR, cap rate, and offer price calculators for investors."
        keywords="real estate calculators, free investment tools, mortgage calculator, arv calculator, wholesale calculator, rental property calculator, cap rate calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Free Tools</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            Real Estate
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Calculators.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed font-light">
            Professional-grade tools for every real estate strategy.
            No sign up. No cost. Just results.
          </p>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="pb-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Calculators</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-16 max-w-lg text-white">
            Pick a calculator.
            <br />Run the numbers.
          </h2>

          {/* Bento grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Featured tools — large */}
            {tools.slice(0, 2).map((tool, i) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.slug} to={`/tools/${tool.slug}`} className="lg:col-span-2 group">
                  <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 md:p-10 flex flex-col justify-between min-h-[300px] hover:border-cyan-500/20 transition-all duration-300">
                    <div>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${i === 0 ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        <Icon className="h-3 w-3" /> {tool.category}
                      </span>
                      <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 mt-5 text-white">{tool.title}</h3>
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
                  <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 flex flex-col justify-between min-h-[220px] hover:border-cyan-500/20 transition-all duration-300">
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:bg-cyan-500/15 transition-colors">
                        <Icon className="h-5 w-5 text-cyan-400" />
                      </div>
                      <h3 className="font-bold tracking-tight mb-2 text-white">{tool.title}</h3>
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

      {/* CTA */}
      <section className="py-32 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Go Further</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6 text-white">
            Want AI to run
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              the numbers for you?
            </span>
          </h2>
          <p className="text-lg text-neutral-400 font-light max-w-xl mx-auto mb-10">
            AIWholesail analyzes thousands of properties daily — running every calculation automatically so you can focus on closing deals.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-10 py-3 rounded-md text-base transition-colors">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
