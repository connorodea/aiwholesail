import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Search, DollarSign, MapPin, Star, Brain, BarChart3, MessageSquare, Eye, Zap, Shield, ChevronRight, Play, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ScrollSailboat from "@/components/ScrollSailboat";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { SEOHead } from "@/components/SEOHead";
const aiWholesailLogo = "/lovable-uploads/8dcdb5d0-ddfb-406f-a5f0-b3c5112d210a.png";
const Landing = () => {
  const {
    user
  } = useAuth();
  const [loading, setLoading] = useState(false);

  // Animation refs for different sections
  const heroRef = useScrollAnimation({
    threshold: 0.2
  });
  const featuresRef = useScrollAnimation({
    threshold: 0.1
  });
  const pricingRef = useScrollAnimation({
    threshold: 0.1
  });
  const testimonialsRef = useScrollAnimation({
    threshold: 0.1
  });
  const ctaRef = useScrollAnimation({
    threshold: 0.1
  });
  const handleStartTrial = () => {
    // Always redirect to pricing page for plan selection
    window.location.href = '/pricing';
  };
  const handleSubscribe = () => {
    // Redirect to pricing page for plan selection
    window.location.href = '/pricing';
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative">
      <SEOHead />
      {/* Scroll-driven sailboat animation */}
      <ScrollSailboat />
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
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                {user ? <Link to="/app">
                    <Button variant="default" size="sm" className="hover-scale shadow-sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Dashboard
                    </Button>
                  </Link> : <div className="flex items-center space-x-2">
                    <Link to="/auth">
                      <Button variant="ghost" size="sm" className="hover-scale">
                        Sign In
                      </Button>
                    </Link>
                    <Button size="sm" className="hover-scale shadow-sm" onClick={handleStartTrial}>
                      Get Started
                    </Button>
                  </div>}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {/* Hero Section - OpenAI inspired clean design */}
      <section ref={heroRef.ref} className="relative pt-32 pb-16 px-4 overflow-hidden">
        {/* Subtle background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/2 to-transparent"></div>
        
        <div className={`container mx-auto text-center relative z-10 max-w-4xl transition-all duration-1000 ${heroRef.isVisible ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="space-y-8">
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-medium leading-tight tracking-tight">
              <span className="block mb-2">Find Profitable</span>
              <span className="block bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Wholesale Deals
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
              Discover undervalued properties with AI-powered analysis, comprehensive market data, 
              and automated deal scoring. Turn data into profit.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button size="lg" onClick={handleStartTrial} disabled={loading} className="text-base font-medium px-8 py-3 rounded-full">
                {loading ? "Loading..." : "Start 7-Day Free Trial"}
              </Button>
                {!user && <Button variant="outline" size="lg" onClick={handleStartTrial} className="text-base font-medium px-8 py-3 rounded-full">
                    Watch Demo
                  </Button>}
            </div>
            
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-6">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>Credit Card Required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span>7-Day Free Trial</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Clean and Minimal */}
      <section ref={featuresRef.ref} className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className={`text-center mb-16 space-y-4 transition-all duration-1000 delay-200 ${featuresRef.isVisible ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              Everything you need to <span className="text-primary">succeed</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              Our comprehensive platform combines cutting-edge AI with real estate expertise 
              to give you the competitive edge you need.
            </p>
          </div>
          
          <div className={`grid lg:grid-cols-3 gap-8 mb-12 transition-all duration-1000 delay-400 ${featuresRef.isVisible ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="group text-center space-y-4 p-6 rounded-2xl hover:bg-card/50 transition-all duration-500">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-2xl w-fit group-hover:bg-primary/15 transition-colors">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium">AI-Powered Analysis</h3>
              <p className="text-muted-foreground font-light">
                Advanced machine learning algorithms analyze property data, market trends, 
                and investment potential to identify the most profitable opportunities.
              </p>
            </div>
            
            <div className="group text-center space-y-4 p-6 rounded-2xl hover:bg-card/50 transition-all duration-500">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-2xl w-fit group-hover:bg-primary/15 transition-colors">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium">Smart Property Search</h3>
              <p className="text-muted-foreground font-light">
                Natural language search with advanced filtering across multiple MLS sources. 
                Find distressed properties, foreclosures, and wholesale opportunities instantly.
              </p>
            </div>
            
            <div className="group text-center space-y-4 p-6 rounded-2xl hover:bg-card/50 transition-all duration-500">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-2xl w-fit group-hover:bg-primary/15 transition-colors">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium">AI Chat Assistant</h3>
              <p className="text-muted-foreground font-light">
                Get instant answers about market data, property analysis, and investment strategies 
                from our AI assistant with web search capabilities.
              </p>
            </div>
          </div>

          <div className={`grid md:grid-cols-2 gap-8 max-w-4xl mx-auto transition-all duration-1000 delay-600 ${featuresRef.isVisible ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="group space-y-4 p-6 rounded-2xl hover:bg-card/50 transition-all duration-500">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/15 transition-colors">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-medium">Deal Analysis & ROI</h3>
              </div>
              <p className="text-muted-foreground font-light">
                Instant profit calculations, repair estimates, ARV analysis, and wholesale margin projections. 
                Know your numbers before making an offer.
              </p>
            </div>
            
            <div className="group space-y-4 p-6 rounded-2xl hover:bg-card/50 transition-all duration-500">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/15 transition-colors">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-medium">Market Intelligence</h3>
              </div>
              <p className="text-muted-foreground font-light">
                Real-time market data, comparable sales analysis, neighborhood insights, 
                and predictive market trends to stay ahead of the competition.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - Clean & Minimal */}
      <section ref={pricingRef.ref} className="py-24 px-4">
        <div className="container mx-auto text-center max-w-5xl">
          <div className={`space-y-4 mb-16 transition-all duration-1000 ${pricingRef.isVisible ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              Simple, transparent <span className="text-primary">pricing</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              Choose the plan that fits your business. Both plans include a 7-day free trial.
            </p>
          </div>
          
          <div className={`grid md:grid-cols-2 gap-6 max-w-3xl mx-auto transition-all duration-1000 delay-300 ${pricingRef.isVisible ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Pro Plan */}
            <Card className="border-2 border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent shadow-[0_0_20px_hsl(var(--primary)_/_0.1)] hover:shadow-[0_0_30px_hsl(var(--primary)_/_0.15)] ring-1 ring-primary/20 hover:ring-primary/30 relative overflow-hidden">
              <CardHeader className="text-center pb-4">
                <div className="mb-3">
                  <Badge className="bg-primary text-primary-foreground text-xs">Most Popular</Badge>
                </div>
                <CardTitle className="text-xl font-medium text-primary mb-2">Pro</CardTitle>
                <div className="text-4xl font-medium mb-2">
                  $29
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <CardDescription className="font-light">
                  Perfect for individual wholesalers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-left mb-8">
                  {["Up to 5 alert locations", "Automated updates every 24 hours", "Advanced property matching", "Email notifications", "Basic market analytics", "7-day free trial included"].map(feature => <li key={feature} className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-light">{feature}</span>
                    </li>)}
                </ul>
                
                <div className="space-y-3">
                  <Button className="w-full h-10 text-sm font-medium" onClick={handleStartTrial} disabled={loading}>
                    {loading ? "Loading..." : "Start 7-Day Free Trial"}
                  </Button>
                  <p className="text-xs text-muted-foreground font-light">
                    Credit card required • Cancel anytime during trial
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Elite Plan */}
            <Card className="border border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-medium mb-2">Elite</CardTitle>
                <div className="text-4xl font-medium mb-2">
                  $99
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <CardDescription className="font-light">
                  For serious real estate professionals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-left mb-8">
                  {["Unlimited alert locations", "Real-time updates every 4 hours", "Advanced AI property analysis", "Priority email notifications", "Comprehensive market insights", "Skip tracing integration", "Lead scoring analytics", "7-day free trial included"].map(feature => <li key={feature} className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-light">{feature}</span>
                    </li>)}
                </ul>
                
                <div className="space-y-3">
                  <Button className="w-full h-10 text-sm font-medium" variant="outline" onClick={handleStartTrial} disabled={loading}>
                    {loading ? "Loading..." : "Start 7-Day Free Trial"}
                  </Button>
                  <p className="text-xs text-muted-foreground font-light">
                    Credit card required • Cancel anytime during trial
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials - Clean Design */}
      <section ref={testimonialsRef.ref} className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className={`text-center mb-16 space-y-4 transition-all duration-1000 ${testimonialsRef.isVisible ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              What our <span className="text-primary">users say</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              Join thousands of successful real estate investors who've transformed 
              their business with AIWholesail.
            </p>
          </div>
          
          <div className={`grid md:grid-cols-2 gap-8 transition-all duration-1000 delay-300 ${testimonialsRef.isVisible ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {[{
            name: "Sarah Johnson",
            role: "Real Estate Investor",
            content: "AIWholesail helped me find 3 profitable deals in my first month. The AI analysis is incredibly accurate and saved me countless hours of research.",
            profit: "$85,000"
          }, {
            name: "Mike Chen",
            role: "Wholesale Specialist",
            content: "The time I save on research and analysis has doubled my deal flow. This platform is a game-changer for serious wholesalers.",
            profit: "$120,000"
          }, {
            name: "Jennifer Davis",
            role: "Property Flipper",
            content: "Finally, a tool that understands real estate investing. The ROI calculations are spot-on every time, and the AI chat helps me understand market trends.",
            profit: "$95,000"
          }, {
            name: "Robert Martinez",
            role: "Investment Advisor",
            content: "The automated alerts have transformed how I source deals for my clients. We're closing 40% more transactions since implementing AIWholesail.",
            profit: "$150,000"
          }].map((testimonial, index) => <div key={index} className="group bg-card border border-border/50 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}
                </div>
                
                <p className="text-muted-foreground mb-6 leading-relaxed font-light">
                  "{testimonial.content}"
                </p>
                
                <div className="border-t border-border/30 pt-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground font-light">{testimonial.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-light">Profit Generated</p>
                      <p className="font-medium text-primary">{testimonial.profit}</p>
                    </div>
                  </div>
                </div>
              </div>)}
          </div>
        </div>
      </section>

      {/* CTA Section - Minimal */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <div className="space-y-8">
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-tight">
              Ready to transform your 
              <span className="block text-primary">real estate business?</span>
            </h2>
            
            <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto">
              Join thousands of successful investors who use AIWholesail to find profitable deals 
              faster than ever before.
            </p>
            
            <div className="pt-4">
              <Button size="lg" onClick={handleSubscribe} disabled={loading} className="text-base font-medium px-8 py-3 rounded-full">
                {loading ? "Loading..." : "Start Your Free Trial"}
              </Button>
            </div>
            
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span className="font-light">7-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="font-light">Credit Card Required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="border-t border-border/30 py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img src={aiWholesailLogo} alt="AIWholesail" className="h-8 w-auto object-contain" />
            </div>
            <p className="text-sm text-muted-foreground font-light text-center md:text-right">© 2025 AIWholesail. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Landing;