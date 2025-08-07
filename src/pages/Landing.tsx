import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, Search, DollarSign, MapPin, Star, 
  Brain, BarChart3, MessageSquare, Eye, Zap, Shield,
  ChevronRight, Play, ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
const aiWholesailLogo = "/lovable-uploads/8dcdb5d0-ddfb-406f-a5f0-b3c5112d210a.png";

const Landing = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleStartTrial = () => {
    if (!user) {
      // Redirect to signup mode for non-authenticated users
      window.location.href = '/auth?mode=signup';
      return;
    }

    // If user is already logged in, start subscription
    handleSubscribe();
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) throw error;
      
      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src={aiWholesailLogo} 
              alt="AIWholesail" 
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <Link to="/app">
                <Button variant="outline" className="hover-scale">
                  <Eye className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="outline" className="hover-scale">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto text-center relative z-10">
          <Badge variant="secondary" className="mb-6 animate-fade-in hover-scale">
            <Zap className="h-4 w-4 mr-2" />
            AI-Powered Real Estate Analysis
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 animate-fade-in">
            <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
              Find Profitable
            </span>
            <br />
            <span className="text-foreground">Wholesale Deals</span>
            <span className="text-primary">.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed animate-fade-in">
            Discover undervalued properties with <strong>AI-powered analysis</strong>, comprehensive market data, 
            and automated deal scoring. Turn data into profit with AIWholesail.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
            <Button 
              size="lg" 
              onClick={handleStartTrial}
              disabled={loading}
              className="text-lg px-10 py-4 hover-scale group"
            >
              {loading ? "Loading..." : "Start 7-Day Free Trial"}
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            {!user && (
              <Link to="/auth">
                <Button variant="outline" size="lg" className="text-lg px-10 py-4 hover-scale">
                  <Play className="h-5 w-5 mr-2" />
                  Watch Demo
                </Button>
              </Link>
            )}
          </div>
          
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground animate-fade-in">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>7-Day Free Trial</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 bg-gradient-to-r from-secondary/5 to-primary/5">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Powerful Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Everything You Need to <span className="text-primary">Succeed</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive platform combines cutting-edge AI with real estate expertise 
              to give you the competitive edge you need.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-primary/10 hover:border-primary/30">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit group-hover:bg-primary/20 transition-colors">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">AI-Powered Analysis</CardTitle>
                <CardDescription className="text-base">
                  Advanced machine learning algorithms analyze property data, market trends, 
                  and investment potential to identify the most profitable opportunities.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-primary/10 hover:border-primary/30">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit group-hover:bg-primary/20 transition-colors">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Smart Property Search</CardTitle>
                <CardDescription className="text-base">
                  Natural language search with advanced filtering across multiple MLS sources. 
                  Find distressed properties, foreclosures, and wholesale opportunities instantly.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-primary/10 hover:border-primary/30">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">AI Chat Assistant</CardTitle>
                <CardDescription className="text-base">
                  Get instant answers about market data, property analysis, and investment strategies 
                  from our AI assistant with web search capabilities.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/10 hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Deal Analysis & ROI</CardTitle>
                </div>
                <CardDescription>
                  Instant profit calculations, repair estimates, ARV analysis, and wholesale margin projections. 
                  Know your numbers before making an offer.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/10 hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Market Intelligence</CardTitle>
                </div>
                <CardDescription>
                  Real-time market data, comparable sales analysis, neighborhood insights, 
                  and predictive market trends to stay ahead of the competition.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-primary/5"></div>
        <div className="container mx-auto text-center relative z-10">
          <Badge variant="outline" className="mb-4">
            Simple Pricing
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Transparent <span className="text-primary">Pricing</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            One simple plan with everything you need. No hidden fees, no complicated tiers.
          </p>
          
          <Card className="max-w-lg mx-auto border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
            <CardHeader className="text-center pb-4">
              <div className="mb-4">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
               <div className="font-brand font-bold text-3xl tracking-tight">
                 <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                   AI
                 </span>
                 <span className="text-foreground">Wholesale</span>
                 <span className="bg-gradient-to-r from-primary/70 to-accent bg-clip-text text-transparent">
                   ail
                 </span>
               </div>
              <div className="text-5xl font-bold mb-2">
                $29.99
                <span className="text-xl font-normal text-muted-foreground">/month</span>
              </div>
              <CardDescription className="text-lg">
                Everything you need to find and analyze profitable wholesale deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-left mb-8">
                {[
                  "Unlimited property searches across all markets",
                  "AI-powered deal analysis and scoring",
                  "Real-time market data and comps",
                  "ROI and profit calculations",
                  "AI chat assistant with web search",
                  "Lead management and CRM",
                  "Export and reporting tools",
                  "Priority email support"
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <div className="space-y-4">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleStartTrial}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Start 7-Day Free Trial"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  No credit card required • Cancel anytime • Full refund within 30 days
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4 bg-gradient-to-r from-secondary/5 to-primary/5">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Success Stories
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              What Our <span className="text-primary">Users Say</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of successful real estate investors who've transformed 
              their business with AIWholesail.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Johnson",
                role: "Real Estate Investor",
                content: "AIWholesail helped me find 3 profitable deals in my first month. The AI analysis is incredibly accurate and saved me countless hours of research.",
                profit: "$85,000"
              },
              {
                name: "Mike Chen",
                role: "Wholesale Specialist",
                content: "The time I save on research and analysis has doubled my deal flow. This platform is a game-changer for serious wholesalers.",
                profit: "$120,000"
              },
              {
                name: "Jennifer Davis",
                role: "Property Flipper",
                content: "Finally, a tool that understands real estate investing. The ROI calculations are spot-on every time, and the AI chat helps me understand market trends.",
                profit: "$95,000"
              }
            ].map((testimonial, index) => (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-primary/10 hover:border-primary/30">
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                    ))}
                  </div>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-lg">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Profit Generated</p>
                        <p className="font-bold text-primary text-lg">{testimonial.profit}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-8">
            Ready to Transform Your 
            <br />
            <span className="text-primary">Real Estate Business?</span>
          </h2>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Join thousands of successful investors who use AIWholesail to find profitable deals 
            faster than ever before. Start your free trial today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button 
              size="lg" 
              onClick={handleSubscribe}
              disabled={loading}
              className="text-lg px-10 py-4 hover-scale group"
            >
              {loading ? "Loading..." : "Start Your Free Trial"}
              <ChevronRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
          
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>14-Day Free Trial</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <span>Cancel Anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 bg-background">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img 
                src={aiWholesailLogo} 
                alt="AIWholesail" 
                className="h-10 w-auto object-contain"
              />
            </div>
            <p className="text-muted-foreground text-center md:text-right">
              &copy; 2024 AIWholesail. All rights reserved.
              <br />
              <span className="text-sm">Empowering real estate investors worldwide</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;