import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LogIn, UserPlus, Eye, EyeOff, Mail, Home, Shield, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
const aiWholesailLogo = '/lovable-uploads/8dcdb5d0-ddfb-406f-a5f0-b3c5112d210a.png';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  
  // Check if user was just verified
  const isVerified = searchParams.get('verified') === 'true';

  useEffect(() => {
    if (user) {
      // Check if there's a stored plan selection for post-signup checkout
      const storedPlan = localStorage.getItem('selectedPlan');
      if (storedPlan) {
        const plan = JSON.parse(storedPlan);
        localStorage.removeItem('selectedPlan');
        handleCheckout(plan);
        return;
      }
      navigate('/app');
    }
    
    // Show verification success message if user just verified
    if (isVerified && !user) {
      toast.success('Email verified successfully! You can now sign in.');
      // Remove the verified parameter from URL
      navigate('/auth', { replace: true });
    }
  }, [user, navigate, isVerified]);

  const handleCheckout = async (plan: any) => {
    try {
      console.log('Starting checkout for plan:', plan.name, 'with priceId:', plan.priceId);
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId: plan.priceId }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('Redirecting to checkout...');
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error(error.message || 'Failed to start checkout process');
      // Redirect to pricing page if checkout fails
      navigate('/pricing');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already been registered')) {
            toast.error('An account with this email already exists. Please sign in instead.');
            setIsSignUp(false);
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created successfully! Please check your email to verify your account.');
          // Don't clear stored plan - it will be used after email verification
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password. Please try again.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Signed in successfully!');
          navigate('/app');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative">
      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50 animate-fade-in">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Brand Section */}
              <div className="flex items-center space-x-3">
                <div className="relative group">
                  <img src={aiWholesailLogo} alt="AIWholesail" className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
                </div>
              </div>
              
              {/* Back to Home */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="hover-scale" 
                onClick={() => navigate('/')}
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Auth Section */}
      <section className="relative pt-24 pb-16 px-4 overflow-hidden">
        {/* Subtle background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/2 to-transparent"></div>
        
        <div className="container mx-auto max-w-2xl relative z-10">
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-6">
              <Badge variant="secondary" className="text-xs font-medium">
                <Shield className="h-3 w-3 mr-1.5" />
                Secure Authentication
              </Badge>
              
              <h1 className="text-4xl md:text-5xl font-medium leading-tight tracking-tight">
                <span className="block mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {isSignUp ? "Join AIWholesail" : "Welcome Back"}
                </span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed font-light">
                {isSignUp 
                  ? "Transform your real estate business with AI-powered analysis and market intelligence." 
                  : "Access your personalized dashboard and continue finding profitable deals."
                }
              </p>
            </div>

            {/* Form Card */}
            <Card className="border border-border/50 rounded-2xl shadow-lg backdrop-blur-sm bg-card/50 max-w-md mx-auto">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium">
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={isSignUp}
                        className="h-11 border-border/50 bg-background/50 focus:border-primary transition-colors"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11 pl-4 pr-12 border-border/50 bg-background/50 focus:border-primary transition-colors"
                      />
                      <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={isSignUp ? "Create a strong password" : "Enter your password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="h-11 pl-4 pr-12 border-border/50 bg-background/50 focus:border-primary transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {isSignUp && (
                      <p className="text-xs text-muted-foreground">
                        Password must be at least 6 characters long
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-11 font-medium"
                    size="lg"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <>
                        {isSignUp ? <UserPlus className="h-4 w-4 mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                        {isSignUp ? 'Create Account' : 'Sign In'}
                      </>
                    )}
                  </Button>
                </form>

                {/* Trust Indicators */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-border/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    <span>10,000+ Users</span>
                  </div>
                </div>

                {/* Switch Mode */}
                <div className="text-center mt-6">
                  <p className="text-sm text-muted-foreground">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      {isSignUp ? 'Sign In' : 'Create Account'}
                    </button>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}