import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { stripe } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SEOHead } from '@/components/SEOHead';

const plans = [
  {
    name: 'Pro',
    price: 29,
    priceId: 'price_1QjrSuCwWnuOPtC4Bfwu6IEs',
    description: 'Perfect for individual wholesalers',
    features: [
      'Up to 5 alert locations',
      'Automated updates every 24 hours',
      'Advanced property matching',
      'Email notifications',
      'Basic market analytics',
      '7-day free trial included'
    ],
    popular: true
  },
  {
    name: 'Elite',
    price: 99,
    priceId: 'price_1QjrTKCwWnuOPtC4xIzkUCeY',
    description: 'For serious real estate professionals',
    features: [
      'Unlimited alert locations',
      'Real-time updates every 4 hours',
      'Advanced AI property analysis',
      'Priority email notifications',
      'Comprehensive market insights',
      'Skip tracing integration',
      'Lead scoring analytics',
      '7-day free trial included'
    ]
  }
];

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (plan: typeof plans[0]) => {
    setLoading(plan.priceId);
    
    try {
      // Always go to Stripe checkout first, regardless of login status
      // Store the plan info for post-payment account creation
      localStorage.setItem('selectedPlan', JSON.stringify(plan));
      localStorage.setItem('pendingCheckout', 'true');
      
      console.log('Starting checkout for plan:', plan.name, 'with priceId:', plan.priceId);

      // Create a checkout session (guest or authenticated)
      const response = await stripe.createCheckout(plan.name, !user);

      if (response.error) {
        console.error('Checkout error:', response.error);
        throw new Error(response.error);
      }

      console.log('Checkout response:', response.data);

      if ((response.data as any)?.url) {
        // Redirect to Stripe checkout in the same window
        window.location.href = (response.data as any).url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error(error.message || 'Failed to start checkout process');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead 
        title="Pricing Plans"
        description="Choose the perfect AI Wholesail plan for your real estate business. Start with a 7-day free trial. Pro at $29/month or Elite at $99/month."
        noIndex={false}
      />
      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
              <div className="text-lg font-semibold">Choose Your Plan</div>
              <div className="w-20"></div> {/* Spacer for centering */}
            </div>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center max-w-5xl">
          <div className="space-y-4 mb-16">
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight">
              Choose your <span className="text-primary">plan</span>
            </h1>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              Start your 7-day free trial today. Enter your credit card details to get started - you won't be charged until after your trial ends.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.name}
                className={`relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  plan.popular 
                    ? 'border-2 border-primary/30 hover:border-primary/50 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent shadow-[0_0_20px_hsl(var(--primary)_/_0.1)] hover:shadow-[0_0_30px_hsl(var(--primary)_/_0.15)] ring-1 ring-primary/20 hover:ring-primary/30' 
                    : 'border border-border/50 hover:border-primary/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Star className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-medium mb-2">{plan.name}</CardTitle>
                  <div className="text-4xl font-medium mb-2">
                    ${plan.price}
                    <span className="text-lg font-normal text-muted-foreground">/month</span>
                  </div>
                  <CardDescription className="font-light">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 text-left mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm font-light">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full h-12 text-base font-medium" 
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loading === plan.priceId}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {loading === plan.priceId ? 'Loading...' : `Start 7-Day Free Trial - $${plan.price}/month`}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground font-light mt-3 text-center">
                    Credit card required • Cancel anytime during trial
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            {user ? (
              <p className="text-sm text-muted-foreground">
                <Link to="/app" className="text-primary hover:underline">Go to Dashboard</Link>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Already have an account? <Link to="/auth" className="text-primary hover:underline">Sign in here</Link>
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}