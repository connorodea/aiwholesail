import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Search, ChevronRight, Scale, Shield,
  CheckCircle, XCircle, Gavel, Filter,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import stateLaws from '@/data/state-laws.json';

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

type LicenseFilter = 'all' | 'no-license' | 'license-required';

const foreclosureColors: Record<string, string> = {
  'judicial': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'non-judicial': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'hybrid': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

export default function StateLaws() {
  const [query, setQuery] = useState('');
  const [licenseFilter, setLicenseFilter] = useState<LicenseFilter>('all');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (stateLaws as StateLaw[]).filter((s) => {
      const matchesQuery =
        !q ||
        s.stateFull.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q) ||
        s.slug.includes(q);
      const matchesLicense =
        licenseFilter === 'all' ||
        (licenseFilter === 'no-license' && !s.licenseRequired) ||
        (licenseFilter === 'license-required' && s.licenseRequired);
      return matchesQuery && matchesLicense;
    });
  }, [query, licenseFilter]);

  return (
    <PublicLayout>
      <SEOHead
        title="Wholesaling Laws by State -- Real Estate Investor Legal Guide 2026"
        description="Comprehensive state-by-state guide to real estate wholesaling laws. License requirements, assignment rules, foreclosure types, tax considerations, and investor tips for all 50 US states + DC."
        keywords="wholesaling laws by state, real estate wholesaling legal, state wholesaling regulations, wholesale real estate license requirements, assignment of contract laws, foreclosure laws by state"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Legal Guide</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Wholesaling Laws
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              by State.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            State-by-state legal guide for real estate wholesalers.
            License requirements, assignment rules, foreclosure types, and investor tips for all 50 states + DC.
          </p>
        </div>
      </section>

      {/* ===== SEARCH & FILTER ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by state name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              />
            </div>

            {/* License filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-neutral-400" />
              {([
                { value: 'all' as LicenseFilter, label: 'All States' },
                { value: 'no-license' as LicenseFilter, label: 'No License Needed' },
                { value: 'license-required' as LicenseFilter, label: 'License Required' },
              ]).map((f) => (
                <button
                  key={f.value}
                  onClick={() => setLicenseFilter(f.value)}
                  className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                    licenseFilter === f.value
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'bg-neutral-900/50 text-neutral-400 border border-white/[0.08] hover:border-cyan-500/20'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-neutral-400 font-light mt-4">
            {filtered.length} state{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </section>

      {/* ===== STATE GRID ===== */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <Link key={s.slug} to={`/laws/${s.slug}`} className="group">
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${foreclosureColors[s.foreclosureType] || foreclosureColors['hybrid']}`}>
                        <Gavel className="h-2.5 w-2.5 mr-0.5" />
                        {s.foreclosureType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {s.stateFull}
                  </h3>
                  <p className="text-xs text-neutral-400 font-light mb-5">{s.state}</p>

                  <div className="mt-auto space-y-3">
                    {/* Wholesaling Legal */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Wholesaling Legal</span>
                      <span className="flex items-center gap-1">
                        {s.wholesalingLegal ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-400" />
                        )}
                        <span className={`text-xs font-medium ${s.wholesalingLegal ? 'text-emerald-400' : 'text-red-400'}`}>
                          {s.wholesalingLegal ? 'Yes' : 'No'}
                        </span>
                      </span>
                    </div>

                    {/* License Required */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">License Required</span>
                      <span className="flex items-center gap-1">
                        {s.licenseRequired ? (
                          <XCircle className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        <span className={`text-xs font-medium ${s.licenseRequired ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {s.licenseRequired ? 'Yes' : 'No'}
                        </span>
                      </span>
                    </div>

                    {/* Landlord Friendly */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Landlord-Friendly</span>
                      <span className="flex items-center gap-1">
                        {s.landlordFriendly ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        <span className={`text-xs font-medium ${s.landlordFriendly ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {s.landlordFriendly ? 'Yes' : 'Tenant-Friendly'}
                        </span>
                      </span>
                    </div>

                    {/* Foreclosure */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <span className="text-xs text-neutral-500">Foreclosure</span>
                      <span className="text-xs text-neutral-300">{s.foreclosureTimeline}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <Scale className="h-10 w-10 text-neutral-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-white mb-2">No states found</p>
              <p className="text-sm text-neutral-400 font-light">Try a different search or filter.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Go Further</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find compliant deals
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              in any state.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail provides state-specific compliance guidance, AI-powered deal scoring, and automated outreach -- all starting at $29/mo.
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
