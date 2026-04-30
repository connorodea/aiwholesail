import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

export default function Refund() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead 
        title="Refund Policy"
        description="Refund Policy for AIWholesail - Learn about our refund terms and how to request refunds."
        noIndex={false}
      />
      
      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
              <div className="text-lg font-semibold">Refund Policy</div>
              <div className="w-20"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-8">Refund Policy</h1>
            <p className="text-sm text-muted-foreground mb-8">Last updated: January 8, 2025</p>

            <div className="prose prose-lg max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Free Trial Period</h2>
                <p>
                  AIWholesail offers a 7-day free trial for all new subscribers. During this period, you can 
                  explore all features of our platform without any charges. You may cancel your subscription 
                  at any time during the trial period without being charged.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Refund Eligibility</h2>
                <p>We offer refunds under the following circumstances:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Technical Issues:</strong> If you experience significant technical problems that prevent you from using our service and we cannot resolve them within 7 business days</li>
                  <li><strong>Billing Errors:</strong> If you were charged incorrectly due to a system error</li>
                  <li><strong>Subscription Cancellation:</strong> If you cancel within the first 7 days of a new billing cycle (excluding the free trial period)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Non-Refundable Circumstances</h2>
                <p>Refunds will not be provided in the following situations:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Change of mind after the trial period has ended</li>
                  <li>Failure to use the service during the billing period</li>
                  <li>Violation of our Terms of Service resulting in account termination</li>
                  <li>Requests made more than 30 days after the charge</li>
                  <li>Partial month usage (subscriptions are billed monthly)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. How to Request a Refund</h2>
                <p>To request a refund, please follow these steps:</p>
                <ol className="list-decimal pl-6 mt-2 space-y-2">
                  <li>Contact our support team at support@aiwholesail.com</li>
                  <li>Include your account email and subscription details</li>
                  <li>Provide a detailed explanation of why you're requesting a refund</li>
                  <li>Our team will review your request within 2-3 business days</li>
                  <li>If approved, refunds will be processed within 5-10 business days</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Refund Processing</h2>
                <p>
                  Approved refunds will be processed through the original payment method used for the 
                  subscription. The time it takes for the refund to appear in your account depends on 
                  your payment provider:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Credit/Debit Cards: 3-5 business days</li>
                  <li>PayPal: 1-2 business days</li>
                  <li>Bank Transfers: 5-10 business days</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Subscription Cancellation</h2>
                <p>
                  You can cancel your subscription at any time through your account settings or by 
                  contacting our support team. When you cancel:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>You'll continue to have access until the end of your current billing period</li>
                  <li>No future charges will occur</li>
                  <li>Your account will be downgraded to a free tier (if available) after the period ends</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Special Circumstances</h2>
                <p>
                  We understand that exceptional circumstances may arise. If you believe your situation 
                  warrants special consideration, please contact our support team. We review each case 
                  individually and may offer alternative solutions such as:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Account credit for future use</li>
                  <li>Temporary account suspension</li>
                  <li>Plan downgrade or upgrade</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Dispute Resolution</h2>
                <p>
                  If you're not satisfied with our refund decision, you may contact your payment provider 
                  to dispute the charge. Please note that chargebacks may result in the suspension of 
                  your account and loss of access to our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Policy Changes</h2>
                <p>
                  We reserve the right to modify this refund policy at any time. Any changes will be 
                  effective immediately upon posting on our website. Continued use of our service 
                  after changes constitutes acceptance of the new policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Contact Information</h2>
                <p>
                  For refund requests or questions about this policy, please contact us:
                  <br />
                  Email: support@aiwholesail.com
                  <br />
                  Response Time: 2-3 business days
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}