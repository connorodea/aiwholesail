import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, ChevronRight, Scale, Shield,
  CheckCircle, XCircle, Lightbulb, Building2, FileText,
  Repeat, Hammer, RefreshCw, FileKey, Handshake, BookOpen,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import strategyStates from '@/data/strategy-states.json';

interface StrategyState {
  slug: string;
  strategy: string;
  strategyLabel: string;
  state: string;
  stateFull: string;
  legal: boolean;
  licenseRequired: boolean;
  avgDealSize: number;
  topCities: string[];
  marketConditions: string;
  regulations: string;
  tips: string[];
}

const strategyIcons: Record<string, React.ReactNode> = {
  wholesale: <Repeat className="h-5 w-5" />,
  flip: <Hammer className="h-5 w-5" />,
  rental: <Building2 className="h-5 w-5" />,
  brrrr: <RefreshCw className="h-5 w-5" />,
  'subject-to': <FileKey className="h-5 w-5" />,
  'seller-financing': <Handshake className="h-5 w-5" />,
};

function slugToCity(slug: string): string {
  const parts = slug.split('-');
  const stateCode = parts.pop() || '';
  return parts
    .map((w) => (w === 'st' ? 'St.' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ') + ', ' + stateCode.toUpperCase();
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function getRelated(current: StrategyState): StrategyState[] {
  const all = strategyStates as StrategyState[];
  // Same state, different strategies
  return all
    .filter((s) => s.state === current.state && s.strategy !== current.strategy)
    .slice(0, 5);
}

export default function StrategyStatePage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = (strategyStates as StrategyState[]).find((s) => s.slug === slug);

  if (!entry) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Page Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this strategy-state combination.</p>
          <Link to="/strategies">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <MapPin className="h-4 w-4" /> Browse All Strategies
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const related = getRelated(entry);
  const stateSlug = entry.stateFull.toLowerCase().replace(/\s+/g, '-');
  const icon = strategyIcons[entry.strategy] || <Repeat className="h-5 w-5" />;

  return (
    <PublicLayout>
      <SEOHead
        title={`${entry.strategyLabel} in ${entry.stateFull} -- Real Estate Investing Guide 2026`}
        description={`${entry.strategyLabel} real estate investing in ${entry.stateFull}. ${entry.marketConditions} Legal status, top cities, regulations, and expert tips.`}
        keywords={`${entry.strategyLabel.toLowerCase()} ${entry.stateFull.toLowerCase()}, ${entry.strategy} real estate ${entry.state}, how to ${entry.strategy} in ${entry.stateFull.toLowerCase()}, ${entry.stateFull.toLowerCase()} real estate investing, ${entry.strategy} deals ${entry.state}`}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/strategies" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <MapPin className="h-4 w-4" />
              <span>All Strategies</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <span className="text-sm text-white/50">{entry.stateFull}</span>
          </div>

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-6">
            {icon}
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {entry.strategyLabel} in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {entry.stateFull}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {entry.marketConditions}
          </p>
        </div>
      </section>

      {/* ===== QUICK STATS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Quick Stats</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {entry.stateFull} at a glance.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                <Scale className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Legal Status</p>
              <span className="flex items-center gap-1.5">
                {entry.legal ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span className={`text-sm font-medium ${entry.legal ? 'text-emerald-400' : 'text-red-400'}`}>
                  {entry.legal ? 'Legal' : 'Restricted'}
                </span>
              </span>
            </div>

            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                <FileText className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">License Required</p>
              <span className="flex items-center gap-1.5">
                {entry.licenseRequired ? (
                  <XCircle className="h-4 w-4 text-amber-400" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                )}
                <span className={`text-sm font-medium ${entry.licenseRequired ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {entry.licenseRequired ? 'Yes' : 'No'}
                </span>
              </span>
            </div>

            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                <Building2 className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Avg Deal Profit</p>
              <p className="text-2xl font-bold tracking-tight text-white">{formatCurrency(entry.avgDealSize)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LEGAL STATUS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Legal Status</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            {entry.strategyLabel} legality in {entry.stateFull}.
          </h2>
          <div className="max-w-3xl">
            <div className={`border rounded-xl p-8 ${
              entry.legal && !entry.licenseRequired
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : entry.legal && entry.licenseRequired
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-red-500/20 bg-red-500/5'
            }`}>
              <div className="flex items-start gap-4">
                {entry.legal && !entry.licenseRequired ? (
                  <CheckCircle className="h-6 w-6 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : entry.legal && entry.licenseRequired ? (
                  <Scale className="h-6 w-6 text-amber-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {entry.legal && !entry.licenseRequired
                      ? `${entry.strategyLabel} is legal in ${entry.stateFull} without a license.`
                      : entry.legal && entry.licenseRequired
                        ? `${entry.strategyLabel} is legal in ${entry.stateFull}, but a license may be required.`
                        : `${entry.strategyLabel} may face restrictions in ${entry.stateFull}.`}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed">
                    {entry.regulations}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TOP CITIES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Top Markets</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8 max-w-2xl">
            Best cities for {entry.strategyLabel.toLowerCase()} in {entry.stateFull}.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {entry.topCities.map((citySlug) => (
              <Link key={citySlug} to={`/invest/${entry.strategy}/${citySlug}`} className="group">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    <Badge variant="outline" className="text-[10px] border-cyan-500/20 text-cyan-400">
                      {entry.strategyLabel}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {slugToCity(citySlug)}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
                    View {entry.strategyLabel.toLowerCase()} opportunities
                  </p>
                  <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore market <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MARKET CONDITIONS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Market Conditions</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            Why {entry.stateFull} for {entry.strategyLabel.toLowerCase()}?
          </h2>
          <div className="max-w-3xl">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <p className="text-sm text-neutral-300 font-light leading-relaxed">
                {entry.marketConditions}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TIPS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Expert Tips</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8 max-w-2xl">
            Tips for {entry.strategyLabel.toLowerCase()} in {entry.stateFull}.
          </h2>
          <div className="max-w-3xl space-y-4">
            {entry.tips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-4 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-sm text-neutral-300 font-light leading-relaxed pt-2">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Related Pages</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Link
                to={`/laws/${stateSlug}`}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <Scale className="h-4 w-4 text-cyan-400" /> {entry.stateFull} Wholesaling Laws
              </Link>
              <Link
                to={`/states/${stateSlug}`}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <MapPin className="h-4 w-4 text-cyan-400" /> {entry.stateFull} Market Data
              </Link>
              <Link
                to={`/invest/${entry.strategy}`}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <BookOpen className="h-4 w-4 text-cyan-400" /> {entry.strategyLabel} Markets
              </Link>
              <Link
                to="/strategies"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <Building2 className="h-4 w-4 text-cyan-400" /> All Strategies
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RELATED STRATEGIES IN SAME STATE ===== */}
      {related.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Related Strategies</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
              Other strategies in {entry.stateFull}.
            </h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
              {related.map((r) => (
                <Link key={r.slug} to={`/strategies/${r.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-cyan-400">{strategyIcons[r.strategy]}</span>
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {r.strategyLabel}
                    </h3>
                    <p className="text-xs text-neutral-500 mb-3 flex-1">
                      Avg. {formatCurrency(r.avgDealSize)} profit
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Start {entry.strategyLabel.toLowerCase()} in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {entry.stateFull} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail helps you find {entry.strategyLabel.toLowerCase()} deals in {entry.stateFull} with AI-powered
            deal scoring, instant comps, and automated seller outreach.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
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
