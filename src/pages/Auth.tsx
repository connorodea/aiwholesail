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
import aiWholesailLogo from '@/assets/aiwholesail-logo-final.png';

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <img 
                src={aiWholesailLogo} 
                alt="AIWholesail" 
                className="h-16 w-auto object-contain"
              />
            </div>
            
            <Badge variant="secondary" className="mb-4 hover-scale">
              <Shield className="h-4 w-4 mr-2" />
              Professional Real Estate Tools
            </Badge>
            
            <h1 className="text-3xl md:text-4xl font-bold">
              <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                {isSignUp ? 'Join' : 'Welcome Back'}
              </span>
              <br />
              <span className="text-foreground text-2xl">
                {isSignUp ? 'AIWholesail Today' : 'to AIWholesail'}
              </span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-sm mx-auto">
              {isSignUp 
                ? 'Start finding profitable wholesale deals with AI-powered analysis' 
                : 'Continue your journey to profitable real estate investing'
              }
            </p>
          </div>

          {/* Form Card */}
          <Card className="simple-card border-primary/10 hover:border-primary/20 transition-colors">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignUp}
                      className="h-12 px-4 border-border focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
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
                      className="h-12 px-4 pr-12 border-border focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                    <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12 px-4 pr-12 border-border focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-12 text-lg font-medium hover-scale"
                  size="lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    <>
                      {isSignUp ? <UserPlus className="h-5 w-5 mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                      {isSignUp ? 'Create Account' : 'Sign In'}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>Secure & Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>Trusted by 1000+ Investors</span>
            </div>
          </div>

          {/* Switch Mode */}
          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            </span>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Professional Background */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10">
        {/* Background decoration matching Landing page */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-secondary/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-accent/20 rounded-full blur-2xl animate-pulse delay-2000"></div>
        
        {/* Content */}
        <div className="flex flex-col justify-center items-center p-12 relative z-10 text-center">
          <div className="max-w-md space-y-6">
            <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
              <Home className="h-16 w-16 text-primary" />
            </div>
            
            <h2 className="text-3xl font-bold">
              <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                AI-Powered
              </span>
              <br />
              <span className="text-foreground">Real Estate Success</span>
            </h2>
            
            <p className="text-lg text-muted-foreground leading-relaxed">
              Join thousands of successful investors using AI to find profitable wholesale deals. 
              Analyze properties instantly with our advanced market intelligence.
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Instant Deal Analysis</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Market Intelligence</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>ROI Calculations</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Lead Management</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}