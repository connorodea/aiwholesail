import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead 
        title="Privacy Policy"
        description="Privacy Policy for AI Wholesail - Learn how we protect and handle your personal information."
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
              <div className="text-lg font-semibold">Privacy Policy</div>
              <div className="w-20"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-8">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-8">Last updated: January 8, 2025</p>

            <div className="prose prose-lg max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p>
                  AI Wholesail ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
                  explains how we collect, use, disclose, and safeguard your information when you visit our website 
                  and use our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-medium mb-3">Personal Information</h3>
                <p>We may collect personal information that you voluntarily provide to us when you:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Register for an account</li>
                  <li>Subscribe to our service</li>
                  <li>Contact us for support</li>
                  <li>Participate in surveys or promotions</li>
                </ul>
                <p className="mt-3">This information may include:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Name and contact information</li>
                  <li>Email address</li>
                  <li>Payment information (processed securely by Stripe)</li>
                  <li>Profile information and preferences</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 mt-6">Usage Information</h3>
                <p>We automatically collect certain information when you use our service:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>IP address and location data</li>
                  <li>Device and browser information</li>
                  <li>Usage patterns and interactions with our service</li>
                  <li>Search queries and property preferences</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Provide and maintain our service</li>
                  <li>Process transactions and manage subscriptions</li>
                  <li>Send property alerts and notifications</li>
                  <li>Provide customer support</li>
                  <li>Improve our service and develop new features</li>
                  <li>Comply with legal obligations</li>
                  <li>Send marketing communications (with your consent)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Information Sharing and Disclosure</h2>
                <p>We do not sell or rent your personal information to third parties. We may share your information in the following circumstances:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>With service providers who assist in our operations (e.g., payment processing, email delivery)</li>
                  <li>When required by law or to protect our rights</li>
                  <li>In connection with a business transfer or merger</li>
                  <li>With your explicit consent</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
                <p>
                  We implement appropriate technical and organizational security measures to protect your personal 
                  information against unauthorized access, alteration, disclosure, or destruction. However, no 
                  method of transmission over the internet is 100% secure.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Your Rights and Choices</h2>
                <p>You have the right to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Access and update your personal information</li>
                  <li>Delete your account and personal data</li>
                  <li>Opt out of marketing communications</li>
                  <li>Request a copy of your data</li>
                  <li>Restrict processing of your data</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking Technologies</h2>
                <p>
                  We use cookies and similar tracking technologies to track activity on our service and hold 
                  certain information. You can instruct your browser to refuse all cookies or to indicate 
                  when a cookie is being sent.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Third-Party Services</h2>
                <p>Our service may contain links to third-party websites or integrate with third-party services. We are not responsible for the privacy practices of these third parties.</p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
                <p>
                  Our service is not intended for use by children under the age of 13. We do not knowingly 
                  collect personal information from children under 13.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Changes to This Privacy Policy</h2>
                <p>
                  We may update our Privacy Policy from time to time. We will notify you of any changes by 
                  posting the new Privacy Policy on this page and updating the "Last updated" date.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
                <p>
                  If you have any questions about this Privacy Policy, please contact us at:
                  <br />
                  Email: privacy@aiwholesail.com
                  <br />
                  Mail: AI Wholesail Privacy Team
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}