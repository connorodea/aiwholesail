import { useParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, ChevronRight, Search,
  ThermometerSun, Shield, CheckCircle,
  AlertTriangle, Receipt, Scale, UserX, Home, Eye,
  FileWarning, TrendingUp, Tag, Clock,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import cities from '@/data/cities.json';

interface City {
  slug: string;
  city: string;
  state: string;
  stateFull: string;
  population: number;
  medianHomePrice: number;
  avgRent: number;
  priceGrowth: number;
  topZips: string[];
  investorTypes: string[];
  marketTemp: string;
}

interface DistressType {
  slug: string;
  label: string;
  fullLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  longDescription: string;
  color: string;
  bgColor: string;
}

const DISTRESS_TYPES: Record<string, DistressType> = {
  'pre-foreclosure': {
    slug: 'pre-foreclosure',
    label: 'Pre-Foreclosure',
    fullLabel: 'Pre-Foreclosure Properties',
    icon: AlertTriangle,
    description: 'Homes where owners have received notice of default.',
    longDescription: 'Pre-foreclosure properties are owned by homeowners who have fallen behind on mortgage payments and received a notice of default from their lender. These sellers are highly motivated to avoid the credit damage of a full foreclosure. Investors can negotiate directly with these homeowners to acquire properties at significant discounts before the property goes to public auction.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  'tax-delinquent': {
    slug: 'tax-delinquent',
    label: 'Tax Delinquent',
    fullLabel: 'Tax Delinquent Properties',
    icon: Receipt,
    description: 'Properties with unpaid property taxes facing lien or deed sale.',
    longDescription: 'Tax delinquent properties have outstanding property tax balances that can result in tax lien certificate sales or tax deed auctions. Owners may be unaware of the consequences, unable to pay, or simply neglecting the property. Investors can purchase tax liens for interest income or acquire properties through tax deed sales at steep discounts.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  probate: {
    slug: 'probate',
    label: 'Probate',
    fullLabel: 'Probate Properties',
    icon: Scale,
    description: 'Inherited properties going through estate settlement.',
    longDescription: 'Probate properties are being sold as part of an estate settlement after the owner has passed away. Heirs often live out of state, have no emotional attachment to the property, and face ongoing holding costs for taxes, insurance, and maintenance. This creates strong motivation to accept below-market offers for a quick, hassle-free transaction.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  'code-violations': {
    slug: 'code-violations',
    label: 'Code Violations',
    fullLabel: 'Code Violation Properties',
    icon: FileWarning,
    description: 'Properties cited for building code violations.',
    longDescription: 'Properties with active code violations have been cited by the local government for building, health, or safety issues. Owners face escalating fines, potential liens, and mandatory repair orders. Many owners lack the resources or desire to bring properties into compliance and prefer selling to investors who can handle the repairs and navigate the code enforcement process.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
  'absentee-owners': {
    slug: 'absentee-owners',
    label: 'Absentee Owners',
    fullLabel: 'Absentee Owner Properties',
    icon: UserX,
    description: 'Properties owned by out-of-area landlords.',
    longDescription: 'Absentee owner properties are owned by landlords who live in a different city or state from their rental property. Remote management leads to deferred maintenance, difficult tenant situations, and landlord burnout. These owners are often willing to sell below market value to eliminate the ongoing management burden and free up capital for investments closer to home.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  'vacant-properties': {
    slug: 'vacant-properties',
    label: 'Vacant Properties',
    fullLabel: 'Vacant Properties',
    icon: Home,
    description: 'Unoccupied homes draining owners of money each month.',
    longDescription: 'Vacant properties sit empty, costing their owners money every month in property taxes, insurance, HOA dues, and maintenance -- with zero rental income to offset expenses. Vacant homes also attract vandalism, squatters, and code violations. Owners of vacant properties are often eager to sell quickly to stop the financial bleeding.',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
  },
  'high-equity': {
    slug: 'high-equity',
    label: 'High Equity',
    fullLabel: 'High Equity Properties',
    icon: TrendingUp,
    description: 'Properties with 50%+ equity, often owned free and clear.',
    longDescription: 'High equity properties are owned by homeowners with significant equity -- often 50% or more, or fully paid off. These owners have maximum pricing flexibility and may be willing to sell below market for the right terms or a fast close. Many high-equity owners are elderly, facing life transitions, or simply ready to cash out without the hassle of a traditional listing.',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  fsbo: {
    slug: 'fsbo',
    label: 'For Sale By Owner',
    fullLabel: 'For Sale By Owner (FSBO)',
    icon: Tag,
    description: 'Owners selling without an agent, often lacking market knowledge.',
    longDescription: 'For Sale By Owner (FSBO) properties are listed directly by the homeowner without a real estate agent. These sellers often lack market knowledge, pricing expertise, and negotiation experience. They may overprice initially but become increasingly motivated as the property sits. Direct investor outreach can lead to favorable deals with lower transaction costs.',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
  'expired-listings': {
    slug: 'expired-listings',
    label: 'Expired Listings',
    fullLabel: 'Expired Listings',
    icon: Clock,
    description: 'MLS listings that failed to sell. Frustrated, motivated sellers.',
    longDescription: 'Expired listings are properties that were listed on the MLS with a real estate agent but failed to sell before the listing agreement ended. These sellers have already demonstrated intent to sell and are now frustrated that their property did not move. They are often open to price reductions and creative deal structures that a new approach can provide.',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
  },
};

const DISTRESS_SLUGS = Object.keys(DISTRESS_TYPES);

const tempColors: Record<string, string> = {
  hot: 'bg-red-500/10 text-red-500 border-red-500/20',
  warm: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  cool: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const tempLabels: Record<string, string> = {
  hot: 'Hot Market',
  warm: 'Warm Market',
  cool: 'Cool Market',
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function DistressIndex() {
  const { distressType } = useParams<{ distressType: string }>();
  const [searchQuery, setSearchQuery] = useState('');

  const dt = distressType ? DISTRESS_TYPES[distressType] : null;

  const allCities = cities as City[];
  const totalCities = allCities.length;

  const filteredCities = useMemo(() => {
    if (!searchQuery) return allCities;
    const q = searchQuery.toLowerCase();
    return allCities.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.stateFull.toLowerCase().includes(q)
    );
  }, [searchQuery, allCities]);

  if (!dt) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Signal Type Not Found</h1>
          <p className="text-neutral-400 mb-6">
            Invalid distress signal type. Browse our available deal signals.
          </p>
          <Link to="/deals">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <Eye className="h-4 w-4" /> Browse Deal Signals
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const Icon = dt.icon;
  const otherTypes = DISTRESS_SLUGS.filter((s) => s !== distressType).slice(0, 5);

  const hotCities = filteredCities.filter((c) => c.marketTemp === 'hot');
  const warmCities = filteredCities.filter((c) => c.marketTemp === 'warm');
  const coolCities = filteredCities.filter((c) => c.marketTemp === 'cool');

  const renderCityGrid = (cityList: City[], temp: string) => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cityList.map((c) => (
        <Link key={c.slug} to={`/deals/${distressType}/${c.slug}`} className="group">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-cyan-400" />
              <Badge variant="outline" className={`text-[10px] border ${tempColors[temp]}`}>
                {tempLabels[temp]}
              </Badge>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
              {c.city}, {c.state}
            </h3>
            <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
              Median {formatCurrency(c.medianHomePrice)} &middot; {c.priceGrowth}% growth
            </p>
            <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
              View {dt.label.toLowerCase()} deals <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <PublicLayout>
      <SEOHead
        title={`${dt.fullLabel} in ${totalCities} Markets -- Find Deals`}
        description={`Find ${dt.label.toLowerCase()} properties across ${totalCities} US markets. ${dt.description} AI-powered deal signals for real estate investors.`}
        keywords={`${dt.label.toLowerCase()} properties, ${dt.label.toLowerCase()} real estate, ${dt.label.toLowerCase()} deals, ${dt.label.toLowerCase()} investing, distressed properties, motivated sellers`}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/deals" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <Eye className="h-4 w-4" />
              <span>Deal Signals</span>
            </Link>
          </div>

          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${dt.bgColor} mb-6`}>
            <Icon className={`h-7 w-7 ${dt.color}`} />
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {dt.fullLabel}:
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {totalCities} Markets.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {dt.longDescription}
          </p>
        </div>
      </section>

      {/* ===== CROSS LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Other Signals</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {otherTypes.map((s) => {
                const other = DISTRESS_TYPES[s];
                const OtherIcon = other.icon;
                return (
                  <Link key={s} to={`/deals/${s}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                    <OtherIcon className={`h-4 w-4 ${other.color}`} /> {other.fullLabel}
                  </Link>
                );
              })}
              <Link to="/deals" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Eye className="h-4 w-4 text-cyan-400" /> All Deal Signals
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SEARCH ===== */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by city or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-neutral-400 mt-3">
              {filteredCities.length} market{filteredCities.length !== 1 ? 's' : ''} matching &ldquo;{searchQuery}&rdquo;
            </p>
          )}
        </div>
      </section>

      {/* ===== HOT MARKETS ===== */}
      {hotCities.length > 0 && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="outline" className={`text-xs border ${tempColors.hot}`}>
                <ThermometerSun className="h-3 w-3 mr-1" />
                Hot Markets
              </Badge>
              <span className="text-sm text-neutral-500">{hotCities.length} cities</span>
            </div>
            {renderCityGrid(hotCities, 'hot')}
          </div>
        </section>
      )}

      {/* ===== WARM MARKETS ===== */}
      {warmCities.length > 0 && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="outline" className={`text-xs border ${tempColors.warm}`}>
                <ThermometerSun className="h-3 w-3 mr-1" />
                Warm Markets
              </Badge>
              <span className="text-sm text-neutral-500">{warmCities.length} cities</span>
            </div>
            {renderCityGrid(warmCities, 'warm')}
          </div>
        </section>
      )}

      {/* ===== COOL MARKETS ===== */}
      {coolCities.length > 0 && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="outline" className={`text-xs border ${tempColors.cool}`}>
                <ThermometerSun className="h-3 w-3 mr-1" />
                Cool Markets
              </Badge>
              <span className="text-sm text-neutral-500">{coolCities.length} cities</span>
            </div>
            {renderCityGrid(coolCities, 'cool')}
          </div>
        </section>
      )}

      {filteredCities.length === 0 && searchQuery && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl text-center">
            <p className="text-neutral-400">No markets match &ldquo;{searchQuery}&rdquo;. Try a different search term.</p>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find {dt.label.toLowerCase()} deals
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              with AI today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail monitors {dt.label.toLowerCase()} signals daily across {totalCities} markets. Get AI-powered alerts, deal scoring, and automated outreach.
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
