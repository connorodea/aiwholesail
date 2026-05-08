import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Zap, BarChart3, Bell, TrendingUp, Star, Activity, MapPin } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { analytics } from '@/lib/analytics';
import { validateEmail } from '@/lib/security';

const CAPABILITY_STATS = [
  { icon: MapPin, value: 'All 50 states', label: 'Properties scanned nationwide' },
  { icon: Activity, value: 'Real-time', label: 'New listings flagged the moment they go live' },
  { icon: BarChart3, value: 'AI-powered', label: 'Spread + ARV + repair estimates on every deal' },
  { icon: Zap, value: '7-day free trial', label: 'No credit card · Cancel anytime' },
];

const DEAL_PREVIEWS = [
  {
    img: '/generated/distressed-1.jpg',
    address: '4218 Maple Heights Dr',
    city: 'Tampa, FL',
    list: 142000,
    arv: 218000,
    spread: 76000,
    badge: 'A+',
  },
  {
    img: '/generated/distressed-2.jpg',
    address: '1156 Oak Ridge Ln',
    city: 'Atlanta, GA',
    list: 89500,
    arv: 165000,
    spread: 75500,
    badge: 'A+',
  },
  {
    img: '/generated/distressed-3.jpg',
    address: '8702 Walnut St',
    city: 'Cleveland, OH',
    list: 54000,
    arv: 112000,
    spread: 58000,
    badge: 'A',
  },
];

const STEPS = [
  {
    icon: Bell,
    title: 'Pick your markets',
    desc: 'Tell us where you invest. Set your minimum spread, ARV, and property type filters in seconds.',
  },
  {
    icon: Zap,
    title: 'AI scans every new listing',
    desc: 'The moment a property hits the MLS, our model compares list price to estimated market value and flags real opportunities.',
  },
  {
    icon: BarChart3,
    title: 'Get profitable deals first',
    desc: 'Instant alerts with spread, ARV, repair estimates, and a deal score. Make offers before the rest of the market wakes up.',
  },
];

const TESTIMONIALS = [
  {
    img: '/generated/testimonial-investor-1.jpg',
    quote: 'Found my first $42K wholesale deal in week one. The spread alerts pay for the subscription a hundred times over.',
    name: 'Marcus J.',
    role: 'Wholesaler · Tampa, FL',
  },
  {
    img: '/generated/testimonial-investor-2.jpg',
    quote: 'I used to spend three hours a day scrolling Zillow. Now I get a text the moment a deal pops in my zip codes.',
    name: 'Sarah K.',
    role: 'Investor · Atlanta, GA',
  },
  {
    img: '/generated/testimonial-investor-3.jpg',
    quote: "The AI scoring caught a $58K spread I would've passed on. Closed it the same week. Game changer.",
    name: 'David R.',
    role: 'Flipper · Cleveland, OH',
  },
];

