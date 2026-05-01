import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { analytics } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import { stripe, auth } from '@/lib/api-client';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [isReset, setIsReset] = useState(searchParams.get('mode') === 'reset');
  const [resetToken] = useState(searchParams.get('token') || '');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Check if user was just verified
  const isVerified = searchParams.get('verified') === 'true';
  // Check for redirect destination (from ProtectedRoute)
  const redirectTo = searchParams.get('redirect');

  useEffect(() => {
    // Show verification success message if user just verified
    if (isVerified && !user) {
      toast.success('Email verified successfully! Please wait while we redirect you...');
    }

    if (user) {
      // Check if there's a stored plan selection for post-signup checkout
      const storedPlan = localStorage.getItem('selectedPlan');
      if (storedPlan) {
        const plan = JSON.parse(storedPlan);
        localStorage.removeItem('selectedPlan');
        // Show success message for verified users
        if (isVerified) {
          toast.success('Email verified! Redirecting to checkout...');
        }
        handleCheckout(plan);
        return;
      }
      // Redirect to intended page or default to /app
      navigate(redirectTo || '/app');
    }
  }, [user, navigate, isVerified, redirectTo]);

  const handleCheckout = async (plan: any) => {
    try {
      console.log('Starting checkout for plan:', plan.name, 'with priceId:', plan.priceId);

      const response = await stripe.createCheckout(plan.name, false);

      if (response.error) {
        console.error('Checkout error:', response.error);
        throw new Error(response.error);
      }

      if ((response.data as any)?.url) {
        window.open((response.data as any).url, '_blank');
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const response = await auth.resetPassword(resetToken, password);
      if (response.error) {
        toast.error(response.error);
      } else {
        setResetSuccess(true);
        toast.success('Password reset successfully! You can now sign in.');
      }
    } catch {
      toast.error('Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already') || error.message.includes('registered') || error.message.includes('Email already')) {
            toast.error('An account with this email already exists. Please sign in instead.');
            setIsSignUp(false);
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome to AIWholesail! Your 7-day free trial has started.');
          analytics.signUp('email');
          analytics.beginTrial('Pro');
          localStorage.removeItem('selectedPlan');
          // Go to intended page or default to app — trial starts automatically
          navigate(redirectTo || '/app');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid') || error.message.includes('credentials')) {
            toast.error('Invalid email or password. Please try again.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Signed in successfully!');
          analytics.login('email');
          navigate(redirectTo || '/app');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <SEOHead
        title={isReset ? "Reset Password" : isSignUp ? "Create Account" : "Sign In"}
        description={isReset ? "Reset your AIWholesail password." : isSignUp ? "Create your AIWholesail account and start finding profitable real estate deals with our 7-day free trial." : "Sign in to your AIWholesail account to access your real estate deal-finding dashboard."}
        noIndex={false}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            {isReset ? 'RESET PASSWORD' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {isReset ? (
              <>
                Reset Your
                <br />
                <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                  Password.
                </span>
              </>
            ) : isSignUp ? (
              <>
                Create Your
                <br />
                <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                  Account.
                </span>
              </>
            ) : (
              <>
                Welcome to
                <br />
                <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                  AIWholesail.
                </span>
              </>
            )}
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {isReset
              ? "Enter your new password below."
              : isSignUp
              ? "Start finding profitable real estate deals today with a 7-day free trial."
              : "Sign in to access your dashboard and continue finding profitable deals."
            }
          </p>
        </div>
      </section>

      {/* ===== AUTH FORM ===== */}
      <section className="py-24 px-4 bg-[#08090a]">
        <div className="container mx-auto max-w-md">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 md:p-10">

            {/* PASSWORD RESET FORM */}
            {isReset ? (
              resetSuccess ? (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-12 w-12 text-cyan-400 mx-auto" />
                  <h3 className="text-xl font-semibold">Password Reset Successfully</h3>
                  <p className="text-sm text-neutral-400">You can now sign in with your new password.</p>
                  <Button
                    onClick={() => { setIsReset(false); setResetSuccess(false); }}
                    className="w-full h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 font-semibold text-base gap-2"
                    size="lg"
                  >
                    Sign In <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="h-11 pl-4 pr-12 bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-white transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-400 font-light">Min 8 characters with uppercase, lowercase, number, and special character</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 pl-4 bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 font-semibold text-base gap-2" size="lg">
                    {loading ? 'Resetting...' : 'Reset Password'} {!loading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </form>
              )
            ) : (

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    className="h-11 bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
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
                    className="h-11 pl-4 pr-12 bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
                  />
                  <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
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
                    minLength={8}
                    className="h-11 pl-4 pr-12 bg-white/[0.03] border-white/[0.06] focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-xs text-neutral-400 font-light">
                    Min 8 characters with uppercase, lowercase, number, and special character
                  </p>
                )}
                {!isSignUp && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email) {
                          toast.error('Please enter your email address first.');
                          return;
                        }
                        try {
                          const response = await auth.forgotPassword(email);
                          if (response.error) {
                            toast.error(response.error);
                          } else {
                            toast.success('Password reset link sent! Check your email.');
                          }
                        } catch (error) {
                          toast.error('Failed to send reset link. Please try again.');
                        }
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-400/80 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 font-semibold text-base gap-2"
                size="lg"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
            )}

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-border/30">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Shield className="h-3.5 w-3.5 text-cyan-400" />
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <CheckCircle className="h-3.5 w-3.5 text-cyan-400" />
                <span>10,000+ Users</span>
              </div>
            </div>

            {/* Switch Mode */}
            <div className="text-center mt-6">
              <p className="text-sm text-neutral-400">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-cyan-400 hover:text-cyan-400/80 font-medium transition-colors"
                >
                  {isSignUp ? 'Sign In' : 'Create Account'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
