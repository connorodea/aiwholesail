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
    <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5 flex relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 relative z-10">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center mb-8">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
                <img 
                  src={aiWholesailLogo} 
                  alt="AIWholesail" 
                  className="h-20 w-auto object-contain relative hover-scale"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <Badge 
                variant="secondary" 
                className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 text-primary hover-scale"
              >
                <Shield className="h-4 w-4 mr-2" />
                Professional Real Estate AI Platform
              </Badge>
              
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                  {isSignUp ? 'Join the Future' : 'Welcome Back'}
                </span>
                <br />
                <span className="text-foreground text-xl lg:text-2xl font-medium">
                  {isSignUp ? 'of Real Estate Investing' : 'to AIWholesail'}
                </span>
              </h1>
              
              <p className="text-base lg:text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {isSignUp 
                  ? 'Transform your real estate business with AI-powered market intelligence and deal analysis' 
                  : 'Continue building your real estate empire with cutting-edge AI tools'
                }
              </p>
            </div>
          </div>

          {/* Form Card */}
          <Card className="backdrop-blur-sm bg-background/80 border border-primary/10 shadow-xl hover:shadow-2xl hover:border-primary/20 transition-all duration-300">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {isSignUp && (
                  <div className="space-y-3">
                    <Label htmlFor="fullName" className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="w-1 h-4 bg-primary rounded-full"></div>
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignUp}
                      className="h-12 px-4 border-border/50 bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all hover:border-primary/50"
                    />
                  </div>
                )}
                
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full"></div>
                    Email Address
                  </Label>
                  <div className="relative group">
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 px-4 pr-12 border-border/50 bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all hover:border-primary/50"
                    />
                    <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="password" className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full"></div>
                    Password
                  </Label>
                  <div className="relative group">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12 px-4 pr-12 border-border/50 bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all hover:border-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-primary transition-all hover-scale"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                  className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover-scale"
                  size="lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <>
                      {isSignUp ? <UserPlus className="h-5 w-5 mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                      {isSignUp ? 'Create Your Account' : 'Sign In'}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-6 lg:gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 backdrop-blur-sm">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-medium">Bank-Level Security</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 backdrop-blur-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="font-medium">10,000+ Users</span>
            </div>
          </div>

          {/* Switch Mode */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:text-secondary font-semibold transition-colors hover:underline underline-offset-2"
              >
                {isSignUp ? 'Sign In Here' : 'Create Account'}
              </button>
            </p>
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