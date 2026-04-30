import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NavbarAIWholesail } from '@/components/ui/navbar-aiwholesail';
import { AmbientColor } from '@/components/proactiv/AmbientColor';
import { Container } from '@/components/proactiv/Container';

const aiWholesailLogo = '/logo-white.png';

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="relative overflow-hidden bg-[#08090a] text-white min-h-screen">
      {/* Navbar — same as homepage */}
      <NavbarAIWholesail />

      {/* Content */}
      <main className="pt-14">
        {children}
      </main>

      {/* Footer — same as homepage */}
      <footer className="border-t border-white/5 py-12 px-4 bg-[#08090a]">
        <Container>
          <div className="grid lg:grid-cols-5 gap-10">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <img src={aiWholesailLogo} alt="AIWholesail" className="h-9 w-auto opacity-60" />
              </div>
              <p className="text-xs text-neutral-600 max-w-xs leading-relaxed">
                AI-powered platform for real estate professionals to find, analyze, and close profitable deals.
              </p>
            </div>
            {[
              { title: 'Product', links: [{ l: 'Features', t: '/how-it-works' }, { l: 'Use Cases', t: '/use-cases' }, { l: 'Pricing', t: '/pricing' }, { l: 'Developers', t: '/developers' }] },
              { title: 'Resources', links: [{ l: 'Blog', t: '/blog' }, { l: 'Free Tools', t: '/tools' }, { l: 'Markets', t: '/markets' }, { l: 'About', t: '/about' }, { l: 'FAQ', t: '/faq' }, { l: 'Contact', t: '/contact' }] },
              { title: 'Legal', links: [{ l: 'Privacy Policy', t: '/privacy' }, { l: 'Terms of Service', t: '/terms' }, { l: 'Refund Policy', t: '/refund' }] },
            ].map(section => (
              <div key={section.title}>
                <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-neutral-500 mb-4">{section.title}</h4>
                <ul className="space-y-2">
                  {section.links.map(link => (
                    <li key={link.l}><Link to={link.t} className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors">{link.l}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-[11px] text-neutral-700">&copy; 2026 AIWholesail. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] text-neutral-700">All systems operational</span>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
}
