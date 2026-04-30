import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead 
        title="Terms of Service"
        description="Terms of Service for AIWholesail - AI-powered real estate deal finder platform."
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
              <div className="text-lg font-semibold">Terms of Service</div>
              <div className="w-20"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-8">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mb-8">Last updated: January 8, 2025</p>

            <div className="prose prose-lg max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using AI Wholesail ("Service"), you accept and agree to be bound by the terms 
                  and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
                <p>
                  AI Wholesail is a software platform that provides AI-powered real estate analysis, property search, 
                  and deal identification tools. Our service includes but is not limited to:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Property search and filtering capabilities</li>
                  <li>AI-powered deal analysis and scoring</li>
                  <li>Market intelligence and analytics</li>
                  <li>Automated property alerts and notifications</li>
                  <li>Lead generation and contact information services</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Subscription and Billing</h2>
                <p>
                  Our service is offered on a subscription basis with the following terms:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>All plans include a 7-day free trial period</li>
                  <li>Subscriptions automatically renew monthly unless cancelled</li>
                  <li>You may cancel your subscription at any time through your account settings</li>
                  <li>Refunds are handled according to our Refund Policy</li>
                  <li>We reserve the right to change pricing with 30 days notice</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
                <p>You agree not to use the service to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe on the rights of others</li>
                  <li>Transmit harmful, offensive, or inappropriate content</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Use automated systems to scrape or harvest data beyond normal usage</li>
                  <li>Resell or redistribute our services without permission</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Data Accuracy and Disclaimers</h2>
                <p>
                  While we strive to provide accurate and up-to-date information, we cannot guarantee the 
                  accuracy, completeness, or timeliness of all data. Real estate information is provided 
                  "as is" and users should verify all information independently before making investment decisions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
                <p>
                  The Service and its original content, features, and functionality are and will remain the 
                  exclusive property of AI Wholesail and its licensors. The service is protected by copyright, 
                  trademark, and other laws.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Privacy</h2>
                <p>
                  Your privacy is important to us. Please review our Privacy Policy, which also governs 
                  your use of the Service, to understand our practices.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
                <p>
                  In no event shall AI Wholesail, nor its directors, employees, partners, agents, suppliers, 
                  or affiliates, be liable for any indirect, incidental, special, consequential, or punitive 
                  damages, including without limitation, loss of profits, data, use, goodwill, or other 
                  intangible losses, resulting from your use of the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
                <p>
                  We may terminate or suspend your access immediately, without prior notice or liability, 
                  for any reason whatsoever, including without limitation if you breach the Terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Contact Information</h2>
                <p>
                  If you have any questions about these Terms of Service, please contact us at:
                  <br />
                  Email: support@aiwholesail.com
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}