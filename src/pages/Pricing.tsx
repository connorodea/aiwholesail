import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { analytics } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, ArrowRight, Shield, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { stripe } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';

const plans = [
  {
    name: 'Pro',
    price: 29,
    priceId: 'price_1QjrSuCwWnuOPtC4Bfwu6IEs',
    description: 'Perfect for individual investors',
    features: [
      'Up to 5 alert locations',
      'Automated updates every 24 hours',
      'Advanced property matching',
      'Email notifications',
      'Basic market analytics',
      '7-day free trial included'
    ],
    popular: true
  },
  {
    name: 'Elite',
    price: 99,
    priceId: 'price_1QjrTKCwWnuOPtC4xIzkUCeY',
    description: 'For serious real estate professionals',
    features: [
      'Unlimited alert locations',
      'Real-time updates every 4 hours',
      'Advanced AI property analysis',
      'Priority email notifications',
      'Comprehensive market insights',
      'Skip tracing integration',
      'Lead scoring analytics',
      '7-day free trial included'
    ]
  }
];

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  // Respect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Hero stagger: fade-up on load
  const heroFadeUp = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 8 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { duration: 1, ease: [0.25, 0.1, 0.25, 1] as const, delay },
        };

  // Scroll-triggered fade-in for sections below the fold
  const sectionFadeIn = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0 } as const,
        whileInView: { opacity: 1 } as const,
        viewport: { once: true, margin: "-50px" },
        transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const },
      };

  // Staggered card animation
  const cardFadeIn = (index: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0 } as const,
          whileInView: { opacity: 1 } as const,
          viewport: { once: true, margin: "-50px" },
          transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const, delay: index * 0.06 },
        };

  const handleSelectPlan = async (plan: typeof plans[0]) => {
    // Track checkout intent
    analytics.beginCheckout(plan.name, plan.price);
    localStorage.setItem('selectedPlan', JSON.stringify(plan));

    if (!user) {
      // Not logged in -> send to signup with plan context
      window.location.href = `/auth?mode=signup&plan=${plan.name}`;
      return;
    }

    // Already logged in -> go to Stripe checkout
    setLoading(plan.priceId);
    try {
      const response = await stripe.createCheckout(plan.name, false);

      if (response.error) {
        throw new Error(response.error);
      }

      if ((response.data as any)?.url) {
        window.location.href = (response.data as any).url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error(error.message || 'Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <PublicLayout>
      <SEOHead
        title="Pricing Plans"
        description="Choose the perfect AIWholesail plan for your real estate business. Start with a 7-day free trial. Pro at $29/month or Elite at $99/month."
        noIndex={false}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <motion.p {...heroFadeUp(0)} className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">PRICING</motion.p>
          <motion.h1 {...heroFadeUp(0.1)} className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Simple, Transparent
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Pricing.
            </span>
          </motion.h1>
          <motion.p {...heroFadeUp(0.2)} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Start free for 7 days. No credit card required. Pick the plan that fits your business and upgrade when you are ready.
          </motion.p>
        </div>
      </section>

      {/* ===== PLAN CARDS -- LIGHT ===== */}
      <motion.section className="py-24 px-4" {...sectionFadeIn}>
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4 text-center">Choose Your Plan</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-center mb-4">
            Invest in your deal flow.
          </h2>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto text-center mb-16">
            Both plans include full access to AI-powered property analysis, market search, and deal alerts. Choose the scale that matches your business.
          </p>

          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                {...cardFadeIn(index)}
                className={`relative bg-white/[0.03] border rounded-xl p-5 sm:p-8 md:p-10 flex flex-col justify-between group hover:border-cyan-500/20 transition-all duration-300 ${
                  plan.popular
                    ? 'border-2 border-primary/30 shadow-lg shadow-primary/5'
                    : 'border-white/[0.06]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-8">
                    <Badge className="bg-cyan-500 text-black text-xs px-3 py-1">
                      <Star className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold tracking-tight mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-5xl font-bold tracking-tight">${plan.price}</span>
                    <span className="text-lg font-normal text-neutral-400">/month</span>
                  </div>
                  <p className="text-neutral-400 font-light mb-8">{plan.description}</p>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm font-light">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <Button
                    className={`w-full h-12 text-base font-semibold rounded-full gap-2 ${
                      plan.popular
                        ? 'bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25'
                        : ''
                    }`}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loading === plan.priceId}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {loading === plan.priceId
                      ? 'Loading...'
                      : `Start Free Trial`}
                    {loading !== plan.priceId && <ArrowRight className="h-4 w-4" />}
                  </Button>
                  <p className="text-xs text-neutral-400 font-light mt-3 text-center">
                    No credit card required
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            {user ? (
              <p className="text-sm text-neutral-400">
                <Link to="/app" className="text-cyan-400 hover:underline">Go to Dashboard</Link>
              </p>
            ) : (
              <p className="text-sm text-neutral-400">
                Already have an account? <Link to="/auth" className="text-cyan-400 hover:underline">Sign in here</Link>
              </p>
            )}
          </div>
        </div>
      </motion.section>

      {/* ===== WHAT'S INCLUDED -- DARK ===== */}
      <motion.section className="bg-[#0a0a0a] text-white py-24 px-4" {...sectionFadeIn}>
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4 text-center">Every Plan Includes</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-12">
            Everything you need to close more deals.
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              { label: 'AI Deal Scoring', desc: 'Every property scored so you focus on the best opportunities first.' },
              { label: 'Market Search', desc: 'Search any market by city, zip code, or address and see results instantly.' },
              { label: 'Property Analysis', desc: 'Full investment breakdown including estimated value, comparable sales, and profit potential.' },
              { label: 'Custom Alerts', desc: 'Get notified the moment a high-profit deal hits the market in your area.' },
              { label: 'Deal Pipeline', desc: 'Track every deal from first contact to closing in one organized view.' },
              { label: 'Data Export', desc: 'Export your leads, saved properties, and contact data anytime you need it.' },
            ].map((item, index) => (
              <motion.div key={item.label} {...cardFadeIn(index)} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 hover:bg-white/10 transition-colors">
                <CheckCircle className="h-5 w-5 text-cyan-400 mb-3" />
                <h4 className="font-semibold text-sm mb-1">{item.label}</h4>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Fade dark to white */}
      <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-[#08090a]" />

      {/* ===== CTA -- LIGHT ===== */}
      <motion.section className="py-24 px-4" {...sectionFadeIn}>
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
            Ready to find your next deal?
          </h2>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto mb-10">
            Join thousands of investors using AIWholesail to uncover profitable opportunities faster than ever before.
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="rounded-full px-10 text-base font-semibold bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 gap-2">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-cyan-400" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Cancel Anytime</span>
          </div>
        </div>
      </motion.section>
    </PublicLayout>
  );
}
