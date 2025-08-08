import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "@/hooks/use-toast";

const Success = () => {
  const { user } = useAuth();
  const { refreshSubscription, isTrialActive, trialDaysRemaining } = useSubscription();

  useEffect(() => {
    // Check subscription status after successful payment
    const checkSubscription = async () => {
      if (!user) return;
      
      try {
        await refreshSubscription();
        
        // Show appropriate success message based on trial status
        const message = isTrialActive 
          ? `Your 7-day free trial has started! You have ${trialDaysRemaining} days to explore all premium features.`
          : "Your subscription is now active. Start finding profitable deals!";
          
        toast({
          title: "Welcome to AI Wholesail Pro!",
          description: message,
        });
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkSubscription();
  }, [user, refreshSubscription]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">
            {isTrialActive ? 'Free Trial Started!' : 'Payment Successful!'}
          </CardTitle>
          <CardDescription>
            {isTrialActive 
              ? `Welcome to AI Wholesail Pro! Your 7-day free trial is now active.`
              : `Welcome to AI Wholesail Pro. Your subscription is now active.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {isTrialActive 
              ? `You have ${trialDaysRemaining} days to explore all premium features including unlimited property searches, AI-powered deal analysis, and advanced market insights. No charge until your trial ends.`
              : `You now have access to all premium features including unlimited property searches, AI-powered deal analysis, and advanced market insights.`
            }
          </p>
          <Link to="/app">
            <Button className="w-full" size="lg">
              Start Finding Deals
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default Success;