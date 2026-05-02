import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight, Shield, Star, ChevronRight, Users, Calendar,
  MapPin, Globe, Lightbulb, Check, ExternalLink, Target,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import investorGroups from '@/data/investor-groups.json';

interface InvestorGroup {
  name: string;
  type: string;
  meetingFrequency: string;
  memberCount: string;
  focus: string[];
  website?: string | null;
}

interface CityEntry {
  slug: string;
  citySlug: string;
  city: string;
  state: string;
  groups: InvestorGroup[];
  onlineGroups: string[];
  tips: string[];
}

const typeBadgeColors: Record<string, string> = {
  REIA: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Meetup: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Club: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function InvestorGroupPage() {
  const { slug } = useParams<{ slug: string }>();
  const data = (investorGroups as CityEntry[]).find((c) => c.slug === slug);

  if (!data) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">City Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find investor groups for this city.</p>
          <Link to="/investor-groups">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              Browse All Cities
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const otherCities = (investorGroups as CityEntry[])
    .filter((c) => c.slug !== data.slug)
    .slice(0, 6);

  return (
    <PublicLayout>
      <SEOHead
        title={`Real Estate Investor Groups in ${data.city}, ${data.state} -- REIA Meetups & Clubs`}
        description={`Find real estate investor groups, REIA chapters, and investing meetups in ${data.city}, ${data.state}. Connect with ${data.groups.length}+ local groups for wholesaling, flipping, and rental investing.`}
        keywords={`real estate investor groups ${data.city}, REIA ${data.city} ${data.state}, real estate meetups ${data.city}, investor networking ${data.city}, wholesaling groups ${data.city}, REIA near me ${data.city}`}
        canonicalUrl={`https://aiwholesail.com/investor-groups/${data.slug}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Investor Groups', url: 'https://aiwholesail.com/investor-groups' },
          { name: `${data.city}, ${data.state}`, url: `https://aiwholesail.com/investor-groups/${data.slug}` },
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
            <Link to="/investor-groups" className="hover:text-white transition-colors">Investor Groups</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-400">{data.city}, {data.state}</span>
          </nav>

          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">INVESTOR GROUPS</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Real Estate Investor Groups
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              in {data.city}, {data.state}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Connect with {data.groups.length} local REIA groups, investing clubs, and meetups in the {data.city} area. Find wholesalers, flippers, and buy-and-hold investors near you.
          </p>
        </div>
      </section>

      {/* ===== QUICK STATS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-6">At a Glance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">City</span>
                </div>
                <p className="text-sm font-semibold text-white">{data.city}, {data.state}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Users className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Groups</span>
                </div>
                <p className="text-sm font-semibold text-white">{data.groups.length} local groups</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Globe className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Online</span>
                </div>
                <p className="text-sm font-semibold text-white">{data.onlineGroups.length} online groups</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Target className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Focus</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {Array.from(new Set(data.groups.flatMap((g) => g.focus))).length}+ strategies
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== GROUP CARDS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Local Groups</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            Investor groups in {data.city}.
          </h2>
          <div className="grid gap-4">
            {data.groups.map((group, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`text-xs font-medium uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                          typeBadgeColors[group.type] || 'bg-white/[0.05] text-neutral-400 border-white/[0.08]'
                        }`}
                      >
                        {group.type}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                      {group.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400 mb-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="font-light">{group.meetingFrequency}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="font-light">{group.memberCount} members</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {group.focus.map((f, j) => (
                        <span
                          key={j}
                          className="px-2.5 py-1 text-[11px] border border-white/[0.06] bg-white/[0.02] rounded text-neutral-500"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-4 md:min-w-[140px]">
                    {group.website ? (
                      <a
                        href={group.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        Visit Website <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-600">Search online to find</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ONLINE GROUPS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Online Communities</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            Virtual groups for {data.city} investors.
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {data.onlineGroups.map((group, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{group}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Online community</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TIPS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Local Tips</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            Tips for finding groups in {data.city}.
          </h2>
          <div className="space-y-4">
            {data.tips.map((tip, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 flex items-start gap-4"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="h-4 w-4 text-cyan-400" />
                </div>
                <p className="text-sm text-neutral-300 font-light leading-relaxed">{tip}</p>
              </div>
            ))}
            {/* General tips */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="h-4 w-4 text-cyan-400" />
              </div>
              <p className="text-sm text-neutral-300 font-light leading-relaxed">Search Meetup.com and Facebook Groups for additional investor meetups in {data.city} -- new groups form regularly.</p>
            </div>
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="h-4 w-4 text-cyan-400" />
              </div>
              <p className="text-sm text-neutral-300 font-light leading-relaxed">Bring business cards and a clear elevator pitch about what types of deals you are looking for or can offer.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY JOIN A REIA ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Why Join?</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-10">
            Why join a REIA in {data.city}.
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Access off-market deals and wholesale opportunities before they hit the MLS',
              'Build your cash buyers list by meeting active flippers and landlords in person',
              'Get mentorship from investors who know the local market inside and out',
              'Find reliable contractors, title companies, and hard money lenders through referrals',
              'Learn about local regulations, zoning changes, and market trends firsthand',
              'Joint venture on deals that are too large or complex to do alone',
            ].map((benefit, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4"
              >
                <Check className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-neutral-300 font-light leading-relaxed">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LINK TO MARKET PAGE ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <Link
            to={`/markets/${data.citySlug}`}
            className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 flex items-center justify-between group hover:border-cyan-500/20 transition-all duration-300"
          >
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-2">Market Data</p>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                View {data.city}, {data.state} Market Analysis
              </h3>
              <p className="text-sm text-neutral-400 font-light mt-1">
                Median prices, inventory levels, days on market, and investment metrics.
              </p>
            </div>
            <ChevronRight className="h-6 w-6 text-neutral-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
          </Link>
        </div>
      </section>

      {/* ===== OTHER CITIES ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">More Cities</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            Explore other markets.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherCities.map((city) => (
              <Link
                key={city.slug}
                to={`/investor-groups/${city.slug}`}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{city.state}</span>
                  <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                  {city.city}, {city.state}
                </h3>
                <p className="text-xs text-neutral-500">{city.groups.length} groups</p>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/investor-groups" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
              View all cities
            </Link>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Find Deals First</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find deals to bring to
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              your next meetup.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail finds off-market deals in {data.city} and scores them with AI so you can show up to your next REIA meeting with real opportunities.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-light">No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-light">4.8/5 User Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SCHEMA MARKUP ===== */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": `Real Estate Investor Groups in ${data.city}, ${data.state}`,
            "description": `Directory of ${data.groups.length} real estate investor groups, REIA chapters, and meetups in ${data.city}, ${data.state}.`,
            "numberOfItems": data.groups.length,
            "itemListElement": data.groups.map((group, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "item": {
                "@type": "Organization",
                "name": group.name,
                "description": `${group.type} group in ${data.city}, ${data.state} focused on ${group.focus.join(', ')}. Meets ${group.meetingFrequency.toLowerCase()} with ${group.memberCount} members.`,
              },
            })),
          }),
        }}
      />
    </PublicLayout>
  );
}
