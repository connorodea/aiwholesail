import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight, ChevronRight, MapPin, Home, Calendar, Ruler,
  DollarSign, Clock, Lightbulb, TrendingUp, Target,
  Repeat, Key, FileText, Wrench, Banknote, BarChart3,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import dealExamples from '@/data/deal-examples.json';

interface DealNumbers {
  mao: number;
  spreadFromARV: number;
  percentBelowARV: number;
  [key: string]: unknown;
}

interface DealExample {
  slug: string;
  title: string;
  strategy: string;
  city: string;
  citySlug: string;
  state: string;
  propertyType: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  purchasePrice: number;
  arv: number;
  rehabCost: number;
  assignmentFee: number;
  totalProfit: number;
  holdingPeriod: string;
  financingUsed: string;
  howFound: string;
  keyLesson: string;
  timeline: string[];
  numbers: DealNumbers;
}

function getStrategyBadge(strategy: string) {
  const map: Record<string, { label: string; bg: string; text: string; border: string }> = {
    wholesale: { label: 'Wholesale', bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
    flip: { label: 'Fix & Flip', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    brrrr: { label: 'BRRRR', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
    rental: { label: 'Buy & Hold', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    creative: { label: 'Creative Finance', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  };
  return map[strategy] || { label: strategy, bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' };
}

function getStrategyIcon(strategy: string) {
  const map: Record<string, typeof TrendingUp> = {
    wholesale: Repeat,
    flip: Home,
    brrrr: Key,
    rental: DollarSign,
    creative: FileText,
  };
  return map[strategy] || TrendingUp;
}

function formatCurrency(n: number): string {
  if (n === 0) return '$0';
  return '$' + n.toLocaleString('en-US');
}

function formatPercent(n: number): string {
  return n.toFixed(1) + '%';
}

export default function DealExamplePage() {
  const { slug } = useParams<{ slug: string }>();
  const deal = (dealExamples as DealExample[]).find((d) => d.slug === slug);

  if (!deal) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Deal Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this deal example.</p>
          <Link to="/deals/examples">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              Browse All Deal Examples
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const badge = getStrategyBadge(deal.strategy);
  const StrategyIcon = getStrategyIcon(deal.strategy);
  const nums = deal.numbers as Record<string, unknown>;

  // Get related deals (same strategy, different slug)
  const relatedDeals = (dealExamples as DealExample[])
    .filter((d) => d.strategy === deal.strategy && d.slug !== deal.slug)
    .slice(0, 3);

  // Build financial breakdown rows
  const financialRows: { label: string; value: string; highlight?: boolean }[] = [];

  if (deal.purchasePrice > 0) {
    financialRows.push({ label: 'Purchase Price', value: formatCurrency(deal.purchasePrice) });
  }
  financialRows.push({ label: 'After Repair Value (ARV)', value: formatCurrency(deal.arv) });

  if (deal.rehabCost > 0) {
    financialRows.push({ label: 'Rehab Cost', value: formatCurrency(deal.rehabCost) });
  }

  if (deal.strategy === 'wholesale') {
    financialRows.push({ label: 'Assignment Fee (Profit)', value: formatCurrency(deal.assignmentFee), highlight: true });
  }

  if (deal.strategy === 'flip') {
    if (typeof nums.closingCosts === 'number') financialRows.push({ label: 'Closing Costs', value: formatCurrency(nums.closingCosts as number) });
    if (typeof nums.holdingCosts === 'number') financialRows.push({ label: 'Holding Costs', value: formatCurrency(nums.holdingCosts as number) });
    if (typeof nums.netProfit === 'number') financialRows.push({ label: 'Net Profit', value: formatCurrency(nums.netProfit as number), highlight: true });
    if (typeof nums.roi === 'number') financialRows.push({ label: 'Return on Investment', value: formatPercent(nums.roi as number), highlight: true });
  }

  if (deal.strategy === 'brrrr') {
    if (typeof nums.totalInvested === 'number') financialRows.push({ label: 'Total Cash Invested', value: formatCurrency(nums.totalInvested as number) });
    if (typeof nums.refinanceAmount === 'number') financialRows.push({ label: 'Refinance Amount', value: formatCurrency(nums.refinanceAmount as number) });
    if (typeof nums.cashRecouped === 'number') financialRows.push({ label: 'Cash Recouped', value: formatCurrency(nums.cashRecouped as number), highlight: true });
    if (typeof nums.monthlyRent === 'number') financialRows.push({ label: 'Monthly Rent', value: formatCurrency(nums.monthlyRent as number) });
    if (typeof nums.monthlyExpenses === 'number') financialRows.push({ label: 'Monthly Expenses', value: formatCurrency(nums.monthlyExpenses as number) });
    if (typeof nums.monthlyCashFlow === 'number') financialRows.push({ label: 'Monthly Cash Flow', value: formatCurrency(nums.monthlyCashFlow as number) + '/mo', highlight: true });
    if (typeof nums.cashOnCashReturn === 'string') financialRows.push({ label: 'Cash-on-Cash Return', value: nums.cashOnCashReturn as string, highlight: true });
  }

  if (deal.strategy === 'rental') {
    if (typeof nums.totalInvested === 'number') financialRows.push({ label: 'Total Cash Invested', value: formatCurrency(nums.totalInvested as number) });
    if (typeof nums.monthlyRent === 'number') financialRows.push({ label: 'Monthly Rent', value: formatCurrency(nums.monthlyRent as number) });
    if (typeof nums.monthlyMortgage === 'number') financialRows.push({ label: 'Monthly Mortgage', value: formatCurrency(nums.monthlyMortgage as number) });
    if (typeof nums.monthlyExpenses === 'number') financialRows.push({ label: 'Monthly Expenses (Tax, Ins, PM, Maint)', value: formatCurrency(nums.monthlyExpenses as number) });
    if (typeof nums.monthlyCashFlow === 'number') financialRows.push({ label: 'Monthly Cash Flow', value: formatCurrency(nums.monthlyCashFlow as number) + '/mo', highlight: true });
    if (typeof nums.annualCashFlow === 'number') financialRows.push({ label: 'Annual Cash Flow', value: formatCurrency(nums.annualCashFlow as number) + '/yr', highlight: true });
    if (typeof nums.cashOnCashReturn === 'number') financialRows.push({ label: 'Cash-on-Cash Return', value: formatPercent(nums.cashOnCashReturn as number), highlight: true });
    if (typeof nums.capRate === 'number') financialRows.push({ label: 'Cap Rate', value: formatPercent(nums.capRate as number) });
  }

  if (deal.strategy === 'creative') {
    if (typeof nums.existingMortgageBalance === 'number') financialRows.push({ label: 'Existing Mortgage Balance', value: formatCurrency(nums.existingMortgageBalance as number) });
    if (typeof nums.existingMortgageRate === 'number') financialRows.push({ label: 'Existing Rate', value: formatPercent(nums.existingMortgageRate as number) });
    if (typeof nums.existingMortgagePayment === 'number') financialRows.push({ label: 'Existing Payment', value: formatCurrency(nums.existingMortgagePayment as number) + '/mo' });
    if (typeof nums.downPayment === 'number') financialRows.push({ label: 'Down Payment', value: formatCurrency(nums.downPayment as number) });
    if (typeof nums.sellerFinanceBalance === 'number') financialRows.push({ label: 'Seller Finance Balance', value: formatCurrency(nums.sellerFinanceBalance as number) });
    if (typeof nums.sellerFinanceRate === 'number') financialRows.push({ label: 'Seller Finance Rate', value: formatPercent(nums.sellerFinanceRate as number) });
    if (typeof nums.sellerFinancePayment === 'number') financialRows.push({ label: 'Seller Finance Payment', value: formatCurrency(nums.sellerFinancePayment as number) + '/mo' });
    if (typeof nums.wrapSalePrice === 'number') financialRows.push({ label: 'Wrap Sale Price', value: formatCurrency(nums.wrapSalePrice as number) });
    if (typeof nums.wrapDownPayment === 'number') financialRows.push({ label: 'Wrap Down Payment Received', value: formatCurrency(nums.wrapDownPayment as number) });
    if (typeof nums.wrapRate === 'number') financialRows.push({ label: 'Wrap Rate to Buyer', value: formatPercent(nums.wrapRate as number) });
    if (typeof nums.wrapPayment === 'number') financialRows.push({ label: 'Wrap Payment Received', value: formatCurrency(nums.wrapPayment as number) + '/mo' });
    if (typeof nums.monthlyRent === 'number') financialRows.push({ label: 'Monthly Rent', value: formatCurrency(nums.monthlyRent as number) + '/mo' });
    if (typeof nums.monthlyExpenses === 'number') financialRows.push({ label: 'Monthly Expenses', value: formatCurrency(nums.monthlyExpenses as number) + '/mo' });
    if (typeof nums.monthlyCashFlow === 'number') financialRows.push({ label: 'Monthly Cash Flow', value: formatCurrency(nums.monthlyCashFlow as number) + '/mo', highlight: true });
    if (typeof nums.monthlySpread === 'number') financialRows.push({ label: 'Monthly Spread (Profit)', value: formatCurrency(nums.monthlySpread as number) + '/mo', highlight: true });
    if (typeof nums.annualCashFlow === 'number') financialRows.push({ label: 'Annual Cash Flow', value: formatCurrency(nums.annualCashFlow as number) + '/yr', highlight: true });
    if (typeof nums.annualSpread === 'number') financialRows.push({ label: 'Annual Spread', value: formatCurrency(nums.annualSpread as number) + '/yr', highlight: true });
    if (typeof nums.equityPosition === 'number') financialRows.push({ label: 'Equity Position', value: formatCurrency(nums.equityPosition as number) });
    if (typeof nums.cashOutOfPocket === 'number') financialRows.push({ label: 'Cash Out of Pocket', value: formatCurrency(nums.cashOutOfPocket as number) });
    if (typeof nums.cashOnCashReturn === 'number') financialRows.push({ label: 'Cash-on-Cash Return', value: formatPercent(nums.cashOnCashReturn as number), highlight: true });
  }

  return (
    <PublicLayout>
      <SEOHead
        title={`${deal.title} -- Full Financial Breakdown | AIWholesail`}
        description={`Real ${badge.label.toLowerCase()} deal case study in ${deal.city}, ${deal.state}. ${deal.propertyType}, ${deal.beds}BR/${deal.baths}BA. Full numbers, timeline, and lessons learned.`}
        keywords={`${deal.strategy} deal example, ${deal.city} real estate deal, ${deal.propertyType.toLowerCase()} investment, ${badge.label.toLowerCase()} case study, real estate deal breakdown ${deal.city}`}
        canonicalUrl={`https://aiwholesail.com/deals/examples/${deal.slug}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Deal Examples', url: 'https://aiwholesail.com/deals/examples' },
          { name: deal.title, url: `https://aiwholesail.com/deals/examples/${deal.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          {/* Breadcrumbs */}
          <nav className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 mb-8">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/deals/examples" className="hover:text-white transition-colors">Deal Examples</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-400 truncate max-w-[200px]">{deal.city}, {deal.state}</span>
          </nav>

          {/* Strategy badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
              <StrategyIcon className="h-3.5 w-3.5" />
              {badge.label}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.04] text-neutral-400 border border-white/[0.06]">
              <MapPin className="h-3 w-3" /> {deal.city}, {deal.state}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {deal.title}
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Full financial breakdown, step-by-step timeline, and key lessons from this real-world {badge.label.toLowerCase()} deal.
          </p>
        </div>
      </section>

      {/* ===== PROPERTY SPECS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-6">Property Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Home className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Type</span>
                </div>
                <p className="text-sm font-semibold text-white">{deal.propertyType}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Ruler className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Size</span>
                </div>
                <p className="text-sm font-semibold text-white">{deal.beds}bd / {deal.baths}ba / {deal.sqft.toLocaleString()} sqft</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Year Built</span>
                </div>
                <p className="text-sm font-semibold text-white">{deal.yearBuilt}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Holding Period</span>
                </div>
                <p className="text-sm font-semibold text-white">{deal.holdingPeriod}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-white/[0.06]">
              <div className="flex items-start gap-2">
                <Wrench className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">How Found</span>
                  <p className="text-sm text-white mt-1">{deal.howFound}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Banknote className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Financing</span>
                  <p className="text-sm text-white mt-1">{deal.financingUsed}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINANCIAL BREAKDOWN ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Financial Breakdown</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            The Numbers
          </h2>

          <div className="border border-white/[0.05] rounded-xl overflow-hidden">
            {financialRows.map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-6 py-4 ${
                  i !== financialRows.length - 1 ? 'border-b border-white/[0.05]' : ''
                } ${row.highlight ? 'bg-cyan-500/[0.04]' : ''}`}
              >
                <span className={`text-sm ${row.highlight ? 'font-semibold text-white' : 'text-neutral-400'}`}>
                  {row.label}
                </span>
                <span className={`text-sm font-semibold ${row.highlight ? 'text-cyan-400' : 'text-white'}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Numbers Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {deal.numbers.mao > 0 && (
              <div className="border border-white/[0.06] rounded-xl p-5 text-center bg-white/[0.01]">
                <Target className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
                <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Max Allowable Offer</p>
                <p className="text-xl font-bold text-white">{formatCurrency(deal.numbers.mao)}</p>
                <p className="text-[10px] text-neutral-500 mt-1">70% Rule</p>
              </div>
            )}
            <div className="border border-white/[0.06] rounded-xl p-5 text-center bg-white/[0.01]">
              <BarChart3 className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Spread from ARV</p>
              <p className="text-xl font-bold text-white">{formatCurrency(deal.numbers.spreadFromARV)}</p>
              <p className="text-[10px] text-neutral-500 mt-1">Total margin in the deal</p>
            </div>
            <div className="border border-white/[0.06] rounded-xl p-5 text-center bg-white/[0.01]">
              <TrendingUp className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">% Below ARV</p>
              <p className="text-xl font-bold text-white">{formatPercent(deal.numbers.percentBelowARV)}</p>
              <p className="text-[10px] text-neutral-500 mt-1">Discount from market value</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TIMELINE ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Step by Step</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            Deal Timeline
          </h2>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-500/40 via-cyan-500/20 to-transparent" />

            <div className="space-y-6">
              {deal.timeline.map((step, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  {/* Number circle */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center z-10">
                    <span className="text-xs font-bold text-cyan-400">{i + 1}</span>
                  </div>
                  {/* Content */}
                  <div className="pt-2">
                    <p className="text-sm text-neutral-300 leading-relaxed">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== KEY LESSON ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.06] to-transparent rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Lightbulb className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-3">Key Lesson</h3>
                <p className="text-lg text-white leading-relaxed font-light">
                  "{deal.keyLesson}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RELATED DEALS ===== */}
      {relatedDeals.length > 0 && (
        <section className="py-16 px-4 border-t border-white/[0.06]">
          <div className="container mx-auto max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">More Examples</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
              Related {badge.label} Deals
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {relatedDeals.map((rd) => {
                const rdBadge = getStrategyBadge(rd.strategy);
                return (
                  <Link
                    key={rd.slug}
                    to={`/deals/examples/${rd.slug}`}
                    className="group border border-white/[0.06] bg-gradient-to-b from-neutral-900/40 to-transparent rounded-xl p-5 hover:border-cyan-500/20 hover:bg-white/[0.02] transition-all"
                  >
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${rdBadge.bg} ${rdBadge.text} mb-3`}>
                      {rdBadge.label}
                    </span>
                    <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors leading-snug">
                      {rd.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
                      <MapPin className="h-3 w-3" /> {rd.city}, {rd.state}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 group-hover:gap-2.5 transition-all">
                      View Breakdown <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="py-20 px-4 border-t border-white/[0.06]">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            FIND DEALS LIKE THIS
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Ready to Find {badge.label} Deals in {deal.city}?
          </h2>
          <p className="text-neutral-400 mb-8 max-w-xl mx-auto">
            AIWholesail helps investors find off-market properties, analyze deals with AI, and close faster in {deal.city} and {(dealExamples as DealExample[]).length - 1}+ other markets.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors text-sm"
            >
              Start Finding Deals <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/deals/examples"
              className="inline-flex items-center gap-2 px-8 py-3.5 border border-white/[0.1] text-white rounded-lg hover:bg-white/[0.04] transition-colors text-sm"
            >
              Browse All Examples
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
