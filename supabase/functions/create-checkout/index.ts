import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Try to get user info, but don't require it for guest checkout
    let user = null;
    const authHeader = req.headers.get("Authorization");
    
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseClient.auth.getUser(token);
        user = data.user;
        if (user?.email) {
          logStep("User authenticated", { userId: user.id, email: user.email });
        }
      } catch (error) {
        logStep("Authentication failed, proceeding as guest", { error: error.message });
      }
    } else {
      logStep("No authorization header, proceeding as guest checkout");
    }

    const body = await req.json();
    const planType = body.priceId; // This is now the plan type (Pro/Elite)
    const isGuestCheckout = body.guestCheckout || false;
    
    if (!planType) {
      throw new Error("Plan type is required");
    }
    logStep("Plan type received", { planType, isGuestCheckout });

    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16" 
    });

    // Fetch all prices from Stripe to find the correct ones
    const prices = await stripe.prices.list({ 
      active: true,
      type: 'recurring',
      expand: ['data.product']
    });
    
    logStep("Fetched prices from Stripe", { count: prices.data.length });

    // Find the correct price based on plan type
    let actualPriceId;
    if (planType === 'Pro') {
      // Look for $29/month plan
      const proPrice = prices.data.find(price => 
        price.unit_amount === 2900 && 
        price.recurring?.interval === 'month'
      );
      actualPriceId = proPrice?.id;
    } else if (planType === 'Elite') {
      // Look for $99/month plan  
      const elitePrice = prices.data.find(price => 
        price.unit_amount === 9900 && 
        price.recurring?.interval === 'month'
      );
      actualPriceId = elitePrice?.id;
    }

    if (!actualPriceId) {
      throw new Error(`No price found for ${planType} plan. Please ensure you have created the products in Stripe.`);
    }
    
    logStep("Found price ID", { planType, actualPriceId });
    
    let customerId;
    let customerEmail = user?.email;
    
    if (isGuestCheckout) {
      // For guest checkout, don't look for existing customer
      logStep("Guest checkout - no customer lookup");
      customerEmail = undefined; // Let Stripe collect email
    } else if (user?.email) {
      // For logged-in users, check for existing customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing customer", { customerId });
      } else {
        logStep("No existing customer found, will create new one");
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerEmail,
      line_items: [
        {
          price: actualPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        }
      },
      success_url: `${req.headers.get("origin")}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/pricing`,
      custom_text: {
        submit: {
          message: "Start your 7-day free trial of AI Wholesail Pro! You'll get access to advanced real estate wholesale tools and AI-powered analysis. No charge until trial ends."
        }
      },
      metadata: {
        company_name: "AI Wholesail",
        guest_checkout: isGuestCheckout.toString()
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});