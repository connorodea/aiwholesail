import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

export default function Terms() {
  return (
    <PublicLayout>
      <SEOHead
        title="Terms of Service"
        description="Terms of Service for AIWholesail - AI-powered real estate deal finder platform."
        noIndex={false}
      />

      {/* ===== HERO — DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-6xl px-4 pt-24 pb-20 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <FileText className="h-3 w-3 mr-1.5" /> Legal
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Terms of Service
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
            Please read these terms carefully before using the AIWholesail platform.
          </p>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== CONTENT — LIGHT ===== */}
      <section className="py-24 px-4 bg-[#08090a]">
        <div className="container mx-auto max-w-3xl">
          <p className="text-sm text-neutral-400 font-light mb-12">Last updated: January 8, 2025</p>

          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">1. Acceptance of Terms</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                By accessing and using AIWholesail ("Service"), you accept and agree to be bound by the terms
                and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">2. Description of Service</h2>
              <p className="text-neutral-400 font-light leading-relaxed mb-3">
                AIWholesail is a software platform that provides AI-powered real estate analysis, property search,
                and deal identification tools. Our service includes but is not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>Property search and filtering capabilities</li>
                <li>AI-powered deal analysis and scoring</li>
                <li>Market intelligence and analytics</li>
                <li>Automated property alerts and notifications</li>
                <li>Lead generation and contact information services</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">3. Subscription and Billing</h2>
              <p className="text-neutral-400 font-light leading-relaxed mb-3">
                Our service is offered on a subscription basis with the following terms:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>All plans include a 7-day free trial period</li>
                <li>Subscriptions automatically renew monthly unless cancelled</li>
                <li>You may cancel your subscription at any time through your account settings</li>
                <li>Refunds are handled according to our Refund Policy</li>
                <li>We reserve the right to change pricing with 30 days notice</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">4. Acceptable Use</h2>
              <p className="text-neutral-400 font-light leading-relaxed mb-3">You agree not to use the service to:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the rights of others</li>
                <li>Transmit harmful, offensive, or inappropriate content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use automated systems to scrape or harvest data beyond normal usage</li>
                <li>Resell or redistribute our services without permission</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">5. Data Accuracy and Disclaimers</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                While we strive to provide accurate and up-to-date information, we cannot guarantee the
                accuracy, completeness, or timeliness of all data. Real estate information is provided
                "as is" and users should verify all information independently before making investment decisions.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">6. Intellectual Property</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                The Service and its original content, features, and functionality are and will remain the
                exclusive property of AIWholesail and its licensors. The service is protected by copyright,
                trademark, and other laws.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">7. Privacy</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                Your privacy is important to us. Please review our Privacy Policy, which also governs
                your use of the Service, to understand our practices.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">8. Limitation of Liability</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                In no event shall AIWholesail, nor its directors, employees, partners, agents, suppliers,
                or affiliates, be liable for any indirect, incidental, special, consequential, or punitive
                damages, including without limitation, loss of profits, data, use, goodwill, or other
                intangible losses, resulting from your use of the Service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">9. Termination</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                We may terminate or suspend your access immediately, without prior notice or liability,
                for any reason whatsoever, including without limitation if you breach the Terms.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">10. Contact Information</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:
                <br />
                Email: support@aiwholesail.com
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
