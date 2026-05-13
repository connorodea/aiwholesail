import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Scale, ChevronRight, Gavel, Shield,
  CheckCircle, XCircle, DollarSign, Home, FileText,
  BookOpen, MapPin, Building2, AlertTriangle, Info, Calendar,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import stateLaws from '@/data/state-laws.json';
import cities from '@/data/cities.json';

const LAST_UPDATED = '2026-05-12';

interface StateLaw {
  slug: string;
  state: string;
  stateFull: string;
  wholesalingLegal: boolean;
  licenseRequired: boolean;
  assignmentAllowed: boolean;
  doubleCloseAllowed: boolean;
  disclosureRequired: boolean;
  notableRegulations: string;
  keyStatutes: string;
  landlordFriendly: boolean;
  foreclosureType: string;
  foreclosureTimeline: string;
  propertyTaxRate: number;
  transferTax: boolean;
  llcFilingFee: number;
  llcAnnualFee: number;
  homesteadExemption: boolean;
  investorNotes: string;
}

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

const foreclosureColors: Record<string, string> = {
  'judicial': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'non-judicial': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'hybrid': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

function BooleanIndicator({ value, trueLabel = 'Yes', falseLabel = 'No', invertColor = false }: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
  invertColor?: boolean;
}) {
  const isPositive = invertColor ? !value : value;
  return (
    <span className="flex items-center gap-1.5">
      {isPositive ? (
        <CheckCircle className="h-4 w-4 text-emerald-400" />
      ) : (
        <XCircle className="h-4 w-4 text-amber-400" />
      )}
      <span className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
        {value ? trueLabel : falseLabel}
      </span>
    </span>
  );
}

function slugifyState(stateFull: string): string {
  return stateFull.toLowerCase().replace(/\s+/g, '-');
}

function getRelatedStates(current: StateLaw): StateLaw[] {
  const others = (stateLaws as StateLaw[]).filter((s) => s.slug !== current.slug);
  // Prefer states with same foreclosure type and similar landlord friendliness
  const similar = others.filter(
    (s) => s.foreclosureType === current.foreclosureType && s.landlordFriendly === current.landlordFriendly
  );
  if (similar.length >= 3) return similar.slice(0, 3);
  return [...similar, ...others.filter((s) => !similar.includes(s))].slice(0, 3);
}

function getStateCities(stateAbbrev: string): City[] {
  return (cities as City[]).filter((c) => c.state === stateAbbrev);
}

