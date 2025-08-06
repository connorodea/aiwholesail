import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const Success = () => {
  const { user } = useAuth();

  useEffect(() => {
    // Check subscription status after successful payment
    const checkSubscription = async () => {
      if (!user) return;
      
      try {
        await supabase.functions.invoke('check-subscription');
        toast({
          title: "Welcome to WholesalePro!",
          description: "Your subscription is now active. Start finding profitable deals!",
        });
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkSubscription();
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Welcome to WholesalePro. Your subscription is now active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You now have access to all premium features including unlimited property searches, 
            AI-powered deal analysis, and advanced market insights.
          </p>
          <Link to="/">
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