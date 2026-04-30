import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useState } from 'react';

export default function FAQ() {
  const [openItems, setOpenItems] = useState<number[]>([0]); // First item open by default

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const faqs = [
    {
      question: "What is AIWholesail and how does it work?",
      answer: "AIWholesail is an AI-powered platform that helps real estate professionals find profitable deals. We use machine learning to analyze property data, market trends, and investment potential to identify undervalued properties. Our platform searches multiple data sources, provides automated deal analysis, and sends you alerts when properties match your criteria."
    },
    {
      question: "How does the 7-day free trial work?",
      answer: "When you sign up for any plan, you get 7 days of full access to all features — no credit card required. Just create an account and start finding deals immediately. You can upgrade to a paid plan anytime."
    },
    {
      question: "What's the difference between Pro and Elite plans?",
      answer: "Pro ($29/month) includes up to 5 alert locations, 24-hour updates, and basic analytics. Elite ($99/month) offers unlimited locations, 4-hour updates, advanced AI analysis, skip tracing, lead scoring, and priority support. Elite is designed for serious professionals who need more comprehensive tools."
    },
    {
      question: "How accurate is the property data and AI analysis?",
      answer: "We source data from multiple MLS systems and public records, updating it regularly. Our AI analysis is based on current market conditions, comparable sales, and proven investment metrics. While we strive for accuracy, we always recommend verifying information independently before making investment decisions."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time through your account settings or by contacting support. You'll continue to have access until the end of your current billing period, and no future charges will occur."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer refunds for technical issues we can't resolve, billing errors, or if you cancel within 7 days of a new billing cycle. Refunds are not available for change of mind after the trial period. See our Refund Policy for complete details."
    },
    {
      question: "What types of properties can I search for?",
      answer: "You can search for residential properties including single-family homes, condos, townhouses, and multi-family properties (2-4 units). Our platform specializes in finding undervalued properties, foreclosures, estate sales, and other investment opportunities."
    },
    {
      question: "How do property alerts work?",
      answer: "You set up custom search criteria (location, price range, property type, etc.) and our system continuously monitors for matching properties. When new listings appear that meet your criteria, we send you instant email notifications with full property details and analysis."
    },
    {
      question: "Is skip tracing included?",
      answer: "Skip tracing is included with Elite plans and allows you to find contact information for property owners. This feature helps you connect directly with motivated sellers for off-market opportunities."
    },
    {
      question: "Can I use AIWholesail in my area?",
      answer: "We cover most major metropolitan areas in the United States. Our data sources include MLS systems, public records, and other real estate databases. Contact us if you're unsure about coverage in your specific market."
    },
    {
      question: "How does the AI deal scoring work?",
      answer: "Our AI analyzes multiple factors including purchase price, estimated repairs, after-repair value (ARV), market demand, days on market, and comparable sales. It then assigns a score from 1-100, with higher scores indicating better profit potential."
    },
    {
      question: "Can I export my leads and data?",
      answer: "Yes, you can export your saved properties, leads, and contact information to CSV files for use in your CRM or other tools. This feature is available on both Pro and Elite plans."
    },
    {
      question: "What kind of support do you provide?",
      answer: "We offer email support for all users with response times within 24 hours. Elite plan subscribers get priority support with faster response times. We also provide onboarding assistance and training resources."
    },
    {
      question: "Is my data secure and private?",
      answer: "Yes, we take data security seriously. All data is encrypted in transit and at rest. We comply with industry security standards and never share your personal information with third parties without your consent. See our Privacy Policy for details."
    },
    {
      question: "Can I integrate AIWholesail with my existing tools?",
      answer: "Currently, we offer data export capabilities. We're working on API integrations with popular CRM systems and are open to discussing specific integration needs for Enterprise customers."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead 
        title="Frequently Asked Questions"
        description="Get answers to common questions about AIWholesail - pricing, features, trials, and how our AI-powered real estate deal-finding platform works."
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
              <div className="text-lg font-semibold">FAQ</div>
              <div className="w-20"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions about AIWholesail. Can't find what you're looking for? 
              <Link to="/contact" className="text-primary hover:underline ml-1">Contact our support team</Link>.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-card border border-border/50 rounded-2xl shadow-lg overflow-hidden">
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <h3 className="text-lg font-medium pr-4">{faq.question}</h3>
                  {openItems.includes(index) ? (
                    <Minus className="h-5 w-5 text-primary flex-shrink-0" />
                  ) : (
                    <Plus className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </button>
                
                {openItems.includes(index) && (
                  <div className="px-6 pb-4">
                    <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Still have questions */}
          <div className="mt-12 text-center bg-primary/5 border border-primary/20 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
            <p className="text-muted-foreground mb-6">
              Our support team is here to help you get the most out of AIWholesail.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/contact">
                <Button className="w-full sm:w-auto">Contact Support</Button>
              </Link>
              <Link to="/pricing">
                <Button variant="outline" className="w-full sm:w-auto">Start Free Trial</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}