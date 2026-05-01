import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Users,
  Home, Building2, Repeat, Hammer, ChevronRight, Calculator,
  BookOpen, ThermometerSun, Zap, Target, BarChart3,
  Shield, CheckCircle, RefreshCw, FileKey, Handshake,
  Gavel, AlertTriangle, Receipt, Scale, UserX, Wrench,
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

const STRATEGIES = [
  'wholesale', 'flip', 'rental', 'brrrr',
  'subject-to', 'seller-financing', 'foreclosure', 'pre-foreclosure',
  'tax-lien', 'probate', 'absentee-owner', 'distressed',
] as const;
type Strategy = (typeof STRATEGIES)[number];

interface StrategyMeta {
  label: string;
  heroTitle: (city: string) => string;
  icon: React.ReactNode;
  description: string;
  guideSlug: string;
  toolPath: string;
  toolLabel: string;
  whyItWorks: (city: City) => string;
}

const strategyMeta: Record<Strategy, StrategyMeta> = {
  wholesale: {
    label: 'Wholesale Real Estate',
    heroTitle: (city) => `Wholesale Real Estate in ${city}`,
    icon: <Repeat className="h-5 w-5" />,
    description: 'Assign contracts on undervalued properties for quick profit without ever owning the asset. Low capital, high velocity.',
    guideSlug: 'wholesale-real-estate-beginners-guide',
    toolPath: '/tools/wholesale-deal-calculator',
    toolLabel: 'Wholesale Deal Calculator',
    whyItWorks: (c) => {
      const mao = c.medianHomePrice * 0.7;
      const spread = c.medianHomePrice - mao;
      return `With a median home price of $${c.medianHomePrice.toLocaleString()}, the ${c.city} market offers a potential MAO-to-market spread of $${spread.toLocaleString()}. ${c.marketTemp === 'hot' ? 'High demand drives fast contract turnovers.' : c.marketTemp === 'warm' ? 'Steady demand supports consistent deal flow.' : 'Lower competition means more negotiation leverage for wholesalers.'} A population of ${(c.population / 1000).toFixed(0)}K ensures a deep buyer pool, and ${c.priceGrowth}% year-over-year price growth keeps ARVs trending upward.`;
    },
  },
  flip: {
    label: 'Fix & Flip',
    heroTitle: (city) => `Flip Houses in ${city}`,
    icon: <Hammer className="h-5 w-5" />,
    description: 'Buy distressed properties, renovate strategically, and sell at market value for maximum returns on each project.',
    guideSlug: 'how-to-analyze-real-estate-deals',
    toolPath: '/tools/arv-calculator',
    toolLabel: 'ARV Calculator',
    whyItWorks: (c) => {
      const rehab = c.medianHomePrice * 0.15;
      const profit = c.medianHomePrice * 0.12;
      return `${c.city} properties at median $${c.medianHomePrice.toLocaleString()} allow estimated rehab budgets around $${rehab.toLocaleString()} with projected profits near $${profit.toLocaleString()} per flip. ${c.priceGrowth}% annual appreciation provides a rising-tide tailwind. ${c.marketTemp === 'hot' ? 'Strong buyer demand means flipped properties sell quickly.' : c.marketTemp === 'warm' ? 'Balanced supply and demand support solid exit timelines.' : 'Lower acquisition costs create wider margins for experienced flippers.'}`;
    },
  },
  rental: {
    label: 'Rental Property Investing',
    heroTitle: (city) => `Rental Property Investing in ${city}`,
    icon: <Building2 className="h-5 w-5" />,
    description: 'Acquire properties below market value, hold for monthly cash flow and long-term appreciation to build lasting wealth.',
    guideSlug: 'rental-property-investing-guide',
    toolPath: '/tools/cash-flow-calculator',
    toolLabel: 'Cash Flow Calculator',
    whyItWorks: (c) => {
      const monthlyCashFlow = c.avgRent - c.medianHomePrice * 0.007;
      const capRate = ((c.avgRent * 12 * 0.6) / c.medianHomePrice * 100).toFixed(1);
      return `Average rents of $${c.avgRent.toLocaleString()}/mo against a median price of $${c.medianHomePrice.toLocaleString()} produce an estimated ${capRate}% cap rate. ${monthlyCashFlow > 0 ? `Estimated monthly cash flow of $${monthlyCashFlow.toFixed(0)} after PITI makes ${c.city} attractive for buy-and-hold investors.` : `While cash flow is tight at current prices, ${c.priceGrowth}% appreciation and rent growth create strong total returns.`} Population of ${(c.population / 1000).toFixed(0)}K drives tenant demand.`;
    },
  },
  brrrr: {
    label: 'BRRRR Investing',
    heroTitle: (city) => `BRRRR Investing in ${city}`,
    icon: <RefreshCw className="h-5 w-5" />,
    description: 'Buy, Rehab, Rent, Refinance, Repeat. Recycle your capital across multiple properties to scale your portfolio rapidly.',
    guideSlug: 'brrrr-method-explained',
    toolPath: '/tools/brrrr-calculator',
    toolLabel: 'BRRRR Calculator',
    whyItWorks: (c) => {
      const allIn = c.medianHomePrice * 0.8;
      const refiValue = c.medianHomePrice;
      const cashRecouped = ((refiValue * 0.75 - allIn) / allIn * 100).toFixed(0);
      return `An all-in cost around $${allIn.toLocaleString()} against a refi value of $${refiValue.toLocaleString()} positions ${c.city} for BRRRR investors to recoup an estimated ${cashRecouped}% of capital on refinance. Average rent of $${c.avgRent.toLocaleString()}/mo supports holding costs while you stabilize and refinance. ${c.priceGrowth}% appreciation adds equity on top of forced appreciation from rehab.`;
    },
  },
  'subject-to': {
    label: 'Subject-To Deals',
    heroTitle: (city) => `Subject-To Deals in ${city}`,
    icon: <FileKey className="h-5 w-5" />,
    description: 'Acquire property subject to the existing mortgage. No bank qualifying, instant equity, and low cash to close.',
    guideSlug: 'wholesale-real-estate-beginners-guide',
    toolPath: '/tools/wholesale-deal-calculator',
    toolLabel: 'Deal Calculator',
    whyItWorks: (c) => {
      const mortgageBalance = c.medianHomePrice * 0.6;
      const equity = c.medianHomePrice - mortgageBalance;
      const monthlyPayment = (mortgageBalance * 0.065 / 12).toFixed(0);
      return `In ${c.city}, with a median home price of $${c.medianHomePrice.toLocaleString()}, subject-to deals offer an estimated mortgage takeover balance of $${mortgageBalance.toLocaleString()} and roughly $${equity.toLocaleString()} in instant equity. Estimated monthly payments around $${monthlyPayment} based on typical rates make carrying costs manageable. ${c.marketTemp === 'hot' ? 'Rising prices amplify equity gains quickly.' : c.marketTemp === 'warm' ? 'Stable appreciation protects your equity position.' : 'Lower prices mean smaller mortgages to take over, reducing risk.'} With ${c.priceGrowth}% annual growth, the equity spread widens over time.`;
    },
  },
  'seller-financing': {
    label: 'Seller Financing',
    heroTitle: (city) => `Seller Financing in ${city}`,
    icon: <Handshake className="h-5 w-5" />,
    description: 'Buy with the seller as your lender. Negotiate terms, skip bank red tape, and close faster with creative financing.',
    guideSlug: 'wholesale-real-estate-beginners-guide',
    toolPath: '/tools/mortgage-calculator',
    toolLabel: 'Mortgage Calculator',
    whyItWorks: (c) => {
      const downPayment = c.medianHomePrice * 0.1;
      const financed = c.medianHomePrice * 0.9;
      const monthlyPayment = (financed * 0.06 / 12).toFixed(0);
      const hardMoneyMonthly = (financed * 0.12 / 12).toFixed(0);
      return `At a median price of $${c.medianHomePrice.toLocaleString()} in ${c.city}, seller financing typically requires just $${downPayment.toLocaleString()} down (10%). Estimated monthly payments of $${monthlyPayment} compare favorably to hard money payments of $${hardMoneyMonthly}, saving investors significantly each month. ${c.marketTemp === 'hot' ? 'Motivated sellers in hot markets may offer favorable terms to close quickly.' : c.marketTemp === 'warm' ? 'Balanced market conditions give both sides negotiation room.' : 'Cool markets create more motivated sellers willing to carry paper.'} Population of ${(c.population / 1000).toFixed(0)}K provides a strong base of potential seller-financed opportunities.`;
    },
  },
  foreclosure: {
    label: 'Foreclosure Investing',
    heroTitle: (city) => `Foreclosure Investing in ${city}`,
    icon: <Gavel className="h-5 w-5" />,
    description: 'Purchase bank-owned and auction properties at steep discounts. High margins for investors who understand the process.',
    guideSlug: 'how-to-analyze-real-estate-deals',
    toolPath: '/tools/arv-calculator',
    toolLabel: 'ARV Calculator',
    whyItWorks: (c) => {
      const discountLow = c.medianHomePrice * 0.6;
      const discountHigh = c.medianHomePrice * 0.8;
      const rehab = c.medianHomePrice * 0.15;
      const profit = c.medianHomePrice - discountLow - rehab;
      return `Foreclosed properties in ${c.city} typically sell 20-40% below market value, putting auction prices in the $${discountLow.toLocaleString()} to $${discountHigh.toLocaleString()} range against a median of $${c.medianHomePrice.toLocaleString()}. With estimated rehab costs of $${rehab.toLocaleString()}, investors can target profits of $${profit.toLocaleString()} or more per deal. ${c.marketTemp === 'hot' ? 'Strong demand means rehabbed foreclosures sell fast.' : c.marketTemp === 'warm' ? 'Steady markets provide reliable exit timelines.' : 'Higher foreclosure inventory in cool markets means more opportunities.'} ${c.priceGrowth}% annual appreciation adds upside to every acquisition.`;
    },
  },
  'pre-foreclosure': {
    label: 'Pre-Foreclosure Deals',
    heroTitle: (city) => `Pre-Foreclosure Deals in ${city}`,
    icon: <AlertTriangle className="h-5 w-5" />,
    description: 'Reach homeowners before auction. Negotiate directly with motivated sellers facing foreclosure for the best discounts.',
    guideSlug: 'wholesale-real-estate-beginners-guide',
    toolPath: '/tools/wholesale-deal-calculator',
    toolLabel: 'Deal Calculator',
    whyItWorks: (c) => {
      const avgEquity = c.medianHomePrice * 0.35;
      const typicalDiscount = c.medianHomePrice * 0.15;
      const purchasePrice = c.medianHomePrice - typicalDiscount;
      return `In ${c.city}, pre-foreclosure homeowners typically have an average of $${avgEquity.toLocaleString()} in equity. By purchasing at an estimated 15% discount ($${purchasePrice.toLocaleString()} vs $${c.medianHomePrice.toLocaleString()} market value), investors save $${typicalDiscount.toLocaleString()} per deal. The typical timeline from notice of default to auction is 90-120 days, giving investors time to negotiate. ${c.marketTemp === 'hot' ? 'Hot market conditions mean acquired properties appreciate quickly.' : c.marketTemp === 'warm' ? 'Warm markets balance seller motivation with resale potential.' : 'Cool markets often have higher distress rates, expanding the deal pipeline.'} A population of ${(c.population / 1000).toFixed(0)}K ensures consistent deal flow.`;
    },
  },
  'tax-lien': {
    label: 'Tax Lien Investing',
    heroTitle: (city) => `Tax Lien Investing in ${city}`,
    icon: <Receipt className="h-5 w-5" />,
    description: 'Purchase tax lien certificates or tax deed properties for guaranteed interest returns or deeply discounted real estate.',
    guideSlug: 'how-to-analyze-real-estate-deals',
    toolPath: '/tools/offer-price-calculator',
    toolLabel: 'Offer Price Calculator',
    whyItWorks: (c) => {
      const avgLien = c.medianHomePrice * 0.02;
      const redemptionRate = 95;
      const interestRate = 12;
      return `In ${c.city}, average tax lien amounts run approximately $${avgLien.toLocaleString()} against properties valued at $${c.medianHomePrice.toLocaleString()}. With redemption rates around ${redemptionRate}%, most liens pay out at statutory interest rates averaging ${interestRate}% annually -- a strong passive return. For the ${100 - redemptionRate}% that do not redeem, investors may acquire properties worth $${c.medianHomePrice.toLocaleString()} for pennies on the dollar. ${c.marketTemp === 'hot' ? 'High property values mean larger equity positions on unredeemed liens.' : c.marketTemp === 'warm' ? 'Moderate values balance risk and return effectively.' : 'Cool markets often have more tax-delinquent properties, expanding opportunity.'} The ${c.stateFull} market offers unique tax lien advantages.`;
    },
  },
  probate: {
    label: 'Probate Real Estate',
    heroTitle: (city) => `Probate Real Estate in ${city}`,
    icon: <Scale className="h-5 w-5" />,
    description: 'Acquire inherited properties from motivated heirs. These sellers prioritize speed and simplicity over top dollar.',
    guideSlug: 'wholesale-real-estate-beginners-guide',
    toolPath: '/tools/wholesale-deal-calculator',
    toolLabel: 'Deal Calculator',
    whyItWorks: (c) => {
      const typicalDiscount = c.medianHomePrice * 0.15;
      const purchasePrice = c.medianHomePrice - typicalDiscount;
      return `Probate properties in ${c.city} typically sell at 10-20% below market value, with an estimated purchase price around $${purchasePrice.toLocaleString()} vs the median of $${c.medianHomePrice.toLocaleString()}. Heirs are often motivated by the cost of holding inherited property -- taxes, insurance, and maintenance add up quickly. The average probate timeline in ${c.stateFull} is 6-12 months, giving investors a window to negotiate. ${c.marketTemp === 'hot' ? 'High demand means acquired probate properties resell quickly.' : c.marketTemp === 'warm' ? 'Balanced markets support multiple exit strategies.' : 'Cool markets mean more time to negotiate and less competition.'} With ${(c.population / 1000).toFixed(0)}K residents, ${c.city} generates a steady stream of probate filings each year.`;
    },
  },
  'absentee-owner': {
    label: 'Absentee Owner Properties',
    heroTitle: (city) => `Absentee Owner Properties in ${city}`,
    icon: <UserX className="h-5 w-5" />,
    description: 'Target out-of-area landlords who are often tired, burned out, and ready to sell at a discount to avoid management headaches.',
    guideSlug: 'wholesale-real-estate-beginners-guide',
    toolPath: '/tools/wholesale-deal-calculator',
    toolLabel: 'Deal Calculator',
    whyItWorks: (c) => {
      const absenteePercent = c.marketTemp === 'hot' ? 20 : c.marketTemp === 'warm' ? 22 : 25;
      const estAbsentee = Math.round(c.population * 0.4 * absenteePercent / 100);
      const avgDiscount = c.medianHomePrice * 0.1;
      return `An estimated ${absenteePercent}% of rental properties in ${c.city} are absentee-owned, representing roughly ${estAbsentee.toLocaleString()} properties. These out-of-area landlords often sell at 8-12% below market, creating an average discount of $${avgDiscount.toLocaleString()} per property. Motivation is high -- remote landlords face management challenges, deferred maintenance, and tax burdens. ${c.marketTemp === 'hot' ? 'Hot market conditions mean these sellers can be reached before their properties appreciate further.' : c.marketTemp === 'warm' ? 'Warm markets have a healthy mix of tired and transitioning landlords.' : 'Cool markets amplify landlord frustration, increasing motivation to sell.'} Average rents of $${c.avgRent.toLocaleString()}/mo make acquired properties attractive for hold or flip.`;
    },
  },
  distressed: {
    label: 'Distressed Properties',
    heroTitle: (city) => `Distressed Properties in ${city}`,
    icon: <Wrench className="h-5 w-5" />,
    description: 'Buy damaged, neglected, or code-violation properties at 30-50% discounts. Maximum upside for hands-on investors.',
    guideSlug: 'how-to-analyze-real-estate-deals',
    toolPath: '/tools/rehab-estimator',
    toolLabel: 'Rehab Estimator',
    whyItWorks: (c) => {
      const discountLow = c.medianHomePrice * 0.5;
      const discountHigh = c.medianHomePrice * 0.7;
      const avgRehab = c.medianHomePrice * 0.2;
      const profitPotential = c.medianHomePrice - discountLow - avgRehab;
      return `Distressed properties in ${c.city} can be acquired for $${discountLow.toLocaleString()} to $${discountHigh.toLocaleString()}, representing 30-50% discounts from the $${c.medianHomePrice.toLocaleString()} median. With average rehab costs of $${avgRehab.toLocaleString()}, profit potential reaches $${profitPotential.toLocaleString()} per deal. ${c.marketTemp === 'hot' ? 'Strong buyer demand ensures rehabbed distressed properties sell at or above ARV.' : c.marketTemp === 'warm' ? 'Steady appreciation creates reliable returns on distressed acquisitions.' : 'Lower base prices in cool markets mean smaller absolute rehab budgets.'} ${c.priceGrowth}% annual price growth adds built-in margin expansion. Population of ${(c.population / 1000).toFixed(0)}K supports a deep contractor and buyer network.`;
    },
  },
};

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

