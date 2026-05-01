import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Users, ChevronRight,
  Shield, CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import personas from '@/data/personas.json';

interface Persona {
  slug: string;
  title: string;
  h1: string;
  description: string;
  persona: string;
  painPoints: string[];
  solutions: string[];
  features: string[];
  testimonial: { quote: string; name: string; role: string };
  relatedGuides: string[];
  relatedTools: string[];
}

const personaIcons: Record<string, string> = {
  'First-Time Investor': '🎯',
  'Wholesaler': '🔄',
  'House Flipper': '🏗',
  'Landlord': '🏠',
  'Buy-and-Hold Investor': '📈',
  'Real Estate Agent': '🤝',
  'Property Manager': '🔧',
  'Out-of-State Investor': '🗺',
};

export default function Personas() {
  const allPersonas = personas as Persona[];

  return (
    <PublicLayout>
      <SEOHead
        title="AIWholesail for Every Investor Type -- Find Your Fit"
        description="See how AIWholesail helps first-time investors, wholesalers, house flippers, landlords, agents, and more find and close profitable real estate deals."
        keywords="real estate investor types, wholesaler tools, house flipper tools, landlord tools, real estate agent tools, property manager tools"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Built For You
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            AIWholesail for
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Every Investor.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Whether you are closing your first deal or scaling a portfolio,
            AIWholesail has the tools and intelligence you need.
          </p>
        </div>
      </section>

      {/* ===== PERSONA GRID ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-sm text-neutral-400 font-light mb-8">
            {allPersonas.length} investor types
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {allPersonas.map((p) => (
              <Link
                key={p.slug}
                to={`/for/${p.slug}`}
                className="group"
              >
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">{personaIcons[p.persona] || '💼'}</span>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="text-[10px] border border-cyan-500/20 text-cyan-400 mb-3 w-fit"
                  >
                    {p.persona}
                  </Badge>

                  <h3 className="text-lg font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {p.title.replace('AIWholesail for ', '')}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed mb-5 flex-1">
                    {p.description}
                  </p>

                  <div className="flex items-center gap-2 pt-4 border-t border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <Users className="h-3 w-3" />
                      {p.features.length} features
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Get Started
          </p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find your
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              perfect fit.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            No matter your experience level or strategy, AIWholesail
            gives you the tools to find and close profitable deals.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" /> No Credit Card
              Required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Cancel
              Anytime
            </span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
