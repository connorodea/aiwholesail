import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, ClipboardList, ChevronRight,
  Shield, CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import checklists from '@/data/checklists.json';

interface ChecklistItem {
  category: string;
  tasks: string[];
}

interface Checklist {
  slug: string;
  title: string;
  h1: string;
  description: string;
  items: ChecklistItem[];
}

export default function Checklists() {
  const allChecklists = checklists as Checklist[];

  return (
    <PublicLayout>
      <SEOHead
        title="Free Real Estate Checklists -- Investment Property Checklists"
        description="Free printable checklists for real estate investors. Due diligence, closing, rehab projects, rental acquisitions, wholesaling deals, and property analysis."
        keywords="real estate checklist, due diligence checklist, closing checklist, rehab checklist, rental property checklist, wholesale deal checklist, property analysis checklist"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Checklists
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Free Real Estate
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Investor Checklists.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Interactive, printable checklists covering due diligence, closing,
            rehab projects, rental acquisitions, and more.
          </p>
        </div>
      </section>

      {/* ===== CHECKLIST GRID ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-sm text-neutral-400 font-light mb-8">
            {allChecklists.length} checklist{allChecklists.length !== 1 ? 's' : ''}{' '}
            available
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allChecklists.map((cl) => {
              const taskCount = cl.items.reduce(
                (acc, item) => acc + item.tasks.length,
                0
              );

              return (
                <Link
                  key={cl.slug}
                  to={`/checklists/${cl.slug}`}
                  className="group"
                >
                  <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <Badge
                        variant="outline"
                        className="text-[10px] border border-cyan-500/20 text-cyan-400"
                      >
                        {taskCount} tasks
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                      {cl.title}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light leading-relaxed mb-5 flex-1">
                      {cl.description}
                    </p>

                    <div className="flex items-center gap-4 pt-4 border-t border-white/[0.06]">
                      <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <ClipboardList className="h-3 w-3" />
                        {cl.items.length} categories
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Go Further
          </p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Never miss
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              a critical step.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you AI-powered deal scoring, instant comps,
            automated outreach, and free calculators -- paired with these
            checklists to ensure you never miss a step.
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
