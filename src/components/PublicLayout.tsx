import { useState, useEffect, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const aiWholesailLogo = '/logo-white.png';

const navLinks = [
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Use Cases', href: '/use-cases' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Tools', href: '/tools' },
  { label: 'Blog', href: '/blog' },
];

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#000] text-white">
      {/* Nav */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#000]/80 backdrop-blur-xl border-b border-white/5' : ''}`}>
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2">
              <img src={aiWholesailLogo} alt="AIWholesail" className="h-7 w-auto" />
              <span className="text-sm font-semibold tracking-tight">AIWholesail</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(link => (
                <Link key={link.label} to={link.href} className="text-[13px] text-white/50 hover:text-white transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {user ? (
                <Link to="/app">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg border-white/10 bg-white/5 text-white text-xs hover:bg-white/10">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="hidden sm:block text-[13px] text-white/50 hover:text-white transition-colors">Sign In</Link>
                  <Link to="/pricing">
                    <Button size="sm" className="h-8 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <button className="p-2 hover:bg-white/10 rounded-lg"><Menu className="h-4 w-4" /></button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 bg-[#0a0a0a] border-white/5 pt-10">
                  <nav className="flex flex-col gap-1">
                    {navLinks.map(link => (
                      <Link key={link.label} to={link.href} onClick={() => setMobileOpen(false)} className="px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg">{link.label}</Link>
                    ))}
                  </nav>
                  <div className="mt-6 pt-6 border-t border-white/5 space-y-2">
                    {!user && <Link to="/auth" onClick={() => setMobileOpen(false)}><Button variant="outline" className="w-full h-9 rounded-lg border-white/10 bg-white/5 text-white text-sm">Sign In</Button></Link>}
                    <Link to="/pricing" onClick={() => setMobileOpen(false)}><Button className="w-full h-9 rounded-lg bg-white text-black text-sm font-medium">Get Started</Button></Link>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-14">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-5 gap-10">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <img src={aiWholesailLogo} alt="AIWholesail" className="h-6 w-auto opacity-60" />
                <span className="text-sm font-semibold tracking-tight text-white/60">AIWholesail</span>
              </div>
              <p className="text-xs text-white/20 max-w-xs leading-relaxed">
                AI-powered platform for real estate professionals to find, analyze, and close profitable deals.
              </p>
            </div>
            <div>
              <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-white/30 mb-4">Product</h4>
              <ul className="space-y-2">
                {[{ l: 'How It Works', t: '/how-it-works' }, { l: 'Use Cases', t: '/use-cases' }, { l: 'Pricing', t: '/pricing' }, { l: 'Developers', t: '/developers' }].map(link => (
                  <li key={link.l}><Link to={link.t} className="text-xs text-white/20 hover:text-white/50 transition-colors">{link.l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-white/30 mb-4">Resources</h4>
              <ul className="space-y-2">
                {[{ l: 'Blog', t: '/blog' }, { l: 'Free Tools', t: '/tools' }, { l: 'Markets', t: '/markets' }, { l: 'About Us', t: '/about' }, { l: 'FAQ', t: '/faq' }, { l: 'Contact', t: '/contact' }].map(link => (
                  <li key={link.l}><Link to={link.t} className="text-xs text-white/20 hover:text-white/50 transition-colors">{link.l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-white/30 mb-4">Legal</h4>
              <ul className="space-y-2">
                {[{ l: 'Privacy Policy', t: '/privacy' }, { l: 'Terms of Service', t: '/terms' }, { l: 'Refund Policy', t: '/refund' }].map(link => (
                  <li key={link.l}><Link to={link.t} className="text-xs text-white/20 hover:text-white/50 transition-colors">{link.l}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-[11px] text-white/15">&copy; 2026 AIWholesail. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] text-white/15">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
