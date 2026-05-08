import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { analytics } from '@/lib/analytics';
import { validateEmail } from '@/lib/security';

const HEADLINE = 'AI finds undervalued homes the moment they hit the market.';
const SUBHEAD = 'Stop refreshing Zillow. Get the first 30 below-market deals scanned in your area — free, no credit card.';

const BULLETS = [
  { icon: Zap, title: 'Instant deal scanning', desc: 'Every new listing checked against AI-estimated market value within minutes of going live.' },
  { icon: BarChart3, title: 'Profit math, done', desc: 'See spread, ARV, and rehab estimates on every property — before you make an offer.' },
  { icon: ShieldCheck, title: '7-day free trial', desc: 'Full access to alerts, AI analysis, and deal scoring. Cancel anytime, no card upfront.' },
];

const SOCIAL_LOGOS = [
  { src: '/logos/biggerpockets.png', alt: 'BiggerPockets' },
  { src: '/logos/forbes-white.png', alt: 'Forbes' },
  { src: '/logos/disruptors-white.png', alt: 'Disruptors' },
  { src: '/logos/investor-fuel.png', alt: 'Investor Fuel' },
  { src: '/logos/rei-ink-white.png', alt: 'REI Ink' },
];

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

      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[640px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(6, 182, 212, 0.18), transparent 70%), radial-gradient(ellipse 50% 30% at 80% 20%, rgba(34, 197, 94, 0.10), transparent 70%)',
        }}
      />

      <header className="relative z-10 px-6 sm:px-10 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <picture>
              <source srcSet="/logo-white.webp" type="image/webp" />
              <img src="/logo-white.png" alt="AIWholesail" className="h-7 w-auto" />
            </picture>
          </div>
          <a
            href="/auth"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Sign in
          </a>
        </div>
      </header>

      <main className="relative z-10">
        <section className="px-6 sm:px-10 pt-12 sm:pt-20 pb-16 sm:pb-24">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
                For real estate wholesalers + investors
              </p>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
                {HEADLINE.split(' — ')[0]}
                <br />
                <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-300 bg-clip-text text-transparent">
                  before everyone else.
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-neutral-300 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
                {SUBHEAD}
              </p>
            </motion.div>

            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="max-w-xl mx-auto"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                  disabled={submitting}
                  aria-label="Email address"
                  aria-invalid={!!error}
                  className="flex-1 h-14 px-5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-cyan-400/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-400/20 text-white placeholder:text-neutral-500 transition-all text-base"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-14 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-black font-semibold text-base inline-flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
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
              <p className="mt-4 text-xs text-neutral-500 flex items-center justify-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-cyan-400" /> No credit card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-cyan-400" /> 7-day free trial
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-cyan-400" /> Cancel anytime
                </span>
              </p>
            </motion.form>
          </div>
        </section>

        <section className="px-6 sm:px-10 pb-16">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-neutral-500 text-center mb-8">
              As featured in
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-70">
              {SOCIAL_LOGOS.map((logo) => (
                <img
                  key={logo.alt}
                  src={logo.src}
                  alt={logo.alt}
                  className="h-6 sm:h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 sm:px-10 py-16 sm:py-20 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
              {BULLETS.map((b, i) => {
                const Icon = b.icon;
                return (
                  <motion.div
                    key={b.title}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                    className="space-y-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <h3 className="text-base font-semibold tracking-tight">{b.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{b.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-6 sm:px-10 py-16 sm:py-20 border-t border-white/[0.04]">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-xl sm:text-2xl font-light tracking-tight leading-relaxed text-neutral-200">
              &ldquo;Found my first $42K wholesale deal in week one. The spread alerts pay for the subscription a hundred times over.&rdquo;
            </blockquote>
            <p className="mt-6 text-sm text-neutral-500">
              Marcus J. — Real estate wholesaler, Tampa FL
            </p>
          </div>
        </section>

        <section className="px-6 sm:px-10 py-16 sm:py-24 border-t border-white/[0.04]">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Start finding deals tonight.
            </h2>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              Drop your email. We&rsquo;ll set up your free account and run your first 30 deal scans.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                disabled={submitting}
                aria-label="Email address"
                className="flex-1 h-12 px-4 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 text-white placeholder:text-neutral-500 transition-all text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="h-12 px-5 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-black font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap disabled:opacity-60"
              >
                {submitting ? 'Loading...' : 'Get free access'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-6 sm:px-10 py-8 border-t border-white/[0.04] text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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
