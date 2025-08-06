import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, TrendingUp, Search, DollarSign, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Landing = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe to our service.",
        variant: "destructive",
      });
      return;
    }

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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">WholesalePro</span>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <Link to="/">
                <Button variant="outline">Dashboard</Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="outline">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Real Estate Analysis
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Find Profitable Wholesale Deals
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Discover undervalued properties with AI analysis, comprehensive market data, and automated deal scoring. 
            Turn data into profit with WholesalePro.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleSubscribe}
              disabled={loading}
              className="text-lg px-8 py-3"
            >
              {loading ? "Loading..." : "Start Free Trial"}
            </Button>
            {!user && (
              <Link to="/auth">
                <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                  Sign Up Free
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-secondary/5">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to Succeed
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="simple-card">
              <CardHeader>
                <Search className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Smart Property Search</CardTitle>
                <CardDescription>
                  Advanced filtering and AI-powered property discovery across multiple markets
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="simple-card">
              <CardHeader>
                <DollarSign className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Deal Analysis</CardTitle>
                <CardDescription>
                  Instant ROI calculations, repair estimates, and profit potential scoring
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="simple-card">
              <CardHeader>
                <MapPin className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Market Intelligence</CardTitle>
                <CardDescription>
                  Real-time market data, comparable sales, and neighborhood insights
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Simple, Transparent Pricing</h2>
          
          <Card className="max-w-md mx-auto feature-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">WholesalePro</CardTitle>
              <div className="text-3xl font-bold">
                $29.99<span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
              <CardDescription>
                Everything you need to find and analyze wholesale deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-left">
                {[
                  "Unlimited property searches",
                  "AI-powered deal analysis",
                  "Real-time market data",
                  "ROI calculations",
                  "Lead management system",
                  "Export capabilities",
                  "Email support"
                ].map((feature) => (
                  <li key={feature} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-primary mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full mt-6" 
                size="lg"
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? "Loading..." : "Start Free Trial"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-secondary/5">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">What Our Users Say</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Johnson",
                role: "Real Estate Investor",
                content: "WholesalePro helped me find 3 profitable deals in my first month. The AI analysis is incredibly accurate."
              },
              {
                name: "Mike Chen",
                role: "Wholesale Specialist",
                content: "The time I save on research and analysis has doubled my deal flow. This platform is a game-changer."
              },
              {
                name: "Jennifer Davis",
                role: "Property Flipper",
                content: "Finally, a tool that understands real estate investing. The ROI calculations are spot-on every time."
              }
            ].map((testimonial, index) => (
              <Card key={index} className="simple-card">
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Real Estate Business?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of successful investors who use WholesalePro to find profitable deals faster than ever.
          </p>
          <Button 
            size="lg" 
            onClick={handleSubscribe}
            disabled={loading}
            className="text-lg px-8 py-3"
          >
            {loading ? "Loading..." : "Get Started Today"}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 WholesalePro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;