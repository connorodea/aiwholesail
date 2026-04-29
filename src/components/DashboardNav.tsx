import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Home,
  Search,
  Heart,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  CreditCard,
  Menu,
  Timer,
  User,
  ChevronDown,
  Target,
  Brain,
  Repeat,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useFavorites } from '@/hooks/useFavorites';
import { stripe } from '@/lib/api-client';
import { toast } from 'sonner';

const navItems = [
  { href: '/app', label: 'Search', icon: Search },
  { href: '/app/off-market', label: 'Off-Market', icon: Target },
  { href: '/app/analyzer', label: 'AI Analyzer', icon: Brain },
  { href: '/app/sequences', label: 'Sequences', icon: Repeat },
  { href: '/app/favorites', label: 'Favorites', icon: Heart },
  { href: '/app/alerts', label: 'Alerts', icon: Bell },
];

export function DashboardNav() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isTrialActive, trialDaysRemaining } = useSubscription();
  const { favorites } = useFavorites();
  const [isOpen, setIsOpen] = useState(false);

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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/app" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <Home className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight hidden sm:block">
              AIWholesail
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`gap-2 ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {item.label === 'Favorites' && favorites.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {favorites.length}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {isTrialActive && trialDaysRemaining != null && (
              <Badge variant="outline" className="hidden sm:flex gap-1.5 text-orange-600 border-orange-300 bg-orange-50">
                <Timer className="h-3 w-3" />
                {trialDaysRemaining}d trial
              </Badge>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm">{user.email?.split('@')[0]}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.fullName || user.email?.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleManageSubscription}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Subscription
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button size="sm">Sign In</Button>
              </Link>
            )}

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex flex-col gap-6 mt-6">
                  {isTrialActive && trialDaysRemaining != null && (
                    <Badge variant="outline" className="w-fit gap-1.5 text-orange-600 border-orange-300 bg-orange-50">
                      <Timer className="h-3 w-3" />
                      {trialDaysRemaining} days left in trial
                    </Badge>
                  )}
                  <nav className="flex flex-col gap-1">
                    {navItems.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link key={item.href} to={item.href} onClick={() => setIsOpen(false)}>
                          <Button
                            variant={isActive ? 'secondary' : 'ghost'}
                            className={`w-full justify-start gap-3 ${isActive ? 'bg-primary/10 text-primary' : ''}`}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                            {item.label === 'Favorites' && favorites.length > 0 && (
                              <Badge variant="secondary" className="ml-auto">{favorites.length}</Badge>
                            )}
                          </Button>
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="flex flex-col gap-1 pt-4 border-t">
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleManageSubscription}>
                      <CreditCard className="h-4 w-4" />
                      Manage Subscription
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:text-destructive" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
