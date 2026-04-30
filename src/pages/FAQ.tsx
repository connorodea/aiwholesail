import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, ArrowRight, Shield, CheckCircle, Sparkles, HelpCircle } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
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
      question: 'What is AIWholesail and how does it work?',
      answer: 'AIWholesail is an AI-powered platform that helps real estate professionals find profitable deals. We use machine learning to analyze property data, market trends, and investment potential to identify undervalued properties. Our platform searches multiple data sources, provides automated deal analysis, and sends you alerts when properties match your criteria.'
    },
    {
      question: 'How does the 7-day free trial work?',
      answer: 'When you sign up for any plan, you get 7 days of full access to all features -- no credit card required. Just create an account and start finding deals immediately. You can upgrade to a paid plan anytime.'
    },
    {
      question: "What's the difference between Pro and Elite plans?",
      answer: 'Pro ($29/month) includes up to 5 alert locations, 24-hour updates, and basic analytics. Elite ($99/month) offers unlimited locations, 4-hour updates, advanced AI analysis, skip tracing, lead scoring, and priority support. Elite is designed for serious professionals who need more comprehensive tools.'
    },
    {
      question: 'How accurate is the property data and AI analysis?',
      answer: 'We source data from multiple listing systems and public records, updating it regularly. Our AI analysis is based on current market conditions, comparable sales, and proven investment metrics. While we strive for accuracy, we always recommend verifying information independently before making investment decisions.'
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time through your account settings or by contacting support. You will continue to have access until the end of your current billing period, and no future charges will occur.'
    },
    {
      question: 'Do you offer refunds?',
      answer: "We offer refunds for technical issues we can't resolve, billing errors, or if you cancel within 7 days of a new billing cycle. Refunds are not available for change of mind after the trial period. See our Refund Policy for complete details."
    },
    {
      question: 'What types of properties can I search for?',
      answer: 'You can search for residential properties including single-family homes, condos, townhouses, and multi-family properties (2-4 units). Our platform specializes in finding undervalued properties, foreclosures, estate sales, and other investment opportunities.'
    },
    {
      question: 'How do property alerts work?',
      answer: 'You set up custom search criteria (location, price range, property type, etc.) and our system continuously monitors for matching properties. When new listings appear that meet your criteria, we send you instant email notifications with full property details and analysis.'
    },
    {
      question: 'Is skip tracing included?',
      answer: 'Skip tracing is included with Elite plans and allows you to find contact information for property owners. This feature helps you connect directly with motivated sellers for off-market opportunities.'
    },
    {
      question: 'Can I use AIWholesail in my area?',
      answer: 'We cover most major metropolitan areas in the United States. Our data sources include multiple listing systems, public records, and other real estate databases. Contact us if you are unsure about coverage in your specific market.'
    },
    {
      question: 'How does the AI deal scoring work?',
      answer: 'Our AI analyzes multiple factors including purchase price, estimated repairs, market value, market demand, days on market, and comparable sales. It then assigns a score from 1-100, with higher scores indicating better profit potential.'
    },
    {
      question: 'Can I export my leads and data?',
      answer: 'Yes, you can export your saved properties, leads, and contact information to CSV files for use in your other business tools. This feature is available on both Pro and Elite plans.'
    },
    {
      question: 'What kind of support do you provide?',
      answer: 'We offer email support for all users with response times within 24 hours. Elite plan subscribers get priority support with faster response times. We also provide onboarding assistance and training resources.'
    },
    {
      question: 'Is my data secure and private?',
      answer: 'Yes, we take data security seriously. All data is encrypted in transit and at rest. We comply with industry security standards and never share your personal information with third parties without your consent. See our Privacy Policy for details.'
    },
    {
      question: 'Can I integrate AIWholesail with my existing tools?',
      answer: 'Currently, we offer data export capabilities. We are actively working on integrations with popular business tools and are open to discussing specific integration needs for our customers.'
    }
  ];

  return (
    <PublicLayout>
      <SEOHead
        title="Frequently Asked Questions"
        description="Get answers to common questions about AIWholesail - pricing, features, trials, and how our AI-powered real estate deal-finding platform works."
        noIndex={false}
      />

      {/* ===== HERO -- DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-6xl px-4 pt-28 pb-20 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <HelpCircle className="h-3 w-3 mr-1.5" /> We Have Answers
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[0.95] mb-6">
            Frequently asked
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              questions.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
            Everything you need to know about AIWholesail. Can not find your answer here?{' '}
            <Link to="/contact" className="text-primary hover:underline">
              Reach out to our support team
            </Link>.
          </p>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== FAQ ACCORDION -- LIGHT ===== */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Common Questions</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-16">
            Get the answers you need.
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white/[0.03] border border-white/[0.06] rounded-3xl overflow-hidden transition-all duration-300 hover:border-primary/20"
              >
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-8 py-6 text-left flex items-center justify-between gap-4"
                >
                  <h3 className="text-base font-semibold tracking-tight pr-4">{faq.question}</h3>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    openItems.includes(index) ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    {openItems.includes(index) ? (
                      <Minus className="h-4 w-4 text-primary" />
                    ) : (
                      <Plus className="h-4 w-4 text-neutral-400" />
                    )}
                  </div>
                </button>

                {openItems.includes(index) && (
                  <div className="px-8 pb-6">
                    <p className="text-neutral-400 font-light leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STILL HAVE QUESTIONS -- DARK ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Still have questions?
          </h2>
          <p className="text-lg text-white/60 font-light max-w-xl mx-auto mb-10">
            Our support team is here to help you get the most out of AIWholesail.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact">
              <Button size="lg" className="rounded-full px-8 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2">
                Contact Support <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="rounded-full px-8 text-base font-semibold border-white/20 text-white hover:bg-white/10">
                Start Free Trial
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-white/40 mt-8">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> Cancel Anytime</span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