export default function StateLawPage() {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const law = (stateLaws as StateLaw[]).find((s) => s.slug === stateSlug);

  if (!law) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">State Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find legal data for this state.</p>
          <Link to="/laws">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <Scale className="h-4 w-4" /> Browse All State Laws
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const related = getRelatedStates(law);
  const stateCities = getStateCities(law.state);
  const stateMarketSlug = slugifyState(law.stateFull);

  const canonical = `https://aiwholesail.com/laws/${law.slug}`;

  // 40-60 word AI-extractable answer block. Leads with the direct YES/NO.
  const summary =
    `${law.wholesalingLegal ? 'Yes — wholesaling real estate is legal in ' : 'Wholesaling has restrictions in '}` +
    `${law.stateFull}${law.licenseRequired ? ', but ' + law.stateFull + ' requires a real estate license' : ' without a real estate license required'}. ` +
    `${law.assignmentAllowed ? 'Assignment of contract is allowed; ' : 'Assignment of contract is restricted; '}` +
    `${law.disclosureRequired ? 'wholesalers must disclose their position as a principal in the transaction. ' : 'explicit disclosure is best practice but not statutorily required. '}` +
    `Foreclosure is ${law.foreclosureType} with a typical timeline of ${law.foreclosureTimeline}. ` +
    `${law.landlordFriendly ? law.stateFull + ' is generally landlord-friendly.' : law.stateFull + ' has tenant-friendly protections — review carefully.'}`;

  const faqs = [
    {
      q: `Is wholesaling real estate legal in ${law.stateFull}?`,
      a: `${law.wholesalingLegal ? 'Yes, wholesaling is legal in ' + law.stateFull + '.' : 'Wholesaling in ' + law.stateFull + ' has restrictions — review state statutes carefully.'} ${law.licenseRequired ? 'A real estate license IS required to wholesale.' : 'No real estate license is required to wholesale.'} ${law.assignmentAllowed ? 'Assignment of contract is allowed.' : 'Assignment of contract is restricted — use a double-close structure.'} ${law.disclosureRequired ? 'Wholesalers must disclose their position as a principal in the transaction.' : 'Explicit disclosure of intent to assign is not statutorily required but is best practice.'} This is general guidance — consult a licensed ${law.stateFull} real estate attorney before structuring deals.`,
    },
    {
      q: `Do I need a real estate license to wholesale in ${law.stateFull}?`,
      a: `${law.licenseRequired ? law.stateFull + ' DOES require a real estate license to wholesale real estate.' : law.stateFull + ' does NOT require a real estate license to wholesale.'} ${law.notableRegulations}`,
    },
    {
      q: `What's the foreclosure process in ${law.stateFull}?`,
      a: `${law.stateFull} uses a ${law.foreclosureType} foreclosure process. Typical timeline from default to sale: ${law.foreclosureTimeline}. ${law.foreclosureType === 'non-judicial' ? 'Non-judicial foreclosures are faster and don\'t require court action — good for distressed-property investors who want fresh inventory turning over quickly.' : 'Judicial foreclosures require court action and take longer — gives investors more time to reach pre-foreclosure homeowners before the sale.'}`,
    },
    {
      q: `Is ${law.stateFull} landlord-friendly?`,
      a: `${law.landlordFriendly ? law.stateFull + ' is generally considered landlord-friendly with faster eviction timelines and limited tenant protections.' : law.stateFull + ' has stronger tenant protections — buy-and-hold landlords should review state-specific eviction rules and rent regulation before underwriting deals.'} Property tax rate is ${(law.propertyTaxRate * 100).toFixed(2)}% of assessed value. LLC filing fee: $${law.llcFilingFee}; annual fee: $${law.llcAnnualFee}.`,
    },
    {
      q: `What's the LLC filing cost for real estate investing in ${law.stateFull}?`,
      a: `Initial LLC filing fee in ${law.stateFull} is $${law.llcFilingFee}. Annual maintenance/franchise fee is $${law.llcAnnualFee}. ${law.homesteadExemption ? law.stateFull + ' has a homestead exemption that can shield equity in your primary residence from creditors.' : law.stateFull + ' does NOT have a homestead exemption — equity in your primary residence is not protected from creditors.'} ${law.transferTax ? 'Real estate transfer tax applies on title transfers.' : 'No state real estate transfer tax.'}`,
    },
  ];

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Wholesaling Laws in ${law.stateFull}`,
    description: summary,
    url: canonical,
    image: 'https://aiwholesail.com/og-image.png',
    author: { '@type': 'Organization', name: 'AIWholesail', url: 'https://aiwholesail.com' },
    publisher: {
      '@type': 'Organization',
      name: 'AIWholesail',
      logo: { '@type': 'ImageObject', url: 'https://aiwholesail.com/logo-aiw.png' },
    },
    datePublished: LAST_UPDATED,
    dateModified: LAST_UPDATED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    keywords: `${law.stateFull} wholesaling laws, ${law.stateFull} real estate wholesale, ${law.state} assignment of contract, ${law.stateFull} real estate license, ${law.stateFull} foreclosure laws`,
    about: { '@type': 'AdministrativeArea', name: law.stateFull },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <PublicLayout>
      <SEOHead
        title={`Wholesaling Laws in ${law.stateFull} -- Real Estate Investor Legal Guide 2026`}
        description={`Complete legal guide to real estate wholesaling in ${law.stateFull}. License requirements, assignment rules, foreclosure process, tax considerations, and investor tips for ${law.state} wholesalers.`}
        keywords={`${law.stateFull} wholesaling laws, ${law.stateFull} real estate wholesale, ${law.state} assignment of contract, ${law.stateFull} real estate license, ${law.stateFull} foreclosure laws, ${law.stateFull} landlord tenant laws, wholesale real estate ${law.stateFull}`}
        canonicalUrl={canonical}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'State Laws', url: 'https://aiwholesail.com/laws' },
          { name: law.stateFull, url: canonical },
        ]}
      />

      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <meta name="last-modified" content={LAST_UPDATED} />
        <meta property="article:modified_time" content={LAST_UPDATED} />
      </Helmet>

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/laws" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <Scale className="h-4 w-4" />
              <span>All State Laws</span>
            </Link>
          </div>

          <Badge variant="outline" className={`mb-6 text-xs border ${foreclosureColors[law.foreclosureType] || foreclosureColors['hybrid']}`}>
            <Gavel className="h-3 w-3 mr-1" />
            {law.foreclosureType} foreclosure
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Wholesaling Laws in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {law.stateFull}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Complete legal guide for real estate wholesalers and investors operating in {law.stateFull} ({law.state}).
            License requirements, assignment rules, and compliance guidance.
          </p>
          <p className="mt-6 inline-flex items-center gap-2 text-xs text-white/40">
            <Calendar className="h-3 w-3" /> Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
        </div>
      </section>

      {/* ===== AI-EXTRACTABLE ANSWER BLOCK ===== */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-3">
              Is wholesaling legal in {law.stateFull}?
            </h2>
            <p className="text-base md:text-lg text-white/80 font-light leading-relaxed">
              {summary}
            </p>
            <p className="mt-4 text-xs text-white/40">
              General guidance, not legal advice. Consult a licensed {law.stateFull} real estate attorney before structuring deals.
            </p>
          </div>
        </div>
      </section>

      {/* ===== QUICK FACTS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Quick Facts</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {law.stateFull} at a glance.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Wholesaling Legal',
                content: <BooleanIndicator value={law.wholesalingLegal} />,
                icon: Scale,
              },
              {
                label: 'License Required',
                content: <BooleanIndicator value={law.licenseRequired} invertColor />,
                icon: FileText,
              },
              {
                label: 'Assignment Allowed',
                content: <BooleanIndicator value={law.assignmentAllowed} />,
                icon: CheckCircle,
              },
              {
                label: 'Double Close Allowed',
                content: <BooleanIndicator value={law.doubleCloseAllowed} />,
                icon: Building2,
              },
              {
                label: 'Foreclosure Type',
                content: <span className="text-sm font-medium text-white capitalize">{law.foreclosureType}</span>,
                icon: Gavel,
              },
              {
                label: 'Foreclosure Timeline',
                content: <span className="text-sm font-medium text-white">{law.foreclosureTimeline}</span>,
                icon: Gavel,
              },
              {
                label: 'Landlord-Friendly',
                content: <BooleanIndicator value={law.landlordFriendly} falseLabel="Tenant-Friendly" />,
                icon: Home,
              },
              {
                label: 'Homestead Exemption',
                content: <BooleanIndicator value={law.homesteadExemption} />,
                icon: Shield,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{item.label}</p>
                  {item.content}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== IS WHOLESALING LEGAL? ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Legality</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            Is wholesaling legal in {law.stateFull}?
          </h2>
          <div className="max-w-3xl">
            <div className={`border rounded-xl p-8 mb-6 ${
              law.wholesalingLegal && !law.licenseRequired
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : law.wholesalingLegal && law.licenseRequired
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-red-500/20 bg-red-500/5'
            }`}>
              <div className="flex items-start gap-4">
                {law.wholesalingLegal && !law.licenseRequired ? (
                  <CheckCircle className="h-6 w-6 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : law.wholesalingLegal && law.licenseRequired ? (
                  <AlertTriangle className="h-6 w-6 text-amber-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {law.wholesalingLegal && !law.licenseRequired
                      ? `Yes -- wholesaling is legal in ${law.stateFull} without a license.`
                      : law.wholesalingLegal && law.licenseRequired
                        ? `Wholesaling is legal in ${law.stateFull}, but a license is required.`
                        : `Wholesaling may face restrictions in ${law.stateFull}.`
                    }
                  </h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed">
                    {law.notableRegulations}
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-cyan-400" />
                <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400">Disclaimer</p>
              </div>
              <p className="text-xs text-neutral-500 font-light leading-relaxed">
                This information is for educational purposes only and does not constitute legal advice.
                Real estate laws change frequently. Always consult with a licensed attorney in {law.stateFull} before
                engaging in wholesale real estate transactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LICENSE REQUIREMENTS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Requirements</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            License requirements in {law.stateFull}.
          </h2>
          <div className="max-w-3xl">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-sm text-neutral-400">Real Estate License Required</span>
                  <BooleanIndicator value={law.licenseRequired} invertColor />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-sm text-neutral-400">Assignment of Contract Allowed</span>
                  <BooleanIndicator value={law.assignmentAllowed} />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-sm text-neutral-400">Double Close Allowed</span>
                  <BooleanIndicator value={law.doubleCloseAllowed} />
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-neutral-400">Disclosure Required</span>
                  <BooleanIndicator value={law.disclosureRequired} />
                </div>
              </div>
            </div>

            {law.licenseRequired && (
              <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-6 mt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-400 mb-1">License Required</h4>
                    <p className="text-xs text-neutral-400 font-light leading-relaxed">
                      {law.stateFull} requires a real estate license for wholesale activity. Consider using a
                      double-close strategy with a licensed title company, or obtain your real estate license before
                      wholesaling. Consult with a local real estate attorney for compliant strategies.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== FORECLOSURE PROCESS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Foreclosure</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            Foreclosure process in {law.stateFull}.
          </h2>
          <div className="max-w-3xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5">
                  <Gavel className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Foreclosure Type</p>
                <p className="text-2xl font-bold tracking-tight text-white capitalize">{law.foreclosureType}</p>
                <p className="text-sm text-neutral-400 font-light mt-2">
                  {law.foreclosureType === 'judicial'
                    ? 'Foreclosures must go through the court system, which takes longer but provides more protections for property owners.'
                    : law.foreclosureType === 'non-judicial'
                      ? 'Foreclosures can proceed without court involvement, making the process faster and creating more deal flow.'
                      : 'The state allows both judicial and non-judicial foreclosures depending on the mortgage terms.'}
                </p>
              </div>
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5">
                  <Gavel className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Timeline</p>
                <p className="text-2xl font-bold tracking-tight text-white">{law.foreclosureTimeline}</p>
                <p className="text-sm text-neutral-400 font-light mt-2">
                  Average time from initial filing to completed foreclosure sale in {law.stateFull}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LANDLORD-TENANT LAWS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Landlord-Tenant</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            Landlord-tenant laws in {law.stateFull}.
          </h2>
          <div className="max-w-3xl">
            <div className={`border rounded-xl p-8 ${
              law.landlordFriendly
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-amber-500/20 bg-amber-500/5'
            }`}>
              <div className="flex items-start gap-4">
                <Home className={`h-6 w-6 mt-0.5 flex-shrink-0 ${law.landlordFriendly ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {law.landlordFriendly
                      ? `${law.stateFull} is landlord-friendly.`
                      : `${law.stateFull} is tenant-friendly.`
                    }
                  </h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed">
                    {law.landlordFriendly
                      ? `${law.stateFull} generally favors landlords with reasonable eviction processes, no statewide rent control, and balanced tenant-landlord regulations. This makes buy-and-hold and rental strategies more manageable for investors.`
                      : `${law.stateFull} has stronger tenant protections that investors should be aware of. These may include longer eviction timelines, rent control or stabilization measures, and additional requirements for landlords. Factor these into your investment calculations.`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TAX CONSIDERATIONS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Taxes & Costs</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            Tax considerations in {law.stateFull}.
          </h2>
          <div className="max-w-3xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <DollarSign className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Property Tax Rate</p>
                <p className="text-2xl font-bold tracking-tight text-white">{law.propertyTaxRate}%</p>
                <p className="text-xs text-neutral-400 font-light mt-1">Effective rate (avg.)</p>
              </div>
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <DollarSign className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Transfer Tax</p>
                <BooleanIndicator value={!law.transferTax} trueLabel="No Transfer Tax" falseLabel="Has Transfer Tax" />
              </div>
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <Building2 className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">LLC Filing Fee</p>
                <p className="text-2xl font-bold tracking-tight text-white">${law.llcFilingFee}</p>
                <p className="text-xs text-neutral-400 font-light mt-1">One-time formation</p>
              </div>
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <Building2 className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">LLC Annual Fee</p>
                <p className="text-2xl font-bold tracking-tight text-white">
                  {law.llcAnnualFee === 0 ? 'None' : `$${law.llcAnnualFee}`}
                </p>
                <p className="text-xs text-neutral-400 font-light mt-1">Annual report/fee</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== KEY STATUTES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Key Statutes</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            Key statutes and regulations.
          </h2>
          <div className="max-w-3xl">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Relevant {law.stateFull} Laws</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {law.keyStatutes.split(', ').map((statute) => (
                  <Badge
                    key={statute}
                    variant="outline"
                    className="text-xs font-light border-white/[0.08] text-neutral-400 py-1.5 px-3"
                  >
                    <FileText className="h-3 w-3 mr-1.5" />
                    {statute}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INVESTOR TIPS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Investor Tips</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-2xl">
            Investor tips for {law.stateFull}.
          </h2>
          <div className="max-w-3xl">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <p className="text-sm text-neutral-300 font-light leading-relaxed">
                {law.investorNotes}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-10">
            Common questions about {law.stateFull} real estate law.
          </h2>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6"
              >
                <h3 className="text-base md:text-lg font-semibold text-white mb-2">{f.q}</h3>
                <p className="text-sm md:text-base text-white/70 font-light leading-relaxed">{f.a}</p>
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
                to={`/states/${stateMarketSlug}`}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <MapPin className="h-4 w-4 text-cyan-400" /> {law.stateFull} Market Data
              </Link>
              {stateCities.slice(0, 3).map((city) => (
                <Link
                  key={city.slug}
                  to={`/markets/${city.slug}`}
                  className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                >
                  <MapPin className="h-4 w-4 text-cyan-400" /> {city.city}, {city.state} Market
                </Link>
              ))}
              <Link
                to="/guides"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <BookOpen className="h-4 w-4 text-cyan-400" /> Wholesale Guides
              </Link>
              <Link
                to="/laws"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <Scale className="h-4 w-4 text-cyan-400" /> All State Laws
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RELATED STATES ===== */}
      {related.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Related States</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">Similar state laws to explore.</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link key={r.slug} to={`/laws/${r.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <Scale className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${foreclosureColors[r.foreclosureType] || foreclosureColors['hybrid']}`}>
                        {r.foreclosureType}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {r.stateFull}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
                      {r.licenseRequired ? 'License required' : 'No license needed'} &middot;{' '}
                      {r.landlordFriendly ? 'Landlord-friendly' : 'Tenant-friendly'}
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View laws <ChevronRight className="h-3 w-3" />
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
            Find deals in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {law.stateFull} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail provides state-specific compliance guidance for {law.stateFull}. AI-powered deal scoring,
            instant comps, and automated seller outreach.
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
