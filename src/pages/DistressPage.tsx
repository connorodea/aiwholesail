import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Users,
  Home, ChevronRight, Calculator, BookOpen,
  ThermometerSun, Zap, Shield, CheckCircle, BarChart3,
  AlertTriangle, Receipt, Scale, UserX, Eye,
  FileWarning, Tag, Clock, Target,
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
  color: string;
  bgColor: string;
  whyInvest: (city: City) => string;
  getMetrics: (city: City) => { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[];
  relatedStrategy: string;
  relatedGuide: string;
  relatedTool: string;
  relatedToolLabel: string;
}

const DISTRESS_TYPES: Record<string, DistressType> = {
  'pre-foreclosure': {
    slug: 'pre-foreclosure',
    label: 'Pre-Foreclosure',
    fullLabel: 'Pre-Foreclosure Homes',
    icon: AlertTriangle,
    description: 'Homes where owners have received a notice of default from their lender. These homeowners are behind on mortgage payments and face public auction if they cannot resolve the debt. Pre-foreclosure represents the window between default notice and auction date -- typically 90 to 120 days -- during which investors can negotiate directly with highly motivated sellers.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    whyInvest: (c) => {
      const estCount = Math.round(c.population / 5000);
      const avgDiscount = c.medianHomePrice * 0.15;
      return `${c.city} has an estimated ${estCount} pre-foreclosure filings at any given time, based on a population of ${(c.population / 1000).toFixed(0)}K. With a median home price of $${c.medianHomePrice.toLocaleString()}, investors can target average discounts of $${avgDiscount.toLocaleString()} per deal. ${c.marketTemp === 'hot' ? 'Hot market conditions mean acquired properties appreciate quickly after purchase.' : c.marketTemp === 'warm' ? 'Warm market dynamics balance seller motivation with strong resale potential.' : 'Cool market conditions often correlate with higher distress rates, expanding the pipeline.'} The ${c.priceGrowth}% annual price growth in ${c.city} adds built-in equity gains to every pre-foreclosure acquisition.`;
    },
    getMetrics: (c) => {
      const estCount = Math.round(c.population / 5000);
      const avgDiscount = c.medianHomePrice * 0.15;
      return [
        { label: 'Est. Active Pre-Foreclosures', value: estCount.toLocaleString(), icon: AlertTriangle },
        { label: 'Avg Discount Below Market', value: `$${avgDiscount.toLocaleString()}`, icon: Target },
        { label: 'Typical Timeline', value: '90-120 days', icon: Clock },
        { label: 'Median Home Price', value: `$${c.medianHomePrice.toLocaleString()}`, icon: Home },
      ];
    },
    relatedStrategy: 'pre-foreclosure',
    relatedGuide: 'wholesale-real-estate-beginners-guide',
    relatedTool: '/tools/wholesale-deal-calculator',
    relatedToolLabel: 'Deal Calculator',
  },
  'tax-delinquent': {
    slug: 'tax-delinquent',
    label: 'Tax Delinquent',
    fullLabel: 'Tax Delinquent Properties',
    icon: Receipt,
    description: 'Properties with unpaid property taxes that face tax lien certificate sales or tax deed auctions. When homeowners fail to pay property taxes, the county places a lien on the property. Investors can purchase these liens for guaranteed interest returns, or acquire the properties outright through tax deed sales at a fraction of market value.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    whyInvest: (c) => {
      const estCount = Math.round(c.population / 3000);
      const avgLien = c.medianHomePrice * 0.02;
      return `${c.city} has an estimated ${estCount} tax-delinquent properties based on national averages applied to a population of ${(c.population / 1000).toFixed(0)}K. Average tax lien amounts of approximately $${avgLien.toLocaleString()} against properties valued at $${c.medianHomePrice.toLocaleString()} create strong risk-adjusted returns. ${c.marketTemp === 'hot' ? 'High property values amplify the equity position for unredeemed liens.' : c.marketTemp === 'warm' ? 'Moderate values provide a balanced risk-return profile.' : 'Cool markets typically have higher delinquency rates, expanding investment opportunity.'} ${c.stateFull} offers unique tax lien or tax deed procedures that experienced investors can leverage.`;
    },
    getMetrics: (c) => {
      const estCount = Math.round(c.population / 3000);
      const avgLien = c.medianHomePrice * 0.02;
      return [
        { label: 'Est. Tax Delinquent Properties', value: estCount.toLocaleString(), icon: Receipt },
        { label: 'Avg Tax Lien Amount', value: `$${avgLien.toLocaleString()}`, icon: DollarSign },
        { label: 'Statutory Interest Range', value: '8-18%', icon: TrendingUp },
        { label: 'Median Home Price', value: `$${c.medianHomePrice.toLocaleString()}`, icon: Home },
      ];
    },
    relatedStrategy: 'tax-lien',
    relatedGuide: 'how-to-analyze-real-estate-deals',
    relatedTool: '/tools/offer-price-calculator',
    relatedToolLabel: 'Offer Price Calculator',
  },
  probate: {
    slug: 'probate',
    label: 'Probate',
    fullLabel: 'Probate Properties',
    icon: Scale,
    description: 'Inherited properties being sold through the estate settlement process. When a property owner passes away, their real estate enters probate court. Heirs and executors must decide whether to keep, rent, or sell the property. Many choose to sell quickly to divide assets among beneficiaries, avoid ongoing holding costs, and close out the estate.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    whyInvest: (c) => {
      const estCount = Math.round(c.population / 8000);
      const discount = c.medianHomePrice * 0.15;
      return `${c.city} sees an estimated ${estCount} probate property listings annually, driven by a population of ${(c.population / 1000).toFixed(0)}K. Probate properties typically sell at 10-20% below market, representing average discounts of $${discount.toLocaleString()} against the $${c.medianHomePrice.toLocaleString()} median. Heirs are motivated by holding costs, out-of-state logistics, and the desire to close the estate quickly. ${c.marketTemp === 'hot' ? 'Strong demand means probate acquisitions can be resold quickly.' : c.marketTemp === 'warm' ? 'Balanced markets support both flip and hold exit strategies.' : 'Less competition in cool markets gives investors more negotiation leverage.'}`;
    },
    getMetrics: (c) => {
      const estCount = Math.round(c.population / 8000);
      const discount = c.medianHomePrice * 0.15;
      return [
        { label: 'Est. Annual Probate Listings', value: estCount.toLocaleString(), icon: Scale },
        { label: 'Typical Discount', value: `$${discount.toLocaleString()}`, icon: Target },
        { label: 'Avg Settlement Timeline', value: '6-12 months', icon: Clock },
        { label: 'Median Home Price', value: `$${c.medianHomePrice.toLocaleString()}`, icon: Home },
      ];
    },
    relatedStrategy: 'probate',
    relatedGuide: 'wholesale-real-estate-beginners-guide',
    relatedTool: '/tools/wholesale-deal-calculator',
    relatedToolLabel: 'Deal Calculator',
  },
  'code-violations': {
    slug: 'code-violations',
    label: 'Code Violations',
    fullLabel: 'Code Violation Properties',
    icon: FileWarning,
    description: 'Properties cited by local government for building code, health, or safety violations. Owners face fines, mandatory repairs, and potential liens. Many property owners lack the resources or motivation to bring properties into compliance. Investors who can navigate the code enforcement process and handle repairs can acquire these properties at significant discounts.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    whyInvest: (c) => {
      const estCount = Math.round(c.population / 4000);
      const avgRehab = c.medianHomePrice * 0.18;
      const purchasePrice = c.medianHomePrice * 0.55;
      return `${c.city} has an estimated ${estCount} active code violation cases. Properties with violations typically sell for 40-50% below market, around $${purchasePrice.toLocaleString()} against the $${c.medianHomePrice.toLocaleString()} median. With estimated rehab costs of $${avgRehab.toLocaleString()}, investors can target strong margins. ${c.marketTemp === 'hot' ? 'Rehabbed properties sell quickly in hot markets.' : c.marketTemp === 'warm' ? 'Steady demand supports reliable exit timelines.' : 'Lower base prices in cool markets mean lower absolute risk.'} Code violation properties are among the most deeply discounted deal types available.`;
    },
    getMetrics: (c) => {
      const estCount = Math.round(c.population / 4000);
      const purchasePrice = c.medianHomePrice * 0.55;
      const avgRehab = c.medianHomePrice * 0.18;
      return [
        { label: 'Est. Code Violation Properties', value: estCount.toLocaleString(), icon: FileWarning },
        { label: 'Typical Purchase Price', value: `$${purchasePrice.toLocaleString()}`, icon: DollarSign },
        { label: 'Est. Rehab Cost', value: `$${avgRehab.toLocaleString()}`, icon: Target },
        { label: 'Median Home Price', value: `$${c.medianHomePrice.toLocaleString()}`, icon: Home },
      ];
    },
    relatedStrategy: 'distressed',
    relatedGuide: 'how-to-analyze-real-estate-deals',
    relatedTool: '/tools/rehab-estimator',
    relatedToolLabel: 'Rehab Estimator',
  },
  'absentee-owners': {
    slug: 'absentee-owners',
    label: 'Absentee Owners',
    fullLabel: 'Absentee Owner Properties',
    icon: UserX,
    description: 'Properties owned by landlords who live in a different city or state. Remote management leads to deferred maintenance, tenant issues, and landlord burnout. Out-of-area owners often struggle with property management logistics and are motivated to sell to avoid ongoing hassle, especially when facing vacancies, repairs, or difficult tenants.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    whyInvest: (c) => {
      const absenteeRate = c.marketTemp === 'hot' ? 20 : c.marketTemp === 'warm' ? 22 : 25;
      const estCount = Math.round(c.population * 0.4 * absenteeRate / 100);
      const avgDiscount = c.medianHomePrice * 0.1;
      return `An estimated ${absenteeRate}% of rental properties in ${c.city} are owned by absentee landlords, representing approximately ${estCount.toLocaleString()} properties. These owners typically accept 8-12% below market, averaging $${avgDiscount.toLocaleString()} in discounts. ${c.marketTemp === 'hot' ? 'Rising property values create selling urgency for landlords who have not kept up with appreciation.' : c.marketTemp === 'warm' ? 'Stable markets create a consistent flow of tired landlords ready to exit.' : 'Higher vacancy rates in cool markets amplify landlord motivation.'} Average rents of $${c.avgRent.toLocaleString()}/mo make acquired properties attractive for hold or flip.`;
    },
    getMetrics: (c) => {
      const absenteeRate = c.marketTemp === 'hot' ? 20 : c.marketTemp === 'warm' ? 22 : 25;
      const estCount = Math.round(c.population * 0.4 * absenteeRate / 100);
      const avgDiscount = c.medianHomePrice * 0.1;
      return [
        { label: 'Est. Absentee Properties', value: estCount.toLocaleString(), icon: UserX },
        { label: 'Avg Discount', value: `$${avgDiscount.toLocaleString()}`, icon: Target },
        { label: 'Absentee Rate', value: `~${absenteeRate}%`, icon: BarChart3 },
        { label: 'Avg Rent', value: `$${c.avgRent.toLocaleString()}/mo`, icon: Home },
      ];
    },
    relatedStrategy: 'absentee-owner',
    relatedGuide: 'wholesale-real-estate-beginners-guide',
    relatedTool: '/tools/wholesale-deal-calculator',
    relatedToolLabel: 'Deal Calculator',
  },
  'vacant-properties': {
    slug: 'vacant-properties',
    label: 'Vacant Properties',
    fullLabel: 'Vacant Properties',
    icon: Home,
    description: 'Unoccupied homes that cost their owners money every month in property taxes, insurance, HOA dues, and maintenance -- all with zero rental income to offset expenses. Vacant properties also attract vandalism, squatters, and code violations, creating additional liability for the owner. These factors create strong motivation to sell.',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    whyInvest: (c) => {
      const vacancyRate = c.marketTemp === 'hot' ? 4 : c.marketTemp === 'warm' ? 6 : 9;
      const estCount = Math.round(c.population * 0.4 * vacancyRate / 100);
      const monthlyCost = (c.medianHomePrice * 0.015 / 12 + c.medianHomePrice * 0.005 / 12).toFixed(0);
      return `${c.city} has an estimated vacancy rate of ${vacancyRate}%, representing approximately ${estCount.toLocaleString()} vacant properties. Each vacant home costs the owner an estimated $${monthlyCost}/month in taxes and insurance alone -- with zero income. ${c.marketTemp === 'hot' ? 'Hot market conditions mean vacant properties can be quickly rehabbed and sold or rented.' : c.marketTemp === 'warm' ? 'Warm markets support multiple exit strategies for acquired vacant properties.' : 'Higher vacancy rates in cool markets mean more opportunities and less competition.'} At median prices of $${c.medianHomePrice.toLocaleString()}, vacant property deals in ${c.city} offer strong profit potential.`;
    },
    getMetrics: (c) => {
      const vacancyRate = c.marketTemp === 'hot' ? 4 : c.marketTemp === 'warm' ? 6 : 9;
      const estCount = Math.round(c.population * 0.4 * vacancyRate / 100);
      const monthlyCost = c.medianHomePrice * 0.015 / 12 + c.medianHomePrice * 0.005 / 12;
      return [
        { label: 'Est. Vacant Properties', value: estCount.toLocaleString(), icon: Home },
        { label: 'Vacancy Rate', value: `~${vacancyRate}%`, icon: BarChart3 },
        { label: 'Owner Monthly Cost', value: `$${monthlyCost.toFixed(0)}/mo`, icon: DollarSign },
        { label: 'Median Home Price', value: `$${c.medianHomePrice.toLocaleString()}`, icon: TrendingUp },
      ];
    },
    relatedStrategy: 'distressed',
    relatedGuide: 'how-to-analyze-real-estate-deals',
    relatedTool: '/tools/rehab-estimator',
    relatedToolLabel: 'Rehab Estimator',
  },
  'high-equity': {
    slug: 'high-equity',
    label: 'High Equity',
    fullLabel: 'High Equity Properties',
    icon: TrendingUp,
    description: 'Properties owned by homeowners with 50% or more equity, including homes owned free and clear. High-equity owners have maximum flexibility on pricing because they do not owe a lender. Many are elderly homeowners, long-term owners facing life transitions, or investors looking to cash out. They can accept creative deal structures and below-market offers when motivated.',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    whyInvest: (c) => {
      const estPercent = 35;
      const estCount = Math.round(c.population * 0.4 * estPercent / 100);
      const equity = c.medianHomePrice * 0.65;
      return `An estimated ${estPercent}% of homeowners in ${c.city} have 50%+ equity, representing approximately ${estCount.toLocaleString()} properties. Average equity positions of $${equity.toLocaleString()} against median prices of $${c.medianHomePrice.toLocaleString()} give these owners the flexibility to accept below-market offers. ${c.marketTemp === 'hot' ? 'Years of appreciation have built massive equity positions.' : c.marketTemp === 'warm' ? 'Long-term ownership combined with steady growth has built strong equity.' : 'Lower purchase prices in the past mean many owners have substantial equity despite current market conditions.'} These sellers are often motivated by life events, not financial distress, making negotiations straightforward.`;
    },
    getMetrics: (c) => {
      const estPercent = 35;
      const estCount = Math.round(c.population * 0.4 * estPercent / 100);
      const equity = c.medianHomePrice * 0.65;
      return [
        { label: 'Est. High Equity Properties', value: estCount.toLocaleString(), icon: TrendingUp },
        { label: 'Avg Equity Position', value: `$${equity.toLocaleString()}`, icon: DollarSign },
        { label: 'Ownership Rate 50%+', value: `~${estPercent}%`, icon: BarChart3 },
        { label: 'Median Home Price', value: `$${c.medianHomePrice.toLocaleString()}`, icon: Home },
      ];
    },
    relatedStrategy: 'seller-financing',
    relatedGuide: 'wholesale-real-estate-beginners-guide',
    relatedTool: '/tools/wholesale-deal-calculator',
    relatedToolLabel: 'Deal Calculator',
  },
  fsbo: {
    slug: 'fsbo',
    label: 'For Sale By Owner',
    fullLabel: 'For Sale By Owner (FSBO)',
    icon: Tag,
    description: 'Properties listed by the homeowner without a real estate agent. FSBO sellers typically lack market expertise, pricing knowledge, and negotiation experience. While they initially list to save on agent commissions, many become frustrated as their property sits unsold. Direct investor outreach can lead to favorable deals with lower transaction costs.',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    whyInvest: (c) => {
      const estPercent = 7;
      const estCount = Math.round(c.population / 12000);
      const savingsPerDeal = c.medianHomePrice * 0.05;
      return `Approximately ${estPercent}% of home sales in ${c.city} are FSBO, representing an estimated ${estCount} active listings at any time. Without agent commissions, investors save approximately $${savingsPerDeal.toLocaleString()} per deal on the $${c.medianHomePrice.toLocaleString()} median. ${c.marketTemp === 'hot' ? 'Hot markets give FSBO sellers false confidence initially, but stale listings create opportunity.' : c.marketTemp === 'warm' ? 'Moderate markets expose the challenges of selling without an agent.' : 'Cool markets magnify FSBO difficulties, increasing seller motivation over time.'} FSBO sellers who have been listed for 30+ days are among the most receptive to investor offers.`;
    },
    getMetrics: (c) => {
      const estCount = Math.round(c.population / 12000);
      const savingsPerDeal = c.medianHomePrice * 0.05;
      return [
        { label: 'Est. Active FSBO Listings', value: estCount.toLocaleString(), icon: Tag },
        { label: 'Commission Savings', value: `$${savingsPerDeal.toLocaleString()}`, icon: DollarSign },
        { label: 'FSBO Market Share', value: '~7%', icon: BarChart3 },
        { label: 'Median Home Price', value: `$${c.medianHomePrice.toLocaleString()}`, icon: Home },
      ];
    },
    relatedStrategy: 'wholesale',
    relatedGuide: 'wholesale-real-estate-beginners-guide',
    relatedTool: '/tools/wholesale-deal-calculator',
    relatedToolLabel: 'Deal Calculator',
  },
  'expired-listings': {
    slug: 'expired-listings',
    label: 'Expired Listings',
    fullLabel: 'Expired Listings',
    icon: Clock,
    description: 'Properties that were listed on the MLS with a real estate agent but failed to sell before the listing agreement ended. These sellers have already demonstrated intent to sell, invested time and money in the process, and are now frustrated with the outcome. They are often open to new approaches, price reductions, and creative deal structures.',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    whyInvest: (c) => {
      const estCount = Math.round(c.population / 6000);
      const avgOverprice = c.medianHomePrice * 0.08;
      const investorOffer = c.medianHomePrice * 0.85;
      return `${c.city} sees an estimated ${estCount} expired listings per month. These properties were typically overpriced by about $${avgOverprice.toLocaleString()} above market value. An investor offer around $${investorOffer.toLocaleString()} (85% of the $${c.medianHomePrice.toLocaleString()} median) is often well-received after months of failed listing attempts. ${c.marketTemp === 'hot' ? 'Even in hot markets, overpriced listings expire, creating investor opportunity.' : c.marketTemp === 'warm' ? 'Warm markets produce a steady flow of expired listings from realistic pricing gaps.' : 'Cool markets generate higher expiration rates, expanding the deal pipeline significantly.'} Timing outreach within 7 days of expiration yields the best response rates.`;
    },
    getMetrics: (c) => {
      const estCount = Math.round(c.population / 6000);
      const investorOffer = c.medianHomePrice * 0.85;
      return [
        { label: 'Est. Monthly Expirations', value: estCount.toLocaleString(), icon: Clock },
        { label: 'Target Offer Price', value: `$${investorOffer.toLocaleString()}`, icon: Target },
        { label: 'Best Outreach Window', value: '7 days', icon: AlertTriangle },
        { label: 'Median Home Price', value: `$${c.medianHomePrice.toLocaleString()}`, icon: Home },
      ];
    },
    relatedStrategy: 'wholesale',
    relatedGuide: 'wholesale-real-estate-beginners-guide',
    relatedTool: '/tools/wholesale-deal-calculator',
    relatedToolLabel: 'Deal Calculator',
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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function getRelatedCities(current: City, count = 4): City[] {
  const sameState = (cities as City[]).filter(
    (c) => c.slug !== current.slug && c.state === current.state
  );
  if (sameState.length >= count) return sameState.slice(0, count);
  const others = (cities as City[]).filter(
    (c) => c.slug !== current.slug && !sameState.find((s) => s.slug === c.slug)
  );
  return [...sameState, ...others].slice(0, count);
}

function slugifyState(stateFull: string): string {
  return stateFull.toLowerCase().replace(/\s+/g, '-');
}

export default function DistressPage() {
  const { distressType, citySlug } = useParams<{ distressType: string; citySlug: string }>();

  const dt = distressType ? DISTRESS_TYPES[distressType] : null;
  const city = (cities as City[]).find((c) => c.slug === citySlug);

  if (!dt || !city) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Page Not Found</h1>
          <p className="text-neutral-400 mb-6">
            {!dt
              ? 'Invalid distress signal type. Browse our available deal signals.'
              : 'We could not find data for this market.'}
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
  const metrics = dt.getMetrics(city);
  const relatedCities = getRelatedCities(city);
  const otherDistressTypes = DISTRESS_SLUGS.filter((s) => s !== distressType).slice(0, 4);

  const stats = [
    { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: DollarSign },
    { label: 'Average Rent', value: `$${city.avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Price Growth (YoY)', value: `${city.priceGrowth}%`, icon: TrendingUp },
    { label: 'Population', value: formatNumber(city.population), icon: Users },
  ];

  return (
    <PublicLayout>
      <SEOHead
        title={`${dt.fullLabel} in ${city.city}, ${city.state} -- Deal Signals & Market Data`}
        description={`Find ${dt.label.toLowerCase()} properties in ${city.city}, ${city.stateFull}. Median price ${formatCurrency(city.medianHomePrice)}, ${city.priceGrowth}% growth. AI-powered distress signals for real estate investors.`}
        keywords={`${dt.label.toLowerCase()} ${city.city}, ${dt.label.toLowerCase()} properties ${city.state}, ${dt.label.toLowerCase()} deals ${city.city}, distressed properties ${city.city}, motivated sellers ${city.city} ${city.state}`}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            <Link to="/deals" className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
              <Eye className="h-3.5 w-3.5" />
              <span>Deals</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <Link to={`/deals/${distressType}`} className="text-sm text-white/50 hover:text-white transition-colors">
              {dt.label}
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <Link to={`/markets/${city.slug}`} className="text-sm text-white/50 hover:text-white transition-colors">
              {city.city}, {city.state}
            </Link>
          </div>

          <Badge variant="outline" className={`mb-6 text-xs border ${tempColors[city.marketTemp] || ''}`}>
            <ThermometerSun className="h-3 w-3 mr-1" />
            {tempLabels[city.marketTemp] || city.marketTemp}
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {dt.fullLabel} in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city.city}, {city.stateFull}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {dt.description}
          </p>
        </div>
      </section>

      {/* ===== MARKET STATS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Market Overview</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {city.city} by the numbers.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <StatIcon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">{stat.value}</div>
                  <p className="text-sm text-neutral-400 font-light">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== WHY INVEST IN THIS DISTRESS TYPE HERE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Investment Insight</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Why target {dt.label.toLowerCase()} in {city.city}.
          </h2>
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl ${dt.bgColor} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${dt.color}`} />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white">{dt.fullLabel}</h3>
            </div>
            <p className="text-neutral-300 font-light leading-relaxed max-w-3xl">
              {dt.whyInvest(city)}
            </p>
          </div>
        </div>
      </section>

      {/* ===== OPPORTUNITY METRICS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Opportunity Metrics</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            {dt.label} signals for {city.city}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Estimated figures based on {city.city} market data and national averages. Use our tools for detailed analysis.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => {
              const MetricIcon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <MetricIcon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">{metric.value}</div>
                  <p className="text-sm text-neutral-400 font-light">{metric.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== HOW AIWHOLESAIL HELPS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">AI-Powered</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            How AIWholesail finds {dt.label.toLowerCase()} deals.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: 'Signal Detection',
                desc: `Our AI continuously monitors public records, court filings, and data sources to identify ${dt.label.toLowerCase()} properties in ${city.city} as they appear.`,
                icon: Eye,
              },
              {
                title: 'Deal Scoring',
                desc: `Every ${dt.label.toLowerCase()} property is scored based on equity, motivation level, condition, and market dynamics to prioritize the best opportunities.`,
                icon: Target,
              },
              {
                title: 'Automated Outreach',
                desc: `Launch targeted campaigns to ${dt.label.toLowerCase()} property owners with personalized messaging, skip-traced contact info, and multi-channel sequences.`,
                icon: Zap,
              },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={item.title}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8"
                >
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5">
                    <ItemIcon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== RELATED DISTRESS TYPES IN THIS CITY ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">More Signals</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Other distress signals in {city.city}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Explore additional motivated seller signals in the {city.city}, {city.state} market.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherDistressTypes.map((s) => {
              const other = DISTRESS_TYPES[s];
              const OtherIcon = other.icon;
              return (
                <Link key={s} to={`/deals/${s}/${city.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className={`w-10 h-10 rounded-xl ${other.bgColor} flex items-center justify-center mb-4`}>
                      <OtherIcon className={`h-4 w-4 ${other.color}`} />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                      {other.fullLabel}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light flex-1">
                      in {city.city}, {city.state}
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      Explore <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== RELATED CITIES FOR THIS DISTRESS TYPE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">{dt.label} Markets</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
            {dt.fullLabel} in nearby markets.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedCities.map((r) => (
              <Link key={r.slug} to={`/deals/${distressType}/${r.slug}`} className="group">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    <Badge variant="outline" className={`text-[10px] border ${tempColors[r.marketTemp] || ''}`}>
                      {tempLabels[r.marketTemp]}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {r.city}, {r.state}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
                    Median {formatCurrency(r.medianHomePrice)} &middot; {r.priceGrowth}% growth
                  </p>
                  <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    View {dt.label.toLowerCase()} deals <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Link to={dt.relatedTool} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> {dt.relatedToolLabel}
              </Link>
              <Link to={`/guides/${dt.relatedGuide}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Investor Guide
              </Link>
              <Link to={`/markets/${city.slug}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <MapPin className="h-4 w-4 text-cyan-400" /> {city.city} Market Page
              </Link>
              <Link to={`/invest/${dt.relatedStrategy}/${city.slug}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Zap className="h-4 w-4 text-cyan-400" /> {dt.label} Strategy
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
            Find {dt.label.toLowerCase()} deals in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city.city} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail monitors {dt.label.toLowerCase()} signals daily in {city.city}. Get AI-powered alerts, deal scoring, and automated outreach.
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
