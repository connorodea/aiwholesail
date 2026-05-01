import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NavbarAIWholesail } from '@/components/ui/navbar-aiwholesail';
import { Container } from '@/components/proactiv/Container';
import { ArrowRight } from 'lucide-react';

const aiWholesailLogo = '/logo-white.png';

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="relative overflow-hidden bg-[#08090a] text-white min-h-screen">
      <NavbarAIWholesail />

      <main className="pt-14">
        {children}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="relative border-t border-white/[0.06] bg-[#060607]">
        {/* Top section — CTA banner */}
        <div className="border-b border-white/[0.06]">
          <Container>
            <div className="py-12 sm:py-16 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                  Ready to find your next deal?
                </h3>
                <p className="text-sm text-neutral-500 mt-1">
                  Start your 7-day free trial. No credit card required.
                </p>
              </div>
              <Link
                to="/auth?mode=signup"
                className="group flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold px-6 py-2.5 rounded-full transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-lg shadow-cyan-500/20"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Container>
        </div>

        {/* Main footer content */}
        <Container>
          <div className="py-12 sm:py-16">
            <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12">
              {/* Logo + description — spans 4 cols */}
              <div className="col-span-2 md:col-span-4 space-y-5">
                <Link to="/" className="inline-block">
                  <img src={aiWholesailLogo} alt="AIWholesail" className="h-8 sm:h-9 w-auto" />
                </Link>
                <p className="text-[13px] text-neutral-500 leading-relaxed max-w-xs">
                  AI-powered platform for real estate professionals to find, analyze, and close profitable deals.
                </p>
                <div className="flex items-center gap-4 pt-1">
                  {/* Social icons placeholder */}
                  {['X', 'Li', 'YT'].map(label => (
                    <span key={label} className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-neutral-500 hover:text-white hover:border-white/10 transition-colors cursor-pointer">
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Link columns */}
              {[
                {
                  title: 'Product',
                  links: [
                    { l: 'Features', t: '/how-it-works' },
                    { l: 'Use Cases', t: '/use-cases' },
                    { l: 'Pricing', t: '/pricing' },
                    { l: 'Calculators', t: '/tools' },
                    { l: 'AI Analysis', t: '/auth?mode=signup' },
                  ]
                },
                {
                  title: 'Resources',
                  links: [
                    { l: 'Blog', t: '/blog' },
                    { l: 'Guides', t: '/guides' },
                    { l: 'Markets', t: '/markets' },
                    { l: 'Glossary', t: '/glossary' },
                    { l: 'State Laws', t: '/laws' },
                  ]
                },
                {
                  title: 'Company',
                  links: [
                    { l: 'About', t: '/about' },
                    { l: 'FAQ', t: '/faq' },
                    { l: 'Contact', t: '/contact' },
                  ]
                },
                {
                  title: 'Legal',
                  links: [
                    { l: 'Privacy Policy', t: '/privacy' },
                    { l: 'Terms of Service', t: '/terms' },
                    { l: 'Refund Policy', t: '/refund' },
                  ]
                },
              ].map(section => (
                <div key={section.title} className="col-span-1 md:col-span-2">
                  <h4 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-400 mb-4">
                    {section.title}
                  </h4>
                  <ul className="space-y-2.5">
                    {section.links.map(link => (
                      <li key={link.l}>
                        <Link
                          to={link.t}
                          className="text-[13px] text-neutral-500 hover:text-white transition-colors"
                        >
                          {link.l}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06]">
          <Container>
            <div className="py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-[11px] text-neutral-600">
                &copy; {new Date().getFullYear()} AIWholesail. All rights reserved.
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] text-neutral-600">All systems operational</span>
              </div>
            </div>
          </Container>
        </div>
      </footer>
    </div>
  );
}
