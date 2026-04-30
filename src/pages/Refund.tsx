import { Badge } from '@/components/ui/badge';
import { ReceiptText } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

export default function Refund() {
  return (
    <PublicLayout>
      <SEOHead
        title="Refund Policy"
        description="Refund Policy for AIWholesail - Learn about our refund terms and how to request refunds."
        noIndex={false}
      />

      {/* ===== HERO — DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-6xl px-4 pt-24 pb-20 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <ReceiptText className="h-3 w-3 mr-1.5" /> Legal
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Refund Policy
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
            We want you to be fully satisfied. Here is everything you need to know about our refund process.
          </p>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== CONTENT — LIGHT ===== */}
      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-3xl">
          <p className="text-sm text-muted-foreground font-light mb-12">Last updated: January 8, 2025</p>

          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">1. Free Trial Period</h2>
              <p className="text-muted-foreground font-light leading-relaxed">
                AIWholesail offers a 7-day free trial for all new subscribers. During this period, you can
                explore all features of our platform without any charges. You may cancel your subscription
                at any time during the trial period without being charged.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">2. Refund Eligibility</h2>
              <p className="text-muted-foreground font-light leading-relaxed mb-3">We offer refunds under the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground font-light leading-relaxed">
                <li><strong className="text-foreground font-medium">Technical Issues:</strong> If you experience significant technical problems that prevent you from using our service and we cannot resolve them within 7 business days</li>
                <li><strong className="text-foreground font-medium">Billing Errors:</strong> If you were charged incorrectly due to a system error</li>
                <li><strong className="text-foreground font-medium">Subscription Cancellation:</strong> If you cancel within the first 7 days of a new billing cycle (excluding the free trial period)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">3. Non-Refundable Circumstances</h2>
              <p className="text-muted-foreground font-light leading-relaxed mb-3">Refunds will not be provided in the following situations:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground font-light leading-relaxed">
                <li>Change of mind after the trial period has ended</li>
                <li>Failure to use the service during the billing period</li>
                <li>Violation of our Terms of Service resulting in account termination</li>
                <li>Requests made more than 30 days after the charge</li>
                <li>Partial month usage (subscriptions are billed monthly)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">4. How to Request a Refund</h2>
              <p className="text-muted-foreground font-light leading-relaxed mb-3">To request a refund, please follow these steps:</p>
              <ol className="list-decimal pl-6 space-y-2 text-muted-foreground font-light leading-relaxed">
                <li>Contact our support team at support@aiwholesail.com</li>
                <li>Include your account email and subscription details</li>
                <li>Provide a detailed explanation of why you're requesting a refund</li>
                <li>Our team will review your request within 2-3 business days</li>
                <li>If approved, refunds will be processed within 5-10 business days</li>
              </ol>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">5. Refund Processing</h2>
              <p className="text-muted-foreground font-light leading-relaxed mb-3">
                Approved refunds will be processed through the original payment method used for the
                subscription. The time it takes for the refund to appear in your account depends on
                your payment provider:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground font-light leading-relaxed">
                <li>Credit/Debit Cards: 3-5 business days</li>
                <li>PayPal: 1-2 business days</li>
                <li>Bank Transfers: 5-10 business days</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">6. Subscription Cancellation</h2>
              <p className="text-muted-foreground font-light leading-relaxed mb-3">
                You can cancel your subscription at any time through your account settings or by
                contacting our support team. When you cancel:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground font-light leading-relaxed">
                <li>You'll continue to have access until the end of your current billing period</li>
                <li>No future charges will occur</li>
                <li>Your account will be downgraded to a free tier (if available) after the period ends</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">7. Special Circumstances</h2>
              <p className="text-muted-foreground font-light leading-relaxed mb-3">
                We understand that exceptional circumstances may arise. If you believe your situation
                warrants special consideration, please contact our support team. We review each case
                individually and may offer alternative solutions such as:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground font-light leading-relaxed">
                <li>Account credit for future use</li>
                <li>Temporary account suspension</li>
                <li>Plan downgrade or upgrade</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">8. Dispute Resolution</h2>
              <p className="text-muted-foreground font-light leading-relaxed">
                If you're not satisfied with our refund decision, you may contact your payment provider
                to dispute the charge. Please note that chargebacks may result in the suspension of
                your account and loss of access to our services.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">9. Policy Changes</h2>
              <p className="text-muted-foreground font-light leading-relaxed">
                We reserve the right to modify this refund policy at any time. Any changes will be
                effective immediately upon posting on our website. Continued use of our service
                after changes constitutes acceptance of the new policy.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">10. Contact Information</h2>
              <p className="text-muted-foreground font-light leading-relaxed">
                For refund requests or questions about this policy, please contact us:
                <br />
                Email: support@aiwholesail.com
                <br />
                Response Time: 2-3 business days
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
