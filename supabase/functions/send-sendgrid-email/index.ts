
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, from }: EmailRequest = await req.json();

    const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");

    if (!sendGridApiKey) {
      throw new Error("SENDGRID_API_KEY is not configured in Supabase secrets.");
    }

    const defaultFrom = from || "AI Wholesail <noreply@aiwholesail.com>";

    const emailPayload = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject,
        },
      ],
      from: { email: "noreply@aiwholesail.com", name: "AI Wholesail" },
      content: [
        {
          type: "text/html",
          value: html,
        },
      ],
    };

    console.log("Sending email via SendGrid to:", to);

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendGridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid API error:", response.status, errorText);
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }

    // SendGrid returns 202 for successful sends
    const messageId = response.headers.get("X-Message-Id") || `${Date.now()}@sendgrid`;
    console.log(`✅ Email sent successfully via SendGrid: ${messageId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId,
        message: "Email sent successfully via SendGrid" 
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
      }
    );

  } catch (error: any) {
    console.error(`❌ SendGrid email error: ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
