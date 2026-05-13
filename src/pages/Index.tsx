import RealEstateWholesaler from './RealEstateWholesaler';
import { ChatAssistant } from '@/components/ChatAssistant';
import { SEOHead } from '@/components/SEOHead';

const Index = () => {
  return (
    <>
      <SEOHead
        title="AIWholesail — Find Profitable Real Estate Deals Before Everyone Else"
        description="AIWholesail scans thousands of properties daily, scores each deal 0–100 with AI, and alerts you when $30K+ spreads hit the market. Skip tracing, contracts, and 14 free calculators included. Start free, no credit card."
        keywords="AIWholesail, AI real estate, wholesale real estate software, real estate investing AI, property deal finder, motivated seller leads, real estate AI tools"
        canonicalUrl="https://aiwholesail.com"
      />
      <RealEstateWholesaler />
      <ChatAssistant />
    </>
  );
};

export default Index;