function getStrategyMetrics(strategy: Strategy, city: City) {
  switch (strategy) {
    case 'wholesale': {
      const mao = city.medianHomePrice * 0.7;
      const fee = city.medianHomePrice * 0.05;
      return [
        { label: 'Max Allowable Offer (MAO)', value: formatCurrency(mao), icon: Target },
        { label: 'Typical Assignment Fee', value: formatCurrency(fee), icon: DollarSign },
        { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: Home },
        { label: 'MAO-to-Market Spread', value: formatCurrency(city.medianHomePrice - mao), icon: BarChart3 },
      ];
    }
    case 'flip': {
      const rehab = city.medianHomePrice * 0.15;
      const profit = city.medianHomePrice * 0.12;
      const arv = city.medianHomePrice;
      const purchase = city.medianHomePrice * 0.7;
      return [
        { label: 'Estimated Purchase Price', value: formatCurrency(purchase), icon: DollarSign },
        { label: 'Estimated Rehab Budget', value: formatCurrency(rehab), icon: Hammer },
        { label: 'After Repair Value (ARV)', value: formatCurrency(arv), icon: TrendingUp },
        { label: 'Projected Profit', value: formatCurrency(profit), icon: Target },
      ];
    }
    case 'rental': {
      const monthlyCashFlow = city.avgRent - city.medianHomePrice * 0.007;
      const capRate = ((city.avgRent * 12 * 0.6) / city.medianHomePrice * 100).toFixed(1);
      const grossYield = ((city.avgRent * 12) / city.medianHomePrice * 100).toFixed(1);
      return [
        { label: 'Average Rent', value: `$${city.avgRent.toLocaleString()}/mo`, icon: Home },
        { label: 'Est. Monthly Cash Flow', value: `$${monthlyCashFlow.toFixed(0)}/mo`, icon: DollarSign },
        { label: 'Estimated Cap Rate', value: `${capRate}%`, icon: BarChart3 },
        { label: 'Gross Rental Yield', value: `${grossYield}%`, icon: TrendingUp },
      ];
    }
    case 'brrrr': {
      const allIn = city.medianHomePrice * 0.8;
      const refiValue = city.medianHomePrice;
      const refiLoan = refiValue * 0.75;
      const cashRecouped = ((refiLoan / allIn) * 100).toFixed(0);
      return [
        { label: 'Estimated All-In Cost', value: formatCurrency(allIn), icon: DollarSign },
        { label: 'After Rehab Value', value: formatCurrency(refiValue), icon: TrendingUp },
        { label: 'Refi Loan (75% LTV)', value: formatCurrency(refiLoan), icon: RefreshCw },
        { label: 'Capital Recouped', value: `${cashRecouped}%`, icon: Target },
      ];
    }
    case 'subject-to': {
      const mortgageBalance = city.medianHomePrice * 0.6;
      const monthlyPayment = mortgageBalance * 0.065 / 12;
      const equitySpread = city.medianHomePrice - mortgageBalance;
      return [
        { label: 'Est. Mortgage Balance', value: formatCurrency(mortgageBalance), icon: FileKey },
        { label: 'Monthly Payment Est.', value: `$${monthlyPayment.toFixed(0)}/mo`, icon: DollarSign },
        { label: 'Equity Spread', value: formatCurrency(equitySpread), icon: TrendingUp },
        { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: Home },
      ];
    }
    case 'seller-financing': {
      const downPayment = city.medianHomePrice * 0.1;
      const financed = city.medianHomePrice * 0.9;
      const monthlyPayment = financed * 0.06 / 12;
      const hardMoneyMonthly = financed * 0.12 / 12;
      const savings = hardMoneyMonthly - monthlyPayment;
      return [
        { label: 'Typical Down Payment (10%)', value: formatCurrency(downPayment), icon: DollarSign },
        { label: 'Est. Monthly Payment', value: `$${monthlyPayment.toFixed(0)}/mo`, icon: Home },
        { label: 'Hard Money Payment', value: `$${hardMoneyMonthly.toFixed(0)}/mo`, icon: BarChart3 },
        { label: 'Monthly Savings vs HM', value: `$${savings.toFixed(0)}/mo`, icon: TrendingUp },
      ];
    }
    case 'foreclosure': {
      const auctionLow = city.medianHomePrice * 0.6;
      const auctionHigh = city.medianHomePrice * 0.8;
      const rehab = city.medianHomePrice * 0.15;
      const profit = city.medianHomePrice - auctionLow - rehab;
      return [
        { label: 'Auction Price Range', value: `${formatCurrency(auctionLow)}-${formatCurrency(auctionHigh)}`, icon: Gavel },
        { label: 'Typical Discount', value: '20-40%', icon: Target },
        { label: 'Est. Rehab Needed', value: formatCurrency(rehab), icon: Hammer },
        { label: 'Profit Potential', value: formatCurrency(profit), icon: TrendingUp },
      ];
    }
    case 'pre-foreclosure': {
      const avgEquity = city.medianHomePrice * 0.35;
      const typicalDiscount = city.medianHomePrice * 0.15;
      return [
        { label: 'Avg Equity Available', value: formatCurrency(avgEquity), icon: DollarSign },
        { label: 'Typical Discount', value: formatCurrency(typicalDiscount), icon: Target },
        { label: 'Timeline to Auction', value: '90-120 days', icon: AlertTriangle },
        { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: Home },
      ];
    }
    case 'tax-lien': {
      const avgLien = city.medianHomePrice * 0.02;
      return [
        { label: 'Avg Tax Lien Amount', value: formatCurrency(avgLien), icon: Receipt },
        { label: 'Redemption Rate', value: '~95%', icon: BarChart3 },
        { label: 'Statutory Interest Rate', value: '8-18%', icon: TrendingUp },
        { label: 'Property Value', value: formatCurrency(city.medianHomePrice), icon: Home },
      ];
    }
    case 'probate': {
      const typicalDiscount = city.medianHomePrice * 0.15;
      const purchasePrice = city.medianHomePrice - typicalDiscount;
      return [
        { label: 'Typical Discount', value: formatCurrency(typicalDiscount), icon: Target },
        { label: 'Est. Purchase Price', value: formatCurrency(purchasePrice), icon: DollarSign },
        { label: 'Avg Timeline', value: '6-12 months', icon: Scale },
        { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: Home },
      ];
    }
    case 'absentee-owner': {
      const absenteePercent = city.marketTemp === 'hot' ? 20 : city.marketTemp === 'warm' ? 22 : 25;
      const avgDiscount = city.medianHomePrice * 0.1;
      const estCount = Math.round(city.population * 0.4 * absenteePercent / 100);
      return [
        { label: '% Absentee Owned (Est.)', value: `${absenteePercent}%`, icon: UserX },
        { label: 'Avg Discount', value: formatCurrency(avgDiscount), icon: Target },
        { label: 'Est. Absentee Properties', value: formatNumber(estCount), icon: Building2 },
        { label: 'Motivation Level', value: city.marketTemp === 'cool' ? 'Very High' : 'High', icon: TrendingUp },
      ];
    }
    case 'distressed': {
      const discountLow = city.medianHomePrice * 0.5;
      const avgRehab = city.medianHomePrice * 0.2;
      const profitPotential = city.medianHomePrice - discountLow - avgRehab;
      return [
        { label: 'Typical Discount', value: '30-50%', icon: Target },
        { label: 'Avg Rehab Cost', value: formatCurrency(avgRehab), icon: Wrench },
        { label: 'Profit Potential', value: formatCurrency(profitPotential), icon: TrendingUp },
        { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: Home },
      ];
    }
  }
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

export default function CityStrategyPage() {
  const { strategy, citySlug } = useParams<{ strategy: string; citySlug: string }>();

  const validStrategy = STRATEGIES.includes(strategy as Strategy) ? (strategy as Strategy) : null;
  const city = (cities as City[]).find((c) => c.slug === citySlug);

  if (!validStrategy || !city) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Page Not Found</h1>
          <p className="text-neutral-400 mb-6">
            {!validStrategy
              ? 'Invalid investment strategy. Browse our available strategies.'
              : 'We could not find data for this market.'}
          </p>
          <Link to="/markets">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <MapPin className="h-4 w-4" /> Browse All Markets
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const meta = strategyMeta[validStrategy];
  const metrics = getStrategyMetrics(validStrategy, city);
  const relatedCities = getRelatedCities(city);
  const otherStrategies = STRATEGIES.filter((s) => s !== validStrategy);

  const stats = [
    { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: DollarSign },
    { label: 'Average Rent', value: `$${city.avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Price Growth (YoY)', value: `${city.priceGrowth}%`, icon: TrendingUp },
    { label: 'Population', value: formatNumber(city.population), icon: Users },
  ];

  return (
    <PublicLayout>
      <SEOHead
        title={`${meta.heroTitle(`${city.city}, ${city.state}`)} -- Market Data & Strategy Guide`}
        description={`${meta.heroTitle(`${city.city}, ${city.stateFull}`)}. Median price ${formatCurrency(city.medianHomePrice)}, ${city.priceGrowth}% growth, avg rent $${city.avgRent.toLocaleString()}/mo. AI-powered market intelligence for ${meta.label.toLowerCase()} investors.`}
        keywords={`${meta.label.toLowerCase()} ${city.city}, ${city.city} ${city.state} ${validStrategy}, ${validStrategy} real estate ${city.city}, ${city.city} investment properties, ${meta.label.toLowerCase()} ${city.stateFull}`}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            <Link to="/markets" className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
              <MapPin className="h-3.5 w-3.5" />
              <span>Markets</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <Link to={`/markets/${city.slug}`} className="text-sm text-white/50 hover:text-white transition-colors">
              {city.city}, {city.state}
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <Link to={`/invest/${validStrategy}`} className="text-sm text-white/50 hover:text-white transition-colors">
              {meta.label}
            </Link>
          </div>

          <Badge variant="outline" className={`mb-6 text-xs border ${tempColors[city.marketTemp] || ''}`}>
            <ThermometerSun className="h-3 w-3 mr-1" />
            {tempLabels[city.marketTemp] || city.marketTemp}
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {meta.heroTitle('')}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city.city}, {city.stateFull}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {meta.description}
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
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">{stat.value}</div>
                  <p className="text-sm text-neutral-400 font-light">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== WHY THIS STRATEGY WORKS HERE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Strategy Insight</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Why {meta.label.toLowerCase()} works in {city.city}.
          </h2>
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                {meta.icon}
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white">{meta.label}</h3>
            </div>
            <p className="text-neutral-300 font-light leading-relaxed max-w-3xl">
              {meta.whyItWorks(city)}
            </p>
          </div>
        </div>
      </section>

      {/* ===== KEY NUMBERS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Key Numbers</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            {meta.label} metrics for {city.city}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Estimated figures based on {city.city} market data. Use our calculators for detailed analysis with your specific deal numbers.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">{metric.value}</div>
                  <p className="text-sm text-neutral-400 font-light">{metric.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== OTHER STRATEGIES IN THIS CITY ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">More Strategies</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Other ways to invest in {city.city}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Explore additional investment strategies available in the {city.city}, {city.state} market.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {otherStrategies.map((s) => {
              const sMeta = strategyMeta[s];
              return (
                <Link key={s} to={`/invest/${s}/${city.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                      {sMeta.icon}
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-white mb-3 group-hover:text-cyan-400 transition-colors">
                      {sMeta.label}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light leading-relaxed flex-1">{sMeta.description}</p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      Explore {sMeta.label.toLowerCase()} <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== RELATED CITIES FOR THIS STRATEGY ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">{meta.label} Markets</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
            {meta.label} in nearby markets.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedCities.map((r) => (
              <Link key={r.slug} to={`/invest/${validStrategy}/${r.slug}`} className="group">
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
                    View {meta.label.toLowerCase()} <ChevronRight className="h-3 w-3" />
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
              <Link to={meta.toolPath} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> {meta.toolLabel}
              </Link>
              <Link to={`/guides/${meta.guideSlug}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> {meta.label} Guide
              </Link>
              <Link to={`/markets/${city.slug}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <MapPin className="h-4 w-4 text-cyan-400" /> {city.city} Market Page
              </Link>
              <Link to={`/states/${slugifyState(city.stateFull)}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Zap className="h-4 w-4 text-cyan-400" /> {city.stateFull} Markets
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
            Find {meta.label.toLowerCase()} deals in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city.city} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans the {city.city} market daily. Get AI-powered deal scoring, instant comps, and automated seller outreach.
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
