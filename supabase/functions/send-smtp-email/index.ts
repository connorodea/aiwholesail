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

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP configuration missing. Please configure SMTP_HOST, SMTP_USER, and SMTP_PASS in Supabase secrets.");
    }

    const defaultFrom = from || `"AI Wholesail Alerts" <${smtpUser}>`;

    // Create SMTP connection
    const conn = await Deno.connect({
      hostname: smtpHost,
      port: smtpPort,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper function to send SMTP command
    const sendCommand = async (command: string): Promise<string> => {
      await conn.write(encoder.encode(command + "\r\n"));
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn.read(buffer);
      return decoder.decode(buffer.subarray(0, bytesRead || 0));
    };

    // SMTP conversation
    let response = await sendCommand(`EHLO ${smtpHost}`);
    console.log("EHLO response:", response);

    // Start TLS if port is 587
    if (smtpPort === 587) {
      response = await sendCommand("STARTTLS");
      console.log("STARTTLS response:", response);
    }

    // Authenticate
    response = await sendCommand("AUTH LOGIN");
    console.log("AUTH LOGIN response:", response);

    const base64User = btoa(smtpUser);
    response = await sendCommand(base64User);
    console.log("Username response:", response);

    const base64Pass = btoa(smtpPass);
    response = await sendCommand(base64Pass);
    console.log("Password response:", response);

    // Send email
    response = await sendCommand(`MAIL FROM:<${smtpUser}>`);
    console.log("MAIL FROM response:", response);

    response = await sendCommand(`RCPT TO:<${to}>`);
    console.log("RCPT TO response:", response);

    response = await sendCommand("DATA");
    console.log("DATA response:", response);

    const emailContent = [
      `From: ${defaultFrom}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      html,
      "."
    ].join("\r\n");

    response = await sendCommand(emailContent);
    console.log("Email content response:", response);

    response = await sendCommand("QUIT");
    console.log("QUIT response:", response);

    conn.close();

    // Extract message ID from response (simplified)
    const messageId = `${Date.now()}@aiwholesail.com`;
    console.log(`✅ Email sent: ${messageId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId,
        message: "Email sent successfully" 
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
    console.error(`❌ Email error: ${error.message}`);
    
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