import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, Home, BookOpen, Calculator, MapPin, Search, FileText } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

const RECOVERY_LINKS = [
  { to: '/', label: 'Home', icon: Home, blurb: 'Find profitable real estate deals' },
  { to: '/tools', label: 'Free calculators', icon: Calculator, blurb: '14 investment tools — no signup' },
  { to: '/markets', label: 'Markets', icon: MapPin, blurb: 'Browse 50+ US metros' },
  { to: '/guides', label: 'Guides', icon: BookOpen, blurb: 'Wholesaling, BRRRR, flipping' },
  { to: '/blog', label: 'Blog', icon: FileText, blurb: 'Latest deal-finding tactics' },
  { to: '/auth?mode=signup', label: 'Start free trial', icon: ArrowRight, blurb: '7 days, no credit card' },
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
    // Push to dataLayer so the now-working GTM can surface 404 frequency in GA4.
    if (typeof window !== 'undefined' && Array.isArray((window as { dataLayer?: unknown[] }).dataLayer)) {
      (window as { dataLayer: Record<string, unknown>[] }).dataLayer.push({
        event: '404_page_view',
        page_path: location.pathname,
      });
    }
  }, [location.pathname]);

  return (
    <PublicLayout>
      <SEOHead
        title="Page Not Found"
        description="The page you're looking for moved or never existed. Browse AIWholesail's free tools, markets, guides, and AI deal-finder instead."
        noIndex={true}
        canonicalUrl="https://aiwholesail.com/404"
      />

      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden min-h-[60vh] flex items-center">
        <div className="relative container mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            404
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            That page doesn't exist
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              (or moved).
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light mb-2">
            You tried <code className="text-cyan-400 font-mono text-sm bg-cyan-500/10 px-2 py-0.5 rounded">{location.pathname}</code>.
          </p>
          <p className="text-sm md:text-base text-white/40 max-w-xl mx-auto leading-relaxed font-light">
            Try one of these instead, or use the navigation above to find what you need.
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RECOVERY_LINKS.map(({ to, label, icon: Icon, blurb }) => (
              <Link
                key={to}
                to={to}
                className="group border border-foreground/[0.06] bg-foreground/[0.02] rounded-xl p-6 hover:border-cyan-500/20 hover:bg-foreground/[0.04] transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-foreground mb-1 group-hover:text-cyan-400 transition-colors">
                      {label}
                    </h2>
                    <p className="text-sm text-muted-foreground font-light leading-relaxed">{blurb}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 border-t border-foreground/[0.06] pt-8 text-center">
            <p className="text-sm text-muted-foreground font-light mb-4">
              Or search for what you were looking for:
            </p>
            <form
              action="https://www.google.com/search"
              method="get"
              target="_blank"
              className="flex items-center justify-center gap-2 max-w-md mx-auto"
            >
              <input type="hidden" name="sitesearch" value="aiwholesail.com" />
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search aiwholesail.com"
                  aria-label="Search aiwholesail.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-foreground/[0.04] border border-foreground/[0.06] rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500/30"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold rounded-md transition-colors"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default NotFound;
