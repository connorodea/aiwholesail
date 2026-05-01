import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Repeat,
  Hammer,
  Building2,
  Users,
  GraduationCap,
  TrendingUp,
  Target,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  Shield,
  CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';

interface UseCase {
  icon: React.ReactNode;
  audience: string;
  tagline: string;
  description: string;
  useCases: string[];
  highlight: {
    type: 'metric' | 'quote';
    value: string;
    label?: string;
  };
  accentIcon: React.ReactNode;
}

const audiences: UseCase[] = [
  {
    icon: <Repeat className="h-6 w-6" />,
    audience: 'Wholesalers',
    tagline: 'Find deals and assign contracts faster',
    description:
      'Find deeply discounted properties, calculate your assignment fee instantly, and connect with verified cash buyers -- all from one platform.',
    useCases: [
      'Find undervalued properties below market value with AI-powered deal scoring',
      'Calculate assignment fees and potential profit margins in seconds',
      'Match properties with your cash buyer list based on their criteria',
      'Automate follow-ups with motivated sellers through smart sequences',
    ],
    highlight: {
      type: 'metric',
      value: '3x faster',
      label: 'Average deal sourcing speed vs. manual methods',
    },
    accentIcon: <Target className="h-5 w-5" />,
  },
  {
    icon: <Hammer className="h-6 w-6" />,
    audience: 'Fix and Flippers',
    tagline: 'Identify rehab potential and maximize profit',
    description:
      'Identify properties with the highest rehab potential, estimate repair costs with AI assistance, and track every deal through your pipeline.',
    useCases: [
      'Identify properties with high rehab potential using condition analysis',
      'Estimate repair costs with AI-assisted cost modeling',
      'Calculate after-repair value and profit margins with comparable sales data',
      'Track deals through your pipeline from acquisition to sale',
    ],
    highlight: {
      type: 'metric',
      value: '87%',
      label: 'Value estimate accuracy based on comparable sales analysis',
    },
    accentIcon: <BarChart3 className="h-5 w-5" />,
  },
  {
    icon: <Building2 className="h-6 w-6" />,
    audience: 'Buy and Hold Investors',
    tagline: 'Source rental properties below market value',
    description:
      'Source rental properties below market value, analyze cash flow potential, and set up automated alerts so you never miss a deal in your target markets.',
    useCases: [
      'Find rental properties listed below market value across multiple markets',
      'Analyze monthly cash flow potential, cash-on-cash return, and cap rates',
      'Compare rental yields across different neighborhoods and markets',
      'Set up custom alerts for properties matching your investment criteria',
    ],
    highlight: {
      type: 'quote',
      value:
        'I set up alerts in three zip codes and found a 4-unit under market value within the first week.',
      label: 'Buy and hold investor, Atlanta metro',
    },
    accentIcon: <Bell className="h-5 w-5" />,
  },
  {
    icon: <Users className="h-6 w-6" />,
    audience: 'Real Estate Agents',
    tagline: 'Give your clients an edge with AI insights',
    description:
      'Give your clients an edge with AI-powered market intelligence. Source off-market opportunities and run instant property analysis during showings.',
    useCases: [
      'Source off-market and pre-foreclosure listings to bring exclusive deals to clients',
      'Run instant property analysis and comparable sales during client showings',
      'Impress investor clients with AI-powered market data and deal scoring',
    ],
    highlight: {
      type: 'metric',
      value: '40%',
      label: 'More investor client retention reported by agents using AI deal tools',
    },
    accentIcon: <TrendingUp className="h-5 w-5" />,
  },
  {
    icon: <GraduationCap className="h-6 w-6" />,
    audience: 'New Investors',
    tagline: 'Start your investing journey with confidence',
    description:
      'Start your investing journey with AI-guided analysis and deal scoring. Build confidence with the same professional tools experienced investors rely on.',
    useCases: [
      'Learn with AI-guided property analysis that explains every metric',
      'Start with lower-risk deals identified by conservative scoring filters',
      'Use deal scoring to evaluate opportunities and build investment confidence',
      'Access the same professional-grade tools that experienced investors use',
    ],
    highlight: {
      type: 'quote',
      value:
        'The deal scoring gave me the confidence to make my first offer. I closed my first investment property within 60 days.',
      label: 'First-time investor, Phoenix',
    },
    accentIcon: <Brain className="h-5 w-5" />,
  },
];

