import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

export default function Privacy() {
  return (
    <PublicLayout>
      <SEOHead
        title="Privacy Policy"
        description="Privacy Policy for AIWholesail - Learn how we protect and handle your personal information."
        noIndex={false}
      />

      {/* ===== HERO — DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-6xl px-4 pt-24 pb-20 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <Shield className="h-3 w-3 mr-1.5" /> Legal
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Privacy Policy
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
            We are committed to protecting your privacy and being transparent about how we handle your information.
          </p>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-[#08090a]" />
      </section>

      {/* ===== CONTENT — LIGHT ===== */}
      <section className="py-24 px-4 bg-[#08090a]">
        <div className="container mx-auto max-w-3xl">
          <p className="text-sm text-neutral-400 font-light mb-12">Last updated: January 8, 2025</p>

          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">1. Introduction</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                AIWholesail ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you visit our website
                and use our services.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">2. Information We Collect</h2>

              <h3 className="text-lg font-bold tracking-tight mb-3">Personal Information</h3>
              <p className="text-neutral-400 font-light leading-relaxed mb-3">We may collect personal information that you voluntarily provide to us when you:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>Register for an account</li>
                <li>Subscribe to our service</li>
                <li>Contact us for support</li>
                <li>Participate in surveys or promotions</li>
              </ul>
              <p className="text-neutral-400 font-light leading-relaxed mt-4 mb-3">This information may include:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>Name and contact information</li>
                <li>Email address</li>
                <li>Payment information (processed securely by Stripe)</li>
                <li>Profile information and preferences</li>
              </ul>

              <h3 className="text-lg font-bold tracking-tight mb-3 mt-8">Usage Information</h3>
              <p className="text-neutral-400 font-light leading-relaxed mb-3">We automatically collect certain information when you use our service:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>IP address and location data</li>
                <li>Device and browser information</li>
                <li>Usage patterns and interactions with our service</li>
                <li>Search queries and property preferences</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">3. How We Use Your Information</h2>
              <p className="text-neutral-400 font-light leading-relaxed mb-3">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>Provide and maintain our service</li>
                <li>Process transactions and manage subscriptions</li>
                <li>Send property alerts and notifications</li>
                <li>Provide customer support</li>
                <li>Improve our service and develop new features</li>
                <li>Comply with legal obligations</li>
                <li>Send marketing communications (with your consent)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">4. Information Sharing and Disclosure</h2>
              <p className="text-neutral-400 font-light leading-relaxed mb-3">We do not sell or rent your personal information to third parties. We may share your information in the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>With service providers who assist in our operations (e.g., payment processing, email delivery)</li>
                <li>When required by law or to protect our rights</li>
                <li>In connection with a business transfer or merger</li>
                <li>With your explicit consent</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">5. Data Security</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal
                information against unauthorized access, alteration, disclosure, or destruction. However, no
                method of transmission over the internet is 100% secure.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">6. Your Rights and Choices</h2>
              <p className="text-neutral-400 font-light leading-relaxed mb-3">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-neutral-400 font-light leading-relaxed">
                <li>Access and update your personal information</li>
                <li>Delete your account and personal data</li>
                <li>Opt out of marketing communications</li>
                <li>Request a copy of your data</li>
                <li>Restrict processing of your data</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">7. Cookies and Tracking Technologies</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our service and hold
                certain information. You can instruct your browser to refuse all cookies or to indicate
                when a cookie is being sent.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">8. Third-Party Services</h2>
              <p className="text-neutral-400 font-light leading-relaxed">Our service may contain links to third-party websites or integrate with third-party services. We are not responsible for the privacy practices of these third parties.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">9. Children's Privacy</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                Our service is not intended for use by children under the age of 13. We do not knowingly
                collect personal information from children under 13.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">10. Changes to This Privacy Policy</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes by
                posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">11. Contact Us</h2>
              <p className="text-neutral-400 font-light leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at:
                <br />
                Email: privacy@aiwholesail.com
                <br />
                Mail: AIWholesail Privacy Team
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