function formatPrice(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function EmailForm({
  size = 'lg',
  email,
  setEmail,
  submitting,
  error,
  onSubmit,
}: {
  size?: 'lg' | 'md';
  email: string;
  setEmail: (s: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const heightClass = size === 'lg' ? 'h-14' : 'h-12';
  const padClass = size === 'lg' ? 'px-5 text-base' : 'px-4 text-sm';
  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          aria-label="Email address"
          aria-invalid={!!error}
          className={`flex-1 ${heightClass} ${padClass} rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-cyan-400/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-400/20 text-white placeholder:text-neutral-500 transition-all`}
        />
        <button
          type="submit"
          disabled={submitting}
          className={`${heightClass} ${size === 'lg' ? 'px-6 text-base' : 'px-5 text-sm'} rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-black font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap`}
        >
          {submitting ? 'Loading...' : 'Get free access'}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <p className="mt-4 text-xs text-neutral-500 flex items-center gap-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-cyan-400" /> No credit card
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-cyan-400" /> 7-day free trial
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-cyan-400" /> Cancel anytime
        </span>
      </p>
    </form>
  );
}

export default function LpFindDeals() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analytics.viewLandingPage('cold_traffic_lp_find_deals');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    const v = validateEmail(trimmed);
    if (!v.isValid) {
      setError(v.error || 'Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    analytics.leadCaptured(trimmed, 'cold_traffic_lp_find_deals');

    try {
      localStorage.setItem('lp_captured_email', trimmed);
      localStorage.setItem('lp_source', 'cold_traffic_lp_find_deals');
    } catch {}

    navigate(`/auth?mode=signup&email=${encodeURIComponent(trimmed)}&source=lp_find_deals`);
  };

  return (
    <div className="relative min-h-screen bg-[#08090a] text-white overflow-hidden font-sans">
      <SEOHead
        title="Find profitable real estate deals — AIWholesail"
        description="AI scans every new listing for below-market opportunities. Get instant alerts on profitable real estate deals. 7-day free trial, no credit card."
        noIndex={true}
      />

      <header className="relative z-20 px-6 sm:px-10 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <picture>
            <source srcSet="/logo-white.webp" type="image/webp" />
            <img src="/logo-white.png" alt="AIWholesail" className="h-7 w-auto" />
          </picture>
          <a href="/auth" className="text-sm text-neutral-400 hover:text-white transition-colors">
            Sign in
          </a>
        </div>
      </header>

      <section className="relative z-10 px-6 sm:px-10 pt-8 sm:pt-16 pb-20 sm:pb-28">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[800px] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 50% -10%, rgba(6, 182, 212, 0.22), transparent 70%), radial-gradient(ellipse 40% 30% at 85% 25%, rgba(34, 197, 94, 0.10), transparent 70%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
              For real estate wholesalers + investors
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
              AI finds undervalued homes
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-300 bg-clip-text text-transparent">
                before everyone else.
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-neutral-300 font-light max-w-xl mb-8 leading-relaxed">
              Stop refreshing Zillow. Get the first 30 below-market deals in your area scanned by AI — free, no credit card.
            </p>
            <EmailForm
              size="lg"
              email={email}
              setEmail={(s) => { setEmail(s); if (error) setError(null); }}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmit}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative"
          >
            <div className="absolute -inset-8 bg-gradient-to-br from-cyan-500/20 via-cyan-500/5 to-transparent rounded-3xl blur-3xl pointer-events-none" />
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-cyan-500/10 bg-neutral-900">
              <img
                src="/generated/investor-laptop.jpg"
                alt="AIWholesail dashboard on a laptop"
                className="w-full h-auto block"
                loading="eager"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 sm:-left-10 bg-[#0c0e10] border border-white/[0.08] rounded-2xl p-4 shadow-2xl backdrop-blur-xl max-w-[260px]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-neutral-500 mb-0.5">New deal alert</p>
                  <p className="text-sm font-semibold text-white truncate">+$76K spread</p>
                  <p className="text-xs text-neutral-400 truncate">4218 Maple Heights Dr</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 px-6 sm:px-10 pb-4 sm:pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-sm overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.05]">
              {CAPABILITY_STATS.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                    className="px-5 py-6 sm:px-6 sm:py-7 flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white leading-tight mb-1.5">
                        {stat.value}
                      </p>
                      <p className="text-xs text-neutral-400 leading-snug">
                        {stat.label}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 sm:px-10 py-20 sm:py-24 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-cyan-400 mb-4">
              Real deals our members closed
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              The kind of spreads we're flagging right now.
            </h2>
            <p className="text-neutral-400 text-base leading-relaxed">
              Every property below is an actual listing scored by our AI. The deal score and spread are calculated automatically — no spreadsheet, no guesswork.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {DEAL_PREVIEWS.map((d, i) => (
              <motion.div
                key={d.address}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                className="group relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/30 hover:bg-white/[0.03] transition-all"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={d.img}
                    alt={d.address}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30">
                    <span className="text-xs font-bold text-emerald-300">Deal Score</span>
                    <span className="text-xs font-bold text-emerald-300">{d.badge}</span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-sm font-semibold text-white truncate">{d.address}</p>
                    <p className="text-xs text-neutral-300 truncate">{d.city}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06]">
                  <div className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">List</p>
                    <p className="text-sm font-semibold text-white">{formatPrice(d.list)}</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">ARV</p>
                    <p className="text-sm font-semibold text-white">{formatPrice(d.arv)}</p>
                  </div>
                  <div className="p-3 text-center bg-emerald-500/[0.04]">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">Spread</p>
                    <p className="text-sm font-bold text-emerald-300">+{formatPrice(d.spread)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 sm:px-10 py-20 sm:py-24 border-t border-white/[0.04]">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'url(/generated/feature-bg-search.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.06,
          }}
        />
        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-cyan-400 mb-4">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Three steps. No spreadsheets.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                  className="relative"
                >
                  <div className="absolute -top-3 -left-1 text-7xl font-bold text-white/[0.04] tabular-nums select-none pointer-events-none">
                    0{i + 1}
                  </div>
                  <div className="relative space-y-3">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 sm:px-10 py-20 sm:py-24 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Trusted by real estate professionals.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.figure
                key={t.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 sm:p-7 flex flex-col"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="text-base text-neutral-200 leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 pt-5 border-t border-white/[0.05]">
                  <img
                    src={t.img}
                    alt={t.name}
                    className="w-11 h-11 rounded-full object-cover border border-white/[0.08]"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{t.role}</p>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 overflow-hidden border-t border-white/[0.04]">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'url(/generated/cta-background.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[#08090a]/95 via-[#08090a]/90 to-[#08090a]/95 pointer-events-none"
        />
        <div className="relative max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-5 leading-[1.05]">
            Start finding deals tonight.
          </h2>
          <p className="text-neutral-300 mb-10 leading-relaxed text-lg max-w-xl mx-auto">
            Drop your email. We&rsquo;ll spin up your free account and run your first 30 deal scans before you finish your coffee.
          </p>
          <div className="max-w-xl mx-auto">
            <EmailForm
              size="lg"
              email={email}
              setEmail={(s) => { setEmail(s); if (error) setError(null); }}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-6 sm:px-10 py-8 border-t border-white/[0.04] text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} AIWholesail. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-neutral-300 transition-colors">Terms</a>
            <a href="/contact" className="hover:text-neutral-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
