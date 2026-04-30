import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  Code2,
  Zap,
  Search,
  Brain,
  Users,
  FileText,
  Bell,
  Shield,
  Clock,
  Copy,
  Check,
  Terminal,
  Braces,
  BarChart3,
  Lock,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const apiCapabilities = [
  {
    icon: Search,
    title: 'Property Search',
    description:
      'Search millions of on- and off-market properties across all 50 states with powerful filtering by price, location, property type, and distress signals.',
  },
  {
    icon: Brain,
    title: 'AI Deal Scoring',
    description:
      'Get instant deal scores powered by machine-learning models trained on thousands of successful wholesale transactions and comparable sales.',
  },
  {
    icon: BarChart3,
    title: 'Market Analysis',
    description:
      'Access real-time market trends, median prices, days-on-market, and neighborhood-level analytics to evaluate any market in seconds.',
  },
  {
    icon: Users,
    title: 'Buyer Matching',
    description:
      'Match properties to your buyer list automatically based on criteria, budget, location preferences, and historical purchase patterns.',
  },
];

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  icon: typeof Search;
}

const endpoints: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/property/zillow/search',
    description: 'Search properties by location, price range, property type, and dozens of additional filters.',
    icon: Search,
  },
  {
    method: 'POST',
    path: '/api/ai/property-analysis',
    description: 'Run a full AI-powered analysis on any property including ARV, repair estimates, and deal score.',
    icon: Brain,
  },
  {
    method: 'POST',
    path: '/api/ai/lead-scoring',
    description: 'Score seller leads based on motivation signals, equity position, and market conditions.',
    icon: Zap,
  },
  {
    method: 'GET',
    path: '/api/buyers/match',
    description: 'Find the best-matched buyers for a given property based on criteria and purchase history.',
    icon: Users,
  },
  {
    method: 'POST',
    path: '/api/contracts/generate',
    description: 'Generate state-compliant wholesale contracts with all required disclosures pre-filled.',
    icon: FileText,
  },
  {
    method: 'GET',
    path: '/api/alerts',
    description: 'Retrieve triggered property alerts matching your saved search criteria and thresholds.',
    icon: Bell,
  },
];

const rateLimits = [
  {
    plan: 'Pro',
    price: '$29/mo',
    limit: '30 req/min',
    highlight: false,
    features: ['Property search', 'Basic analytics', 'Email support'],
  },
  {
    plan: 'Elite',
    price: '$99/mo',
    limit: '300 req/min',
    highlight: false,
    features: ['Everything in Pro', 'AI analysis', 'Lead scoring', 'Priority support'],
  },
  {
    plan: 'API',
    price: '$199/mo',
    limit: '1,000 req/min',
    highlight: true,
    features: [
      'Full API access',
      'All endpoints',
      'Webhook callbacks',
      'Dedicated support',
      'Custom integrations',
    ],
  },
];

const curlExample = `curl -X POST https://api.aiwholesail.com/api/ai/property-analysis \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "742 Evergreen Terrace, Springfield, IL",
    "include_comps": true,
    "include_repair_estimate": true
  }'`;

