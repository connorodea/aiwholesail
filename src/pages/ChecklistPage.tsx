import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, ClipboardList, ChevronRight, Printer,
  Shield, CheckCircle, CheckSquare, Square,
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

export default function ChecklistPage() {
  const { slug } = useParams<{ slug: string }>();
  const checklist = (checklists as Checklist[]).find((c) => c.slug === slug);

  const totalTasks = useMemo(() => {
    if (!checklist) return 0;
    return checklist.items.reduce((acc, item) => acc + item.tasks.length, 0);
  }, [checklist]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const completedCount = Object.values(checked).filter(Boolean).length;
  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  function toggleTask(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handlePrint() {
    window.print();
  }

  if (!checklist) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Checklist Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this checklist.</p>
          <Link to="/checklists">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <ClipboardList className="h-4 w-4" /> Browse All Checklists
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <SEOHead
        title={checklist.title}
        description={checklist.description}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Checklists', url: 'https://aiwholesail.com/checklists' },
          { name: checklist.title, url: `https://aiwholesail.com/checklists/${checklist.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link
              to="/checklists"
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              <ClipboardList className="h-4 w-4" />
              <span>All Checklists</span>
            </Link>
          </div>

          <Badge
            variant="outline"
            className="text-xs border-cyan-500/20 text-cyan-400 mb-6"
          >
            {totalTasks} tasks
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {checklist.h1}
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {checklist.description}
          </p>
        </div>
      </section>

      {/* ===== PROGRESS BAR & PRINT ===== */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-400 font-light">
                  {completedCount} of {totalTasks} completed
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    progress === 100
                      ? 'border-emerald-500/20 text-emerald-400'
                      : 'border-white/[0.08] text-neutral-400'
                  }`}
                >
                  {progress}%
                </Badge>
              </div>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors print:hidden"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== CHECKLIST SECTIONS ===== */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-3xl space-y-8">
          {checklist.items.map((section, sIdx) => {
            const sectionCompleted = section.tasks.filter(
              (_, tIdx) => checked[`${sIdx}-${tIdx}`]
            ).length;

            return (
              <div
                key={sIdx}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    {section.category}
                  </h2>
                  <span className="text-xs text-neutral-500">
                    {sectionCompleted}/{section.tasks.length}
                  </span>
                </div>

                <ul className="space-y-3">
                  {section.tasks.map((task, tIdx) => {
                    const key = `${sIdx}-${tIdx}`;
                    const isChecked = !!checked[key];

                    return (
                      <li key={tIdx}>
                        <button
                          onClick={() => toggleTask(key)}
                          className="flex items-start gap-3 w-full text-left group py-1"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Square className="h-5 w-5 text-neutral-600 group-hover:text-neutral-400 flex-shrink-0 mt-0.5 transition-colors" />
                          )}
                          <span
                            className={`text-sm transition-colors ${
                              isChecked
                                ? 'text-neutral-500 line-through'
                                : 'text-neutral-300 group-hover:text-white'
                            }`}
                          >
                            {task}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Get Started
          </p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Analyze deals
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              with AI.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you AI-powered deal scoring, instant comps,
            automated outreach, and free calculators -- everything you need to
            close profitable deals.
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