export default function UseCases() {
  return (
    <PublicLayout>
      <SEOHead
        title="Use Cases"
        description="See how real estate wholesalers, flippers, buy & hold investors, agents, and new investors use AIWholesail to find profitable deals faster with AI."
        keywords="real estate use cases, wholesaling, fix and flip, rental investing, real estate agents, new investors, AI property analysis"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">USE CASES</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            One Platform, Every
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Investing Strategy.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Whether you wholesale, flip, hold, or are just getting started -- AIWholesail gives you the AI-powered tools to find, analyze, and close better deals.
          </p>
        </div>
      </section>

      {/* ===== AUDIENCE SECTIONS -- ALTERNATING LIGHT/DARK ===== */}
      {audiences.map((item, index) => {
        const isDark = index % 2 === 1;

        return (
          <div key={item.audience}>
            <section className={`py-24 px-4 ${isDark ? 'bg-[#0a0a0a] text-white' : ''}`}>
              <div className="container mx-auto max-w-7xl">
                <div className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center`}>
                  {/* Content Side */}
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${isDark ? 'bg-white/10 text-cyan-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                        {item.icon}
                      </div>
                    </div>

                    <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-3">
                      {item.tagline}
                    </p>

                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                      {item.audience}
                    </h2>

                    <p className={`font-light leading-relaxed mb-8 ${isDark ? 'text-white/60' : 'text-neutral-400'}`}>
                      {item.description}
                    </p>

                    <ul className="space-y-4 mb-8">
                      {item.useCases.map((useCase, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                          <span className={`text-sm font-light leading-relaxed ${isDark ? 'text-white/70' : ''}`}>
                            {useCase}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Highlight Card Side */}
                  <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                    <div className={`rounded-xl p-8 lg:p-10 ${
                      isDark
                        ? 'bg-white/5 border border-white/10'
                        : 'bg-white/[0.03] border border-white/[0.06]'
                    }`}>
                      <div className="flex items-center gap-2 mb-6">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${isDark ? 'bg-white/10 text-cyan-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                          {item.accentIcon}
                        </div>
                        <span className={`text-xs font-semibold tracking-[0.15em] uppercase ${isDark ? 'text-white/40' : 'text-neutral-400'}`}>
                          {item.highlight.type === 'metric'
                            ? 'Key metric'
                            : 'From the community'}
                        </span>
                      </div>

                      {item.highlight.type === 'metric' ? (
                        <>
                          <div className="text-5xl md:text-6xl font-bold text-cyan-400 mb-3 tracking-tight">
                            {item.highlight.value}
                          </div>
                          <p className={`font-light text-sm leading-relaxed ${isDark ? 'text-white/50' : 'text-neutral-400'}`}>
                            {item.highlight.label}
                          </p>
                        </>
                      ) : (
                        <>
                          <blockquote className={`text-lg font-light leading-relaxed mb-4 ${isDark ? 'text-white/80' : 'text-white/90'}`}>
                            &ldquo;{item.highlight.value}&rdquo;
                          </blockquote>
                          <p className={`text-sm font-light ${isDark ? 'text-white/40' : 'text-neutral-400'}`}>
                            -- {item.highlight.label}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Gradient transitions between dark/light sections */}
            {isDark && index < audiences.length - 1 && (
              <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-[#08090a]" />
            )}
            {!isDark && index < audiences.length - 1 && audiences[index + 1] && (index + 1) % 2 === 1 && (
              <div className="h-24 bg-gradient-to-b from-background to-[#0a0a0a]" />
            )}
          </div>
        );
      })}

      {/* Fade from last section to CTA */}
      <div className="h-24 bg-gradient-to-b from-background to-[#0a0a0a]" />

      {/* ===== CTA -- DARK ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
            No matter your strategy,
            <br />
            <span className="bg-gradient-to-r from-neutral-800 via-white to-white bg-clip-text text-transparent">
              find deals faster.
            </span>
          </h2>
          <p className="text-lg text-white/60 font-light max-w-2xl mx-auto mb-10">
            Start your 7-day free trial and see why thousands of real estate professionals trust AIWholesail to power their deal flow.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/pricing">
              <Button size="lg" className="rounded-full px-10 text-base font-semibold bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 gap-2">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="rounded-full px-8 text-base font-semibold border-white/20 text-white hover:bg-white/10 gap-2">
                Talk to Sales
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-white/40 mt-8">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> Cancel Anytime</span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
