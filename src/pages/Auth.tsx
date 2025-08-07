import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TestAccountsInfo } from '@/components/TestAccountsInfo';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LogIn, UserPlus, Home, Shield, Star, Zap, Brain, TrendingUp, Sparkles } from 'lucide-react';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      {/* Floating elements */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/3 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl animate-pulse delay-2000"></div>

      <div className="relative w-full max-w-7xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Branding & Features */}
        <div className="hidden lg:block space-y-8 animate-fade-in">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative p-4 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-2xl">
                <Home className="h-10 w-10 text-primary" />
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  Real Estate Wholesaler
                </h1>
                <p className="text-xl text-blue-300 font-medium">AI-Powered Investment Platform</p>
              </div>
            </div>

            <p className="text-lg text-blue-100 leading-relaxed">
              Transform your real estate investment strategy with cutting-edge AI technology. 
              Analyze properties, detect opportunities, and make data-driven decisions with confidence.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4 group hover:transform hover:scale-105 transition-all duration-300">
              <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl border border-emerald-500/20 group-hover:border-emerald-400/40 transition-colors">
                <Brain className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">AI-Powered Analysis</h3>
                <p className="text-blue-200 leading-relaxed">
                  Advanced property damage detection using Claude Sonnet 4 & GPT-4o for institutional-grade assessments
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 group hover:transform hover:scale-105 transition-all duration-300">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/20 group-hover:border-blue-400/40 transition-colors">
                <TrendingUp className="h-7 w-7 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Smart Deal Calculator</h3>
                <p className="text-blue-200 leading-relaxed">
                  Comprehensive deal analysis with risk scoring, market insights, and investment recommendations
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 group hover:transform hover:scale-105 transition-all duration-300">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/20 group-hover:border-purple-400/40 transition-colors">
                <Zap className="h-7 w-7 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Motivated Seller Detection</h3>
                <p className="text-blue-200 leading-relaxed">
                  Identify high-potential leads with advanced algorithms and market intelligence
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge className="bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:border-emerald-400/50 transition-colors px-4 py-2">
              <Star className="h-4 w-4 mr-2" />
              Professional Grade
            </Badge>
            <Badge className="bg-gradient-to-r from-blue-500/20 to-blue-500/10 text-blue-300 border-blue-500/30 hover:border-blue-400/50 transition-colors px-4 py-2">
              <Shield className="h-4 w-4 mr-2" />
              Enterprise Security
            </Badge>
            <Badge className="bg-gradient-to-r from-purple-500/20 to-purple-500/10 text-purple-300 border-purple-500/30 hover:border-purple-400/50 transition-colors px-4 py-2">
              <Sparkles className="h-4 w-4 mr-2" />
              AI-Powered
            </Badge>
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <div className="w-full max-w-lg mx-auto lg:mx-0 space-y-6 animate-fade-in">
          {/* Main Auth Card */}
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-[1.02]">
            <CardHeader className="text-center space-y-4 pb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-2xl flex items-center justify-center mb-2 border border-primary/20 shadow-xl">
                {isSignUp ? (
                  <UserPlus className="h-8 w-8 text-primary" />
                ) : (
                  <LogIn className="h-8 w-8 text-primary" />
                )}
              </div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                {isSignUp ? 'Create Your Account' : 'Welcome Back!'}
              </CardTitle>
              <CardDescription className="text-blue-200 text-lg">
                {isSignUp 
                  ? 'Start your 7-day free trial and find profitable wholesale deals' 
                  : 'Sign in to access your wholesale dashboard'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-white font-medium">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignUp}
                      className="bg-white/5 border-white/20 text-white placeholder:text-blue-300 focus:border-primary focus:ring-primary/20 h-12 text-lg backdrop-blur-sm"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/5 border-white/20 text-white placeholder:text-blue-300 focus:border-primary focus:ring-primary/20 h-12 text-lg backdrop-blur-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-white/5 border-white/20 text-white placeholder:text-blue-300 focus:border-primary focus:ring-primary/20 h-12 text-lg backdrop-blur-sm"
                  />
                  {isSignUp && (
                    <p className="text-sm text-blue-300">
                      Password must be at least 6 characters long
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white font-semibold py-4 h-12 text-lg rounded-xl transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-2xl" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : isSignUp ? (
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Start 7-Day Free Trial
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <LogIn className="h-5 w-5" />
                      Sign In
                    </div>
                  )}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-blue-300 mb-2">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </p>
                <Button
                  variant="ghost"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-blue-300 hover:text-white hover:bg-white/10 transition-all duration-300"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Accounts */}
          <div className="backdrop-blur-xl bg-white/5 border-white/10 rounded-2xl p-6 shadow-2xl">
            <TestAccountsInfo />
          </div>

          {/* Security Badge */}
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
              <Shield className="h-5 w-5 text-green-400" />
              <span className="text-sm text-blue-200 font-medium">Secure authentication powered by Supabase</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}