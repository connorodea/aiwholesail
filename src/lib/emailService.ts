import { supabase } from "@/integrations/supabase/client";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email using the SMTP edge function
 * @param options Email options
 * @returns Promise with success status and message ID
 */
export async function sendEmail(options: SendEmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('send-smtp-email', {
      body: options
    });

    if (error) {
      console.error(`❌ Email error: ${error.message}`);
      return { success: false, error: error.message };
    }

    if (data?.success) {
      console.log(`✅ Email sent: ${data.messageId}`);
      return { success: true, messageId: data.messageId };
    }

    return { success: false, error: data?.error || 'Unknown error' };
  } catch (err: any) {
    console.error(`❌ Email error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send a property alert email
 * @param userEmail Recipient email
 * @param propertyData Property information
 */
export async function sendPropertyAlert(userEmail: string, propertyData: any) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb; margin-bottom: 20px;">🏠 New Property Alert from AI Wholesail</h2>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #1e40af;">${propertyData.address || 'Property Found'}</h3>
        <p><strong>Price:</strong> ${propertyData.price || 'Contact for price'}</p>
        <p><strong>Bedrooms:</strong> ${propertyData.bedrooms || 'N/A'}</p>
        <p><strong>Bathrooms:</strong> ${propertyData.bathrooms || 'N/A'}</p>
        <p><strong>Square Feet:</strong> ${propertyData.livingArea || 'N/A'}</p>
      </div>
      
      <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #065f46;">
          <strong>📊 AI Analysis:</strong> This property matches your investment criteria and shows potential for wholesale opportunities.
        </p>
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
        <a href="https://aiwholesail.com" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Full Analysis
        </a>
      </div>
      
      <p style="margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center;">
        You're receiving this because you have property alerts enabled in AI Wholesail.
        <br>
        <a href="https://aiwholesail.com/settings" style="color: #2563eb;">Update your preferences</a>
      </p>
    </div>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `📊 AI Wholesail Alert: New Property Match`,
    html
  });
}

/**
 * Send analysis completion email
 * @param userEmail Recipient email
 * @param analysisData Analysis results
 */
export async function sendAnalysisComplete(userEmail: string, analysisData: any) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb; margin-bottom: 20px;">📊 AI Analysis Complete</h2>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #1e40af;">Analysis Results Ready</h3>
        <p>Your property analysis has been completed successfully.</p>
        <p><strong>Property:</strong> ${analysisData.address}</p>
        <p><strong>Analysis Type:</strong> ${analysisData.type || 'Comprehensive Analysis'}</p>
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
        <a href="https://aiwholesail.com" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Results
        </a>
      </div>
    </div>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `📊 AI Wholesail: Analysis Complete`,
    html
  });
}

/**
 * Send error notification email
 * @param userEmail Recipient email
 * @param errorDetails Error information
 */
export async function sendErrorNotification(userEmail: string, errorDetails: any) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626; margin-bottom: 20px;">⚠️ AI Wholesail Alert</h2>
      
      <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
        <h3 style="margin-top: 0; color: #991b1b;">System Alert</h3>
        <p>We encountered an issue while processing your request.</p>
        <p><strong>Error:</strong> ${errorDetails.message}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
        <a href="https://aiwholesail.com/support" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Contact Support
        </a>
      </div>
    </div>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `⚠️ AI Wholesail: System Alert`,
    html
  });
}