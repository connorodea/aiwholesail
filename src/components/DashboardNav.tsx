import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  IconMenu2,
  IconX,
  IconChevronDown,
  IconSearch,
  IconBrain,
  IconLayoutKanban,
  IconUsers,
  IconRepeat,
  IconFileText,
  IconHeart,
  IconBell,
  IconCreditCard,
  IconLogout,
  IconUser,
  IconClock,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useFavorites } from '@/hooks/useFavorites';
import { stripe } from '@/lib/api-client';
import { toast } from 'sonner';

const aiWholesailLogo = '/logo-white.png';

const navItems = [
  { href: '/app', label: 'Search', icon: IconSearch },
  { href: '/app/analyzer', label: 'Analyzer', icon: IconBrain },
  { href: '/app/pipeline', label: 'Pipeline', icon: IconLayoutKanban },
  { href: '/app/buyers', label: 'Buyers', icon: IconUsers },
  { href: '/app/sequences', label: 'Sequences', icon: IconRepeat },
  { href: '/app/contracts', label: 'Contracts', icon: IconFileText },
  { href: '/app/favorites', label: 'Favorites', icon: IconHeart },
  { href: '/app/alerts', label: 'Alerts', icon: IconBell },
];

export function DashboardNav() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isTrialActive, trialDaysRemaining } = useSubscription();
  const { favorites } = useFavorites();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [lightMode, setLightMode] = useState(() => document.documentElement.classList.contains('light'));

  const toggleTheme = () => {
    const next = !lightMode;
    setLightMode(next);
    document.documentElement.classList.toggle('light', next);
    localStorage.setItem('aiwholesail-theme', next ? 'light' : 'dark');
  };

  useEffect(() => {
    const saved = localStorage.getItem('aiwholesail-theme');
    if (saved === 'light') {
      setLightMode(true);
      document.documentElement.classList.add('light');
    }
  }, []);

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await stripe.createPortal();
      if (response.error) throw new Error(response.error);
      window.open((response.data as any)?.url, '_blank');
    } catch {
      toast.error('Failed to open subscription portal');
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Main bar */}
      <div
        className="bg-neutral-950/90 backdrop-blur-xl border-b border-white/[0.06]"
        style={{ boxShadow: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 4px 20px rgba(0,0,0,0.4)' }}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/app" className="flex items-center gap-2 shrink-0">
              <img src={aiWholesailLogo} alt="AIWholesail" className="h-20 w-auto object-contain" />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 ${
                      isActive
                        ? 'bg-white/[0.08] text-white shadow-[0px_1px_0px_0px_rgba(255,255,255,0.06)_inset]'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                    {item.label === 'Favorites' && favorites.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
                        {favorites.length}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Trial badge */}
              {isTrialActive && trialDaysRemaining != null && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <IconClock className="size-3" />
                  {trialDaysRemaining}d trial
                </div>
              )}

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="hidden sm:flex size-8 items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {lightMode ? <IconMoon className="size-4" /> : <IconSun className="size-4" />}
              </button>

              {/* Profile dropdown */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="size-7 rounded-md bg-gradient-to-b from-neutral-700 to-neutral-800 flex items-center justify-center text-[10px] font-semibold text-white ring-1 ring-white/10">
                      {initials}
                    </div>
                    <span className="hidden sm:block text-[13px]">{user.email?.split('@')[0]}</span>
                    <IconChevronDown className={`size-3.5 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.98 }}
                          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                          className="absolute right-0 top-full mt-2 w-56 z-50 rounded-xl bg-neutral-900 p-1 ring-1 ring-white/10"
                          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4), 0 1px 0 0 rgba(255,255,255,0.06) inset' }}
                        >
                          <div className="px-3 py-2">
                            <p className="text-sm font-medium text-white">{user.fullName || user.email?.split('@')[0]}</p>
                            <p className="text-xs text-neutral-500">{user.email}</p>
                          </div>
                          <div className="h-px bg-white/[0.06] my-1" />
                          <Link
                            to="/app/account"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                          >
                            <IconUser className="size-4 text-neutral-500" />
                            Account
                          </Link>
                          <button
                            onClick={() => { handleManageSubscription(); setProfileOpen(false); }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/[0.06] hover:text-white transition-colors w-full text-left"
                          >
                            <IconCreditCard className="size-4 text-neutral-500" />
                            Manage Subscription
                          </button>
                          <div className="h-px bg-white/[0.06] my-1" />
                          <button
                            onClick={() => { handleSignOut(); setProfileOpen(false); }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
                          >
                            <IconLogout className="size-4" />
                            Sign Out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Mobile toggle */}
              <button
                className="lg:hidden relative inline-flex size-9 items-center justify-center rounded-md text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <IconX className="size-5" /> : <IconMenu2 className="size-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-white/[0.06] lg:hidden"
            >
              <div className="px-4 py-3 space-y-1">
                {isTrialActive && trialDaysRemaining != null && (
                  <div className="flex items-center gap-1.5 px-3 py-2 mb-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <IconClock className="size-3" />
                    {trialDaysRemaining} days left in trial
                  </div>
                )}
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-white/[0.08] text-white'
                          : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                      {item.label === 'Favorites' && favorites.length > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded-full">{favorites.length}</span>
                      )}
                    </Link>
                  );
                })}
                <div className="h-px bg-white/[0.06] my-2" />
                <button onClick={() => { handleManageSubscription(); setMobileOpen(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-neutral-400 hover:bg-white/[0.04] hover:text-white w-full">
                  <IconCreditCard className="size-4" />
                  Manage Subscription
                </button>
                <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 w-full">
                  <IconLogout className="size-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
