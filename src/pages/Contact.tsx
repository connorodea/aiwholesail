import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Phone, MapPin, Send, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { contact } from '@/lib/api-client';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await contact.submit(formData);

      if (response.error) {
        toast.error(response.error);
        return;
      }

      toast.success(response.data?.message || 'Message sent successfully! We\'ll get back to you within 24 hours.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to send message. Please try again or email us directly.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <PublicLayout>
      <SEOHead
        title="Contact Us"
        description="Get in touch with the AIWholesail support team. We're here to help with questions about our real estate investing platform."
        noIndex={false}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <motion.p {...heroFadeUp(0)} className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">CONTACT</motion.p>
          <motion.h1 {...heroFadeUp(0.1)} className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Get In
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Touch.
            </span>
          </motion.h1>
          <motion.p {...heroFadeUp(0.2)} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Have questions about AIWholesail? Our team is ready to help you
            get started and make the most of the platform.
          </motion.p>
        </div>
      </section>

      {/* ===== CONTACT FORM + INFO — LIGHT ===== */}
      <motion.section className="py-24 px-4 bg-[#08090a]" {...sectionFadeIn}>
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact Form */}
            <motion.div {...cardFadeIn(0)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 sm:p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Send className="h-5 w-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Send us a message</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                      className="h-11 bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                      className="h-11 bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="What's this about?"
                    required
                    className="h-11 bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm font-medium">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us how we can help..."
                    rows={6}
                    required
                    className="bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 font-semibold text-base gap-2"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      Sending...
                    </div>
                  ) : (
                    <>
                      Send Message
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>

            {/* Contact Information */}
            <div className="space-y-4">
              <motion.div {...cardFadeIn(1)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">Email Support</h3>
                </div>
                <p className="text-neutral-400 font-light mb-3">
                  Get help with your account, billing, or any questions.
                </p>
                <a href="mailto:support@aiwholesail.com" className="text-cyan-400 hover:text-cyan-400/80 font-medium transition-colors">
                  support@aiwholesail.com
                </a>
                <p className="text-sm text-neutral-400 font-light mt-2">
                  Response time: Within 24 hours
                </p>
              </motion.div>

              <motion.div {...cardFadeIn(2)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">Sales Inquiries</h3>
                </div>
                <p className="text-neutral-400 font-light mb-3">
                  Questions about pricing, features, or enterprise solutions?
                </p>
                <a href="mailto:sales@aiwholesail.com" className="text-cyan-400 hover:text-cyan-400/80 font-medium transition-colors">
                  sales@aiwholesail.com
                </a>
                <p className="text-sm text-neutral-400 font-light mt-2">
                  Response time: Within 4 hours (business days)
                </p>
              </motion.div>

              <motion.div {...cardFadeIn(3)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">Business Hours</h3>
                </div>
                <div className="space-y-1.5 text-neutral-400 font-light">
                  <p>Monday - Friday: 9:00 AM - 6:00 PM EST</p>
                  <p>Saturday: 10:00 AM - 4:00 PM EST</p>
                  <p>Sunday: Closed</p>
                </div>
                <p className="text-sm text-neutral-400 font-light mt-3">
                  Emergency support available 24/7 for critical issues
                </p>
              </motion.div>

              <motion.div {...cardFadeIn(4)} className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5 sm:p-8 text-center">
                <h3 className="text-lg font-bold tracking-tight mb-2">Need quick answers?</h3>
                <p className="text-neutral-400 font-light mb-5">
                  Check our FAQ section for common questions and instant solutions.
                </p>
                <Link to="/faq">
                  <Button variant="outline" className="rounded-full px-6 border-primary/30 hover:bg-cyan-500/10 font-medium">
                    Visit FAQ Section
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.section>
    </PublicLayout>
  );
}
