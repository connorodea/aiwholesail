import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Users, ChevronRight, AlertTriangle, Lightbulb,
  Zap, Quote, BookOpen, Calculator, Shield, CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import personas from '@/data/personas.json';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

interface Persona {
  slug: string;
  title: string;
  h1: string;
  description: string;
  persona: string;
  painPoints: string[];
  solutions: string[];
  features: string[];
  testimonial: Testimonial;
  relatedGuides: string[];
  relatedTools: string[];
}

function formatToolName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function PersonaPage() {
  const { slug } = useParams<{ slug: string }>();
  const persona = (personas as Persona[]).find((p) => p.slug === slug);

  if (!persona) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Page Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this page.</p>
          <Link to="/for">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <Users className="h-4 w-4" /> Browse All Personas
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <SEOHead
        title={persona.title}
        description={persona.description}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'For', url: 'https://aiwholesail.com/for' },
          { name: persona.persona, url: `https://aiwholesail.com/for/${persona.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link
              to="/for"
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              <Users className="h-4 w-4" />
              <span>All Personas</span>
            </Link>
          </div>

          <Badge
            variant="outline"
            className="text-xs border-cyan-500/20 text-cyan-400 mb-6"
          >
            {persona.persona}
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {persona.h1}
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {persona.description}
          </p>
        </div>
      </section>

      {/* ===== PAIN POINTS -> SOLUTIONS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Your Challenges, Solved
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            We understand your pain points.
          </h2>

          <div className="space-y-6">
            {persona.painPoints.map((pain, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wide uppercase text-red-400 mb-1">
                        Pain Point
                      </p>
                      <p className="text-white font-medium">{pain}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Lightbulb className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wide uppercase text-emerald-400 mb-1">
                        Our Solution
                      </p>
                      <p className="text-neutral-300 font-light">
                        {persona.solutions[i]}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Features
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            Tools built for{' '}
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {persona.persona.toLowerCase()}s.
            </span>
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {persona.features.map((feature, i) => (
              <div
                key={i}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-white font-semibold">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIAL ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-10 text-center">
            <Quote className="h-8 w-8 text-cyan-500/30 mx-auto mb-6" />
            <blockquote className="text-xl md:text-2xl text-white font-light leading-relaxed mb-6">
              &ldquo;{persona.testimonial.quote}&rdquo;
            </blockquote>
            <div>
              <p className="text-white font-semibold">{persona.testimonial.name}</p>
              <p className="text-sm text-neutral-400">{persona.testimonial.role}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RELATED RESOURCES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Related Resources
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            Explore more.
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {persona.relatedTools.length > 0 && (
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Free Tools
                  </h3>
                </div>
                <ul className="space-y-2">
                  {persona.relatedTools.map((tool) => (
                    <li key={tool}>
                      <Link
                        to={`/tools/${tool}`}
                        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                        {formatToolName(tool)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {persona.relatedGuides.length > 0 && (
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Related Guides
                  </h3>
                </div>
                <ul className="space-y-2">
                  {persona.relatedGuides.map((guide) => (
                    <li key={guide}>
                      <Link
                        to={`/guides/${guide}`}
                        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                        {formatToolName(guide)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            Ready to invest
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              with confidence?
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you AI-powered deal scoring, instant comps,
            automated outreach, and free calculators -- everything you need to
            find and close profitable deals.
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
