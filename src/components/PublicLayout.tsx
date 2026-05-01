import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NavbarAIWholesail } from '@/components/ui/navbar-aiwholesail';
import { Container } from '@/components/proactiv/Container';
import { ArrowRight } from 'lucide-react';

const aiWholesailLogoWebP = '/logo-white.webp';
const aiWholesailLogoPNG = '/logo-white.png';

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
                  <picture>
                    <source srcSet="/logo-white.webp" type="image/webp" />
                    <img src="/logo-white.png" alt="AIWholesail" className="h-12 sm:h-14 w-auto" width="77" height="56" loading="lazy" />
                  </picture>
                </Link>
                <p className="text-[13px] text-neutral-500 leading-relaxed max-w-xs">
                  AI-powered platform for real estate professionals to find, analyze, and close profitable deals.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-white/10 transition-colors" aria-label="X (Twitter)">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-white/10 transition-colors" aria-label="LinkedIn">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                  <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-white/10 transition-colors" aria-label="YouTube">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </a>
                  <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-white/10 transition-colors" aria-label="Instagram">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  </a>
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
              <p className="text-[11px] text-neutral-500">
                &copy; {new Date().getFullYear()} AIWholesail. All rights reserved.
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] text-neutral-500">All systems operational</span>
              </div>
            </div>
          </Container>
        </div>
      </footer>
    </div>
  );
}
