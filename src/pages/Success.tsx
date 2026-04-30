import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

const Success = () => {
  const { user } = useAuth();
  const { refreshSubscription, isTrialActive, trialDaysRemaining } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isGuest, setIsGuest] = useState(false);

  // Check if this was a guest checkout
  const sessionId = searchParams.get('session_id');
  const pendingCheckout = localStorage.getItem('pendingCheckout');

  useEffect(() => {
    // Check if this is a guest checkout completion
    if (sessionId && pendingCheckout && !user) {
      setIsGuest(true);
      // Clear the pending checkout flag
      localStorage.removeItem('pendingCheckout');
      toast({
        title: "Payment Successful!",
        description: "Your subscription is ready! Create your account now to access your trial.",
      });
      return;
    }

    // Check subscription status after successful payment for logged-in users
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
  }, [user, refreshSubscription, sessionId, pendingCheckout]);

  // If guest user after payment, show account creation prompt
  if (isGuest && !user) {
    return (
      <PublicLayout>
        <SEOHead title="Payment Successful" />
        <section className="flex items-center justify-center py-32 px-4">
          <div className="max-w-md w-full text-center border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-10">
            <div className="mx-auto mb-6">
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Payment Successful!</h1>
            <p className="text-neutral-400 mb-6">
              Your subscription is ready! Create your account now to start your 7-day free trial.
            </p>
            <p className="text-neutral-400 text-sm mb-8">
              You've successfully subscribed to AI Wholesail Pro. Create your account to access unlimited property searches, AI-powered deal analysis, and advanced market insights.
            </p>
            <Link to="/auth?mode=signup&fromPayment=true">
              <button className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-md transition-colors text-base">
                <UserPlus className="h-4 w-4" />
                Create Your Account
              </button>
            </Link>
            <p className="text-xs text-neutral-500 mt-4">
              Already have an account? <Link to="/auth" className="text-cyan-400 hover:underline">Sign in here</Link>
            </p>
          </div>
        </section>
      </PublicLayout>
    );
  }

  // If no user and not a guest checkout, redirect to auth
  if (!user && !isGuest) {
    navigate('/auth');
    return null;
  }

  return (
    <PublicLayout>
      <SEOHead title={isTrialActive ? 'Free Trial Started' : 'Payment Successful'} />
      <section className="flex items-center justify-center py-32 px-4">
        <div className="max-w-md w-full text-center border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-10">
          <div className="mx-auto mb-6">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            {isTrialActive ? 'Free Trial Started!' : 'Payment Successful!'}
          </h1>
          <p className="text-neutral-400 mb-6">
            {isTrialActive
              ? `Welcome to AI Wholesail Pro! Your 7-day free trial is now active.`
              : `Welcome to AI Wholesail Pro. Your subscription is now active.`
            }
          </p>
          <p className="text-neutral-400 text-sm mb-8">
            {isTrialActive
              ? `You have ${trialDaysRemaining} days to explore all premium features including unlimited property searches, AI-powered deal analysis, and advanced market insights. No charge until your trial ends.`
              : `You now have access to all premium features including unlimited property searches, AI-powered deal analysis, and advanced market insights.`
            }
          </p>
          <Link to="/app">
            <button className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-md transition-colors text-base">
              Start Finding Deals
            </button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Success;
