import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Brain,
  SlidersHorizontal,
  LineChart,
  Phone,
  FileSignature,
  Sparkles,
  CheckCircle,
  Shield,
  Cpu,
  Database,
  Activity,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Search Any Market',
    description:
      'Enter a city, zip code, county, or full address. Our engine pulls live data from Zillow listings, FSBO sources, and off-market databases to give you a comprehensive view of every available opportunity in that market.',
    highlight: {
      label: 'Multi-source aggregation',
      detail:
        'Zillow, FSBO listings, county records, and proprietary off-market feeds — combined into one search.',
    },
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI Analyzes Every Property',
    description:
      'Each result is instantly scored by our AI. It compares the listing price against the Zestimate and recent comparable sales, calculates the spread, estimates repair costs, and assigns a deal score from 0 to 100 so you can see profitability at a glance.',
    highlight: {
      label: 'Automated deal scoring',
      detail:
        'Zestimate comparison, ARV calculation, spread analysis, and a composite deal score — all in under 2 seconds per property.',
    },
  },
  {
    number: '03',
    icon: SlidersHorizontal,
    title: 'Filter & Sort by Profit',
    description:
      'Narrow your results with advanced filters. Sort by spread size to surface the biggest opportunities first. Filter for FSBO-only to avoid agent commissions. Set price floors and ceilings, property types, and minimum deal scores.',
    highlight: {
      label: 'Precision filtering',
      detail:
        'FSBO toggle, price range sliders, property type selectors, minimum spread thresholds, and deal-score cutoffs.',
    },
  },
  {
    number: '04',
    icon: LineChart,
    title: 'Deep-Dive Analysis',
    description:
      'Click into any property to unlock a full AI-powered breakdown. Get a detailed repair cost estimate, after-repair value projection, comparable sales within a half-mile radius, neighborhood trends, and a recommended maximum offer price.',
    highlight: {
      label: 'AI property analyzer',
      detail:
        'Repair estimates, ARV projections, comparable sales map, rental yield analysis, and recommended offer price.',
    },
  },
  {
    number: '05',
    icon: Phone,
    title: 'Contact & Track',
    description:
      'Found a deal worth pursuing? Use built-in skip tracing to find the owner\'s phone number and email. Add the property to your deal pipeline kanban board, set follow-up reminders, and create automated outreach sequences to stay on top of every lead.',
    highlight: {
      label: 'Integrated skip tracing',
      detail:
        'Owner contact lookup, deal pipeline kanban, follow-up scheduling, and multi-step outreach sequences.',
    },
  },
  {
    number: '06',
    icon: FileSignature,
    title: 'Close the Deal',
    description:
      'When you are ready to lock in a deal, generate a purchase agreement or assignment contract directly from the platform. Match the property to buyers in your network, coordinate the closing timeline, and track the deal through to funding.',
    highlight: {
      label: 'End-to-end closing tools',
      detail:
        'Contract generator, buyer matching, assignment tracking, and closing timeline management.',
    },
  },
];

const techFeatures = [
  {
    icon: Cpu,
    title: 'AI-Powered Analysis',
    description:
      'Advanced language models from Claude and OpenAI evaluate every property, generating human-readable insights alongside hard numbers.',
  },
  {
    icon: Database,
    title: 'Real-Time Data',
    description:
      'Live connections to Zillow, public records, and off-market feeds ensure you are always working with the most current information available.',
  },
  {
    icon: Activity,
    title: 'Automated Deal Scoring',
    description:
      'Our scoring algorithm weighs spread, ARV confidence, days on market, seller motivation signals, and comparable sales to rank every property.',
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title="How It Works"
        description="Learn how AIWholesail helps you find profitable real estate deals in 6 simple steps. From market search to closing, powered by AI analysis and real-time data."
        keywords="how AIWholesail works, real estate deal finding steps, AI property analysis process, wholesale real estate workflow, automated deal scoring"
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
              <div className="text-lg font-semibold">How It Works</div>
              <div className="w-20" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="space-y-6">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight leading-tight">
              How <span className="text-primary">AIWholesail</span> Works
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed max-w-3xl mx-auto">
              From search to close in minutes, not days. Six straightforward
              steps between you and your next profitable deal.
            </p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="space-y-20">
            {steps.map((step, index) => {
              const isReversed = index % 2 !== 0;

              return (
                <div
                  key={step.number}
                  className={`flex flex-col ${
                    isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'
                  } gap-10 lg:gap-16 items-center`}
                >
                  {/* Text side */}
                  <div className="flex-1 space-y-5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                        Step {step.number}
                      </span>
                      <div className="h-px flex-1 bg-border/50" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-medium tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground font-light leading-relaxed">
                      {step.description}
                    </p>

                    {/* Highlight box */}
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 space-y-1.5">
                      <p className="text-sm font-medium text-primary">
                        {step.highlight.label}
                      </p>
                      <p className="text-sm text-muted-foreground font-light leading-relaxed">
                        {step.highlight.detail}
                      </p>
                    </div>
                  </div>

                  {/* Icon side */}
                  <div className="flex-shrink-0">
                    <div className="w-40 h-40 md:w-48 md:h-48 rounded-3xl bg-card border border-border/50 shadow-lg flex flex-col items-center justify-center gap-4 hover:shadow-xl hover:border-primary/20 transition-all duration-300">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <step.icon className="h-7 w-7 text-primary" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                          Step
                        </div>
                        <div className="text-3xl font-medium text-primary">
                          {step.number}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Powered by AI */}
      <section className="py-24 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 space-y-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary tracking-wide uppercase">
                Technology
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              Powered by <span className="text-primary">AI</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              Behind every deal score and property analysis is a stack of
              advanced AI and real-time data infrastructure built for speed and
              accuracy.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {techFeatures.map((feature) => (
              <Card
                key={feature.title}
                className="group bg-card/50 border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 rounded-2xl"
              >
                <CardContent className="pt-8 pb-8 px-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-light">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <div className="space-y-8">
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-tight">
              Ready to find your{' '}
              <span className="block text-primary">next deal?</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto">
              See it in action. Start your free trial and search your first
              market in under two minutes.
            </p>
            <div className="pt-4">
              <Link to="/pricing">
                <Button
                  size="lg"
                  className="text-base font-medium px-8 py-3 rounded-full gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span className="font-light">7-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="font-light">Credit Card Required</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
