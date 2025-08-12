import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, checkRateLimit, logSecurityEvent, createErrorResponse, sanitizeInput } from '../_shared/security-utils.ts';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const userIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkRateLimit(userIp, 'check-subscription', 60, 15);
    
    if (!rateLimit.allowed) {
      await logSecurityEvent('rate_limit_exceeded', { function: 'check-subscription' }, undefined, req);
      return createErrorResponse('Too many requests', 429);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all", // Include trialing and active subscriptions
      limit: 10,
    });
    
    let hasActiveSub = false;
    let subscriptionTier = null;
    let subscriptionEnd = null;
    let isOnTrial = false;
    let trialEnd = null;
    let trialStart = null;

    // Check for active or trialing subscriptions
    for (const subscription of subscriptions.data) {
      if (subscription.status === "active" || subscription.status === "trialing") {
        hasActiveSub = true;
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        
        // Check if subscription is in trial period
        if (subscription.status === "trialing" && subscription.trial_end) {
          isOnTrial = true;
          trialEnd = new Date(subscription.trial_end * 1000).toISOString();
          if (subscription.trial_start) {
            trialStart = new Date(subscription.trial_start * 1000).toISOString();
          }
        }
        
        // Determine subscription tier from price
        const priceId = subscription.items.data[0].price.id;
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount || 0;
        
        if (amount >= 9900) { // $99+ = Premium
          subscriptionTier = "Premium";
        } else if (amount >= 2900) { // $29+ = Basic
          subscriptionTier = "Basic";
        } else {
          subscriptionTier = "Basic"; // Default to Basic for any paid plan
        }
        
        logStep("Active subscription found", { 
          subscriptionId: subscription.id, 
          status: subscription.status,
          endDate: subscriptionEnd,
          priceId,
          amount,
          subscriptionTier,
          isOnTrial,
          trialEnd
        });
        break; // Use the first active/trialing subscription found
      }
    }

    if (!hasActiveSub) {
      logStep("No active subscription found");
    }

    await supabaseClient.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      subscribed: hasActiveSub,
      subscription_tier: hasActiveSub ? subscriptionTier : null,
      subscription_end: subscriptionEnd,
      is_trial: isOnTrial,
      trial_start: trialStart,
      trial_end: trialEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    logStep("Updated database with subscription info", { 
      subscribed: hasActiveSub, 
      subscriptionTier, 
      isOnTrial,
      trialEnd 
    });
    
    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      is_trial: isOnTrial,
      trial_start: trialStart,
      trial_end: trialEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    
    await logSecurityEvent('function_error', { 
      function: 'check-subscription', 
      error: sanitizeInput(errorMessage) 
    }, undefined, req);
    
    return createErrorResponse('Subscription check failed', 500);
  }
});