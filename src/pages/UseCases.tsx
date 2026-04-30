import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
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
  DollarSign,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

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
    tagline: 'How wholesalers use AIWholesail',
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
    audience: 'Fix & Flippers',
    tagline: 'How flippers use AIWholesail',
    description:
      'Identify properties with the highest rehab potential, estimate repair costs with AI assistance, and track every deal through your pipeline.',
    useCases: [
      'Identify properties with high rehab potential using property condition analysis',
      'Estimate repair costs with AI-assisted damage detection and cost modeling',
      'Calculate after-repair value (ARV) and profit margins with comparable sales data',
      'Track deals through your pipeline from acquisition to sale',
    ],
    highlight: {
      type: 'metric',
      value: '87%',
      label: 'ARV estimate accuracy based on comparable sales analysis',
    },
    accentIcon: <BarChart3 className="h-5 w-5" />,
  },
  {
    icon: <Building2 className="h-6 w-6" />,
    audience: 'Buy & Hold Investors',
    tagline: 'How rental investors use AIWholesail',
    description:
      'Source rental properties below market value, analyze cash flow potential, and set up automated alerts so you never miss a deal in your target markets.',
    useCases: [
      'Find rental properties listed below market value across multiple markets',
      'Analyze monthly cash flow potential, cash-on-cash return, and cap rates',
      'Compare cap rates and rental yields across different neighborhoods and markets',
      'Set up custom alerts for properties matching your investment criteria',
    ],
    highlight: {
      type: 'quote',
      value:
        'I set up alerts in three zip codes and found a 4-unit under market value within the first week.',
      label: 'Buy & hold investor, Atlanta metro',
    },
    accentIcon: <Bell className="h-5 w-5" />,
  },
  {
    icon: <Users className="h-6 w-6" />,
    audience: 'Real Estate Agents',
    tagline: 'How agents use AIWholesail',
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
    tagline: 'How beginners use AIWholesail',
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title="Use Cases"
        description="See how real estate wholesalers, flippers, buy & hold investors, agents, and new investors use AIWholesail to find profitable deals faster with AI."
        keywords="real estate use cases, wholesaling, fix and flip, rental investing, real estate agents, new investors, AI property analysis"
      />

      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
              <div className="text-lg font-semibold">Use Cases</div>
              <div className="w-20" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge
            variant="secondary"
            className="mb-6 px-4 py-1.5 text-sm font-medium bg-primary/10 text-primary border-0"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Built for every strategy
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-6">
            One platform, every{' '}
            <span className="text-primary">investing strategy</span>
          </h1>
          <p className="text-lg text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto">
            Whether you wholesale, flip, hold, or are just getting started,
            AIWholesail gives you the AI-powered tools to find, analyze, and
            close better deals.
          </p>
        </div>
      </section>

      {/* Audience Sections */}
      <section className="pb-24 px-4">
        <div className="container mx-auto max-w-7xl space-y-16">
          {audiences.map((item, index) => (
            <div
              key={item.audience}
              className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center ${
                index % 2 === 1 ? 'lg:direction-rtl' : ''
              }`}
            >
              {/* Content Side */}
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary">
                    {item.icon}
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
                      {item.audience}
                    </h2>
                  </div>
                </div>

                <p className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">
                  {item.tagline}
                </p>

                <p className="text-muted-foreground font-light leading-relaxed mb-8">
                  {item.description}
                </p>

                <ul className="space-y-4 mb-8">
                  {item.useCases.map((useCase, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-light leading-relaxed">
                        {useCase}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Highlight Card Side */}
              <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                <div className="bg-card/50 border border-border/50 rounded-2xl p-8 lg:p-10">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
                      {item.accentIcon}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {item.highlight.type === 'metric'
                        ? 'Key metric'
                        : 'From the community'}
                    </span>
                  </div>

                  {item.highlight.type === 'metric' ? (
                    <>
                      <div className="text-5xl md:text-6xl font-medium text-primary mb-3 tracking-tight">
                        {item.highlight.value}
                      </div>
                      <p className="text-muted-foreground font-light text-sm leading-relaxed">
                        {item.highlight.label}
                      </p>
                    </>
                  ) : (
                    <>
                      <blockquote className="text-lg font-light leading-relaxed mb-4 text-foreground/90">
                        &ldquo;{item.highlight.value}&rdquo;
                      </blockquote>
                      <p className="text-sm text-muted-foreground font-light">
                        -- {item.highlight.label}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-card/50 border border-border/50 rounded-2xl p-12 md:p-16 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-6">
              <DollarSign className="h-7 w-7" />
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">
              No matter your strategy, AIWholesail helps you find deals{' '}
              <span className="text-primary">faster</span>
            </h2>
            <p className="text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto mb-8">
              Start your 7-day free trial and see why thousands of real estate
              professionals trust AIWholesail to power their deal flow.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/pricing">
                <Button size="lg" className="h-12 px-8 text-base font-medium">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base font-medium"
                >
                  Talk to Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
