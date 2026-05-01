import { Link } from 'react-router-dom';
import {
  ArrowRight, MapPin, ChevronRight, Shield, CheckCircle,
  AlertTriangle, Receipt, Scale, UserX, Home, Eye,
  FileWarning, TrendingUp, Tag, Clock,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import cities from '@/data/cities.json';

const DISTRESS_TYPES = [
  {
    slug: 'pre-foreclosure',
    label: 'Pre-Foreclosure',
    icon: AlertTriangle,
    description: 'Homeowners who have received notice of default but have not yet gone to auction. Highly motivated sellers willing to negotiate.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  {
    slug: 'tax-delinquent',
    label: 'Tax Delinquent',
    icon: Receipt,
    description: 'Properties with unpaid property taxes. Owners face tax lien sales or tax deed auctions if balances remain unpaid.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  {
    slug: 'probate',
    label: 'Probate',
    icon: Scale,
    description: 'Inherited properties going through estate settlement. Heirs often prioritize a fast, simple sale over maximizing price.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    slug: 'code-violations',
    label: 'Code Violations',
    icon: FileWarning,
    description: 'Properties cited for building code violations. Owners face fines and may prefer selling to investors who can handle repairs.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
  {
    slug: 'absentee-owners',
    label: 'Absentee Owners',
    icon: UserX,
    description: 'Out-of-area landlords managing remotely. Often tired, burned out, and open to selling below market to eliminate the hassle.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    slug: 'vacant-properties',
    label: 'Vacant Properties',
    icon: Home,
    description: 'Unoccupied homes costing owners money every month in taxes, insurance, and maintenance with zero return.',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
  },
  {
    slug: 'high-equity',
    label: 'High Equity',
    icon: TrendingUp,
    description: 'Properties with 50%+ equity owned free and clear or with small balances. Owners have maximum flexibility on price.',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  {
    slug: 'fsbo',
    label: 'For Sale By Owner',
    icon: Tag,
    description: 'Owners selling without an agent. Often lack market knowledge and are open to direct investor offers.',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
  {
    slug: 'expired-listings',
    label: 'Expired Listings',
    icon: Clock,
    description: 'Properties that failed to sell through MLS. Sellers are frustrated, motivated, and ready for a new approach.',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
  },
];

const totalCities = (cities as unknown[]).length;

export default function DealsHub() {
  return (
    <PublicLayout>
      <SEOHead
        title={`Distressed Property Deals: ${totalCities} Markets, 9 Signal Types`}
        description={`Find distressed property opportunities across ${totalCities} US markets. Pre-foreclosures, tax delinquent, probate, vacant, absentee owners, and more. AI-powered deal signals for real estate investors.`}
        keywords="distressed properties, pre-foreclosure deals, tax delinquent properties, probate real estate, absentee owner properties, vacant homes, fsbo, expired listings, code violations, real estate deals"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/markets" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <MapPin className="h-4 w-4" />
              <span>Markets</span>
            </Link>
          </div>

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-6">
            <Eye className="h-7 w-7" />
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Distress Signal
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Directory.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            9 distress signals across {totalCities} markets. Find motivated sellers, off-market opportunities, and below-market deals powered by AI.
          </p>
        </div>
      </section>

      {/* ===== DISTRESS TYPE CARDS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Deal Signals</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Choose a distress signal.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Each signal type identifies a different kind of motivated seller. Browse {totalCities} markets for each type.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DISTRESS_TYPES.map((dt) => {
              const Icon = dt.icon;
              return (
                <Link key={dt.slug} to={`/deals/${dt.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className={`w-12 h-12 rounded-xl ${dt.bgColor} flex items-center justify-center mb-5`}>
                      <Icon className={`h-5 w-5 ${dt.color}`} />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-white mb-3 group-hover:text-cyan-400 transition-colors">
                      {dt.label}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light leading-relaxed flex-1">
                      {dt.description}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-neutral-500">{totalCities} markets</span>
                      <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Browse markets <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CROSS LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Related</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Link to="/markets" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <MapPin className="h-4 w-4 text-cyan-400" /> All {totalCities} Markets
              </Link>
              <Link to="/invest/wholesale" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <TrendingUp className="h-4 w-4 text-cyan-400" /> Wholesale Strategy
              </Link>
              <Link to="/guides" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Eye className="h-4 w-4 text-cyan-400" /> Investor Guides
              </Link>
              <Link to="/tools" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <TrendingUp className="h-4 w-4 text-cyan-400" /> Free Tools
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find motivated sellers
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              before anyone else.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans distress signals daily across {totalCities} markets. Get AI-powered alerts, deal scoring, and automated outreach.
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