const jsExample = `const response = await fetch(
  "https://api.aiwholesail.com/api/ai/property-analysis",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer YOUR_API_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: "742 Evergreen Terrace, Springfield, IL",
      include_comps: true,
      include_repair_estimate: true,
    }),
  }
);

const data = await response.json();
console.log(data.deal_score);   // 87
console.log(data.arv);          // 285000
console.log(data.repair_cost);  // 32000`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase font-mono ${
        method === 'GET'
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
      }`}
    >
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] transition-all duration-150 text-neutral-500 hover:text-neutral-300"
      aria-label="Copy code to clipboard"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Developers() {
  const [activeTab, setActiveTab] = useState<'curl' | 'javascript'>('curl');

  return (
    <PublicLayout>
      <SEOHead
        title="API for Developers"
        description="Integrate AI-powered real estate deal analysis into your applications with the AIWholesail API. Property search, deal scoring, market analysis, and buyer matching."
        keywords="real estate API, property analysis API, deal scoring API, wholesale real estate developer tools, real estate data API, AI property analysis"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-4xl px-4 pt-28 pb-20 text-center">
          <Badge className="mb-6 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-sm px-4 py-1.5 rounded-full">
            <Terminal className="h-3.5 w-3.5 mr-1.5" />
            REST API
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-white mb-6">
            AIWholesail{' '}
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              API
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Integrate AI-powered deal analysis, property search, and market intelligence
            directly into your applications.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/contact">
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
                Get API Access
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>

            <Badge
              variant="outline"
              className="text-base px-5 py-2 border-white/[0.08] text-neutral-300 bg-neutral-900/50"
            >
              Starting at $199/month
            </Badge>
          </div>
        </div>
      </section>

      {/* ===== API OVERVIEW ===== */}
      <section className="py-20 md:py-28 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">What You Get</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              Powerful Real Estate Intelligence
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              Everything you need to build real estate applications, automate deal flow,
              or power your investment platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {apiCapabilities.map((cap) => (
              <div
                key={cap.title}
                className="group border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start gap-5">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/15 transition-colors">
                    <cap.icon className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">{cap.title}</h3>
                    <p className="text-neutral-400 text-[15px] leading-relaxed">
                      {cap.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ENDPOINTS ===== */}
      <section className="py-20 md:py-28 px-4 bg-[#0a0a0a]">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-white/10 text-neutral-300 border border-white/[0.08] text-xs uppercase tracking-wider">
              <Braces className="h-3.5 w-3.5 mr-1.5" />
              Endpoints
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              API Reference
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              Clean, RESTful endpoints for every step of the wholesale deal pipeline.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {endpoints.map((ep) => (
              <div
                key={ep.path}
                className="group border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-white/[0.1] transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <MethodBadge method={ep.method} />
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <ep.icon className="h-4 w-4 text-neutral-400 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </div>

                <code className="block text-sm font-mono text-neutral-200 mb-3 break-all leading-relaxed">
                  {ep.path}
                </code>

                <p className="text-sm text-neutral-500 leading-relaxed">
                  {ep.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CODE EXAMPLES ===== */}
      <section className="py-20 md:py-28 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Quick Start</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              Up and Running in Minutes
            </h2>
            <p className="text-neutral-400 text-lg max-w-xl mx-auto">
              Simple, well-documented endpoints. Here is a property analysis request.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 mb-4 bg-neutral-900/50 border border-white/[0.08] rounded-md p-1 w-fit mx-auto">
            <button
              onClick={() => setActiveTab('curl')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === 'curl'
                  ? 'bg-white/[0.06] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Terminal className="h-4 w-4" />
              cURL
            </button>
            <button
              onClick={() => setActiveTab('javascript')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === 'javascript'
                  ? 'bg-white/[0.06] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Braces className="h-4 w-4" />
              JavaScript
            </button>
          </div>

          {/* Code block */}
          <div className="relative rounded-xl border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent overflow-hidden">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <span className="ml-3 text-xs text-neutral-500 font-mono">
                {activeTab === 'curl' ? 'terminal' : 'index.js'}
              </span>
            </div>

            {/* Code content */}
            <div className="relative p-5 overflow-x-auto">
              <CopyButton text={activeTab === 'curl' ? curlExample : jsExample} />
              <pre className="text-sm font-mono leading-relaxed text-neutral-300 pr-12">
                <code>{activeTab === 'curl' ? curlExample : jsExample}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RATE LIMITS ===== */}
      <section className="py-20 md:py-28 px-4 bg-[#0a0a0a]">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-white/10 text-neutral-300 border border-white/[0.08] text-xs uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Rate Limits
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              Built to Scale With You
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              Generous rate limits on every plan. Need more? We can customize.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {rateLimits.map((tier) => (
              <div
                key={tier.plan}
                className={`relative rounded-xl p-8 transition-all duration-300 ${
                  tier.highlight
                    ? 'bg-cyan-500/10 border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                    : 'border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent hover:border-white/[0.1]'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-cyan-500 text-black shadow-lg shadow-cyan-500/25 text-xs font-semibold">
                      Full API Access
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">{tier.plan}</h3>
                  <div className="text-3xl font-bold tracking-tight text-white mb-1">
                    {tier.price}
                  </div>
                  <div className="text-neutral-400 text-sm">{tier.limit}</div>
                </div>

                <div className="h-px bg-white/[0.06] mb-6" />

                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-neutral-300">
                      <Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 md:py-28 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 mb-6">
              <Lock className="h-8 w-8 text-cyan-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              Ready to Build?
            </h2>
            <p className="text-neutral-400 text-lg max-w-xl mx-auto leading-relaxed">
              API access starts at <strong className="text-white">$199/month</strong> with
              1,000 requests per minute. Contact us to get your API key and full documentation.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/contact">
              <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
                Get API Access
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link to="/pricing">
              <button className="inline-flex items-center gap-2 px-8 py-4 border border-white/[0.08] rounded-md text-base text-white hover:bg-white/[0.04] transition-colors">
                View All Plans
              </button>
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-cyan-400" />
              SSL Encrypted
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-cyan-400" />
              99.9% Uptime
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-cyan-400" />
              Avg 120ms Response
            </span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
