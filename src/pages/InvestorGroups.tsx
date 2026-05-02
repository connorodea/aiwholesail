import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Search, ChevronRight, Shield, Star, Users, MapPin,
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

export default function InvestorGroups() {
  const [searchQuery, setSearchQuery] = useState('');

  const cities = investorGroups as CityEntry[];

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return cities;
    const query = searchQuery.toLowerCase();
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(query) ||
        c.state.toLowerCase().includes(query) ||
        `${c.city}, ${c.state}`.toLowerCase().includes(query) ||
        c.groups.some((g) => g.name.toLowerCase().includes(query))
    );
  }, [cities, searchQuery]);

  const totalGroups = useMemo(
    () => cities.reduce((sum, c) => sum + c.groups.length, 0),
    [cities]
  );

  return (
    <PublicLayout>
      <SEOHead
        title="Real Estate Investor Groups & REIA Directory -- Find Meetups Near You"
        description="Find real estate investor groups, REIA chapters, and local meetups in 40+ major cities. Connect with wholesalers, flippers, and buy-and-hold investors near you."
        keywords="real estate investor groups, REIA near me, real estate investor meetups, local REIA groups, real estate investing clubs, REIA directory, investor networking"
        canonicalUrl="https://aiwholesail.com/investor-groups"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Investor Groups', url: 'https://aiwholesail.com/investor-groups' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-16 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">INVESTOR DIRECTORY</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Real Estate Investor
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Groups & Meetups.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Find REIA chapters, investing clubs, and local meetups in {cities.length} major cities. {totalGroups}+ groups to connect with wholesalers, flippers, and landlords near you.
          </p>
        </div>
      </section>

      {/* ===== SEARCH ===== */}
      <section className="py-8 px-4 border-b border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by city, state, or group name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
            />
          </div>
          <p className="text-xs text-neutral-500 mt-3">
            Showing {filteredCities.length} of {cities.length} cities
          </p>
        </div>
      </section>

      {/* ===== CITIES GRID ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          {filteredCities.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg text-neutral-400 mb-2">No cities match your search.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCities.map((city) => (
                <Link
                  key={city.slug}
                  to={`/investor-groups/${city.slug}`}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{city.state}</span>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {city.city}, {city.state}
                  </h3>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-neutral-500" />
                      <span className="text-xs text-neutral-400">{city.groups.length} groups</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {city.groups.slice(0, 2).map((group, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-[11px] border border-white/[0.06] bg-white/[0.02] rounded text-neutral-500"
                      >
                        {group.name}
                      </span>
                    ))}
                    {city.groups.length > 2 && (
                      <span className="px-2 py-1 text-[11px] text-neutral-600">
                        +{city.groups.length - 2} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-cyan-400 group-hover:text-cyan-300 transition-colors">
                    View Groups <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== WHY JOIN ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Why Join a REIA?</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-10">
            Benefits of investor groups.
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Find deals before they hit the market', desc: 'REIA members share off-market leads, wholesale deals, and pocket listings with each other.' },
              { title: 'Build your buyers list', desc: 'Meet cash buyers, flippers, and landlords who are actively looking for properties to purchase.' },
              { title: 'Learn from experienced investors', desc: 'Get mentorship, ask questions, and learn strategies from people who have done hundreds of deals.' },
              { title: 'Access private money and hard money lenders', desc: 'Many lenders attend REIAs specifically to connect with borrowers and fund deals.' },
              { title: 'Find contractors and service providers', desc: 'Get vetted referrals for title companies, attorneys, inspectors, and contractors.' },
              { title: 'Stay current on market conditions', desc: 'Local groups discuss market trends, regulatory changes, and emerging opportunities.' },
            ].map((benefit, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6"
              >
                <h3 className="text-base font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Find Deals to Share</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Bring deals to your
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              next meetup.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail finds off-market deals, scores them with AI, and helps you close faster. Show up to your next REIA meeting with real opportunities.
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
    </PublicLayout>
  );
}
