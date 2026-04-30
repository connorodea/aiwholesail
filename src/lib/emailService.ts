
import { communications } from "@/lib/api-client";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email using the SendGrid edge function
 * @param options Email options
 * @returns Promise with success status and message ID
 */
export async function sendEmail(options: SendEmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const response = await communications.sendEmail(options.to, options.subject, options.html);

    if (response.error) {
      console.error(`❌ Email error: ${response.error}`);
      return { success: false, error: response.error };
    }

    if ((response.data as any)?.success) {
      console.log(`✅ Email sent: ${(response.data as any).messageId}`);
      return { success: true, messageId: (response.data as any).messageId };
    }

    return { success: false, error: (response.data as any)?.error || 'Unknown error' };
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
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
      <!-- Header -->
      <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🏠 New Property Alert</h1>
        <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">AI Wholesail has found a match for you!</p>
      </div>
      
      <!-- Property Details -->
      <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: #f1f5f9; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="margin: 0 0 15px 0; color: #1e40af; font-size: 22px;">${propertyData.address || 'Property Found'}</h2>
          <div style="display: grid; gap: 10px;">
            <p style="margin: 0; font-size: 16px;"><strong>💰 Price:</strong> ${propertyData.price || 'Contact for price'}</p>
            <p style="margin: 0; font-size: 16px;"><strong>🛏️ Bedrooms:</strong> ${propertyData.bedrooms || 'N/A'}</p>
            <p style="margin: 0; font-size: 16px;"><strong>🛁 Bathrooms:</strong> ${propertyData.bathrooms || 'N/A'}</p>
            <p style="margin: 0; font-size: 16px;"><strong>📐 Square Feet:</strong> ${propertyData.livingArea || 'N/A'}</p>
          </div>
        </div>
        
        <!-- AI Analysis -->
        <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 30px;">
          <p style="margin: 0; color: #065f46; font-size: 16px; line-height: 1.5;">
            <strong>📊 AI Analysis:</strong> This property matches your investment criteria and shows excellent potential for profitable deals based on market data and comparable sales.
          </p>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://aiwholesail.com/app" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
          View Full Analysis →
          </a>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
          <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.5;">
            You're receiving this because you have property alerts enabled in AI Wholesail.
            <br>
            <a href="https://aiwholesail.com/app" style="color: #2563eb; text-decoration: none;">Update your preferences</a>
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `🏠 AI Wholesail Alert: New Property Match - ${propertyData.address || 'Investment Opportunity'}`,
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
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
      <!-- Header -->
      <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">📊 Analysis Complete</h1>
        <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">Your property analysis is ready!</p>
      </div>
      
      <!-- Analysis Details -->
      <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: #f1f5f9; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="margin: 0 0 15px 0; color: #047857; font-size: 22px;">Analysis Results Ready</h2>
          <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.5;">Your comprehensive property analysis has been completed successfully.</p>
          <div style="display: grid; gap: 10px;">
            <p style="margin: 0; font-size: 16px;"><strong>🏠 Property:</strong> ${analysisData.address}</p>
            <p style="margin: 0; font-size: 16px;"><strong>📋 Analysis Type:</strong> ${analysisData.type || 'Comprehensive Analysis'}</p>
          </div>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://aiwholesail.com/app" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">
            View Full Results →
          </a>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
          <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
            AI Wholesail - Advanced Real Estate Analysis
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `📊 AI Wholesail: Analysis Complete - ${analysisData.address}`,
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
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
      <!-- Header -->
      <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">⚠️ System Alert</h1>
        <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">We encountered an issue</p>
      </div>
      
      <!-- Error Details -->
      <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #dc2626;">
          <h2 style="margin: 0 0 15px 0; color: #991b1b; font-size: 22px;">Error Details</h2>
          <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.5;">We encountered an issue while processing your request.</p>
          <div style="display: grid; gap: 10px;">
            <p style="margin: 0; font-size: 16px;"><strong>❌ Error:</strong> ${errorDetails.message}</p>
            <p style="margin: 0; font-size: 16px;"><strong>⏰ Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://aiwholesail.com/support" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">
            Contact Support →
          </a>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
          <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
            AI Wholesail Support Team
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `⚠️ AI Wholesail: System Alert`,
    html
  });
}

/**
 * Send welcome email for new users
 * @param userEmail Recipient email
 * @param userName User's name
 */
export async function sendWelcomeEmail(userEmail: string, userName?: string) {
  const displayName = userName || userEmail.split('@')[0];
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
      <!-- Header -->
      <div style="text-align: center; padding: 40px 0; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">🎉 Welcome to AI Wholesail!</h1>
        <p style="color: #e9d5ff; margin: 15px 0 0 0; font-size: 18px;">Your real estate investing journey starts now</p>
      </div>
      
      <!-- Welcome Content -->
      <div style="background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <h2 style="margin: 0 0 20px 0; color: #5b21b6; font-size: 24px;">Hi ${displayName}! 👋</h2>
        
        <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.6; color: #374151;">
          Thank you for joining AI Wholesail! You now have access to the most advanced AI-powered tools for finding, analyzing, and closing real estate deals.
        </p>
        
        <!-- Quick Start Steps -->
        <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0;">
          <h3 style="margin: 0 0 20px 0; color: #5b21b6; font-size: 20px;">🚀 Get Started in 3 Steps:</h3>
          
          <div style="margin-bottom: 15px;">
            <strong style="color: #7c3aed;">1. Set up Property Alerts</strong>
            <p style="margin: 5px 0 0 0; color: #6b7280; line-height: 1.5;">Define your investment criteria and let AI find deals for you automatically.</p>
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong style="color: #7c3aed;">2. Analyze Properties</strong>
            <p style="margin: 5px 0 0 0; color: #6b7280; line-height: 1.5;">Use our AI-powered analysis tools to evaluate deals and estimate profits.</p>
          </div>
          
          <div>
            <strong style="color: #7c3aed;">3. Find Motivated Sellers</strong>
            <p style="margin: 5px 0 0 0; color: #6b7280; line-height: 1.5;">Leverage our skip tracing and lead scoring tools to connect with sellers.</p>
          </div>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 35px 0;">
          <a href="https://aiwholesail.com/app" style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">
            Start Finding Deals →
          </a>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 35px;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.5;">
            Questions? We're here to help! Reply to this email or visit our support center.
          </p>
          <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
            AI Wholesail - Powered by Artificial Intelligence for Real Estate Success
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `🎉 Welcome to AI Wholesail - Let's Find Your First Deal!`,
    html
  });
}
