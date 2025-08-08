import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Bell, MapPin, Clock, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubscriptionPlan {
  name: string;
  price: number;
  priceId: string;
  description: string;
  features: string[];
  maxLocations: number;
  updateFrequency: string;
  popular?: boolean;
  current?: boolean;
}

interface SubscriptionPlansProps {
  currentSubscription?: any;
  onSubscriptionChange?: () => void;
}

const plans: SubscriptionPlan[] = [
  {
    name: 'Trial',
    price: 0,
    priceId: 'prod_SpKGOx8zA1dDIp',
    description: 'Get started with basic property alerts',
    features: [
      '1 alert location',
      'Manual updates only',
      'Basic property matching',
      'Email notifications'
    ],
    maxLocations: 1,
    updateFrequency: 'Manual'
  },
  {
    name: 'Pro',
    price: 29,
    priceId: 'prod_SpKGilpmcRga6b',
    description: 'Perfect for individual wholesalers - 7-day free trial',
    features: [
      'Up to 5 alert locations',
      'Automated updates every 24 hours',
      'Advanced property matching',
      'Email notifications',
      'Basic market analytics',
      '7-day free trial included'
    ],
    maxLocations: 5,
    updateFrequency: 'Every 24 hours',
    popular: true
  },
  {
    name: 'Elite',
    price: 99,
    priceId: 'prod_SpKH7DdaZIudL9',
    description: 'For serious real estate professionals - 7-day free trial',
    features: [
      'Unlimited alert locations',
      'Real-time updates every 4 hours',
      'Advanced AI property analysis',
      'Priority email notifications',
      'Comprehensive market insights',
      'Skip tracing integration',
      'Lead scoring analytics',
      '7-day free trial included'
    ],
    maxLocations: 999,
    updateFrequency: 'Every 4 hours'
  }
];

export const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ 
  currentSubscription, 
  onSubscriptionChange 
}) => {
  const [loading, setLoading] = React.useState<string | null>(null);

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (plan.price === 0) return;
    
    setLoading(plan.priceId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId: plan.priceId }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout process');
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading('manage');
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open subscription management');
    } finally {
      setLoading(null);
    }
  };

  const getCurrentPlan = () => {
    if (!currentSubscription?.subscribed) return 'Free';
    if (currentSubscription?.subscription_tier === 'Premium') return 'Premium';
    return 'Basic';
  };

  const currentPlanName = getCurrentPlan();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Scale your property alert system with plans designed for every level of real estate investing. Both plans include a 7-day free trial.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.name === currentPlanName;
          const isDowngrade = plan.price < (currentSubscription?.subscribed ? (currentSubscription?.subscription_tier === 'Premium' ? 99 : 29) : 0);
          
          return (
            <Card 
              key={plan.name} 
              className={`relative transition-all ${
                plan.popular ? 'ring-2 ring-primary scale-105' : ''
              } ${isCurrent ? 'border-green-500 bg-green-50/50' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  {plan.price > 0 && <span className="text-muted-foreground">/month</span>}
                </div>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{plan.maxLocations === 999 ? 'Unlimited' : plan.maxLocations} location{plan.maxLocations !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{plan.updateFrequency}</span>
                  </div>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4">
                  {isCurrent ? (
                    plan.price > 0 ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleManageSubscription}
                        disabled={loading === 'manage'}
                      >
                        {loading === 'manage' ? 'Loading...' : 'Manage Subscription'}
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    )
                  ) : isDowngrade ? (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handleManageSubscription}
                      disabled={loading === 'manage'}
                    >
                      {loading === 'manage' ? 'Loading...' : 'Downgrade via Portal'}
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      onClick={() => handleUpgrade(plan)}
                      disabled={loading === plan.priceId || plan.price === 0}
                    >
                      {loading === plan.priceId ? 'Loading...' : 
                       plan.price === 0 ? 'Free Forever' : 
                       plan.price > (currentSubscription?.subscribed ? (currentSubscription?.subscription_tier === 'Premium' ? 99 : 29) : 0) ? 'Upgrade' : 'Choose Plan'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {currentSubscription?.subscribed && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Bell className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Your Subscription Status</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Plan:</span>
                <span className="ml-2 font-medium">{currentSubscription.subscription_tier || 'Basic'}</span>
              </div>
              <div>
                <span className="text-blue-700">Status:</span>
                <span className="ml-2 font-medium text-green-600">Active</span>
              </div>
              {currentSubscription.subscription_end && (
                <div>
                  <span className="text-blue-700">Next billing:</span>
                  <span className="ml-2 font-medium">
                    {new Date(currentSubscription.subscription_end).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};