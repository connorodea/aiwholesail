import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from "@/contexts/AuthContext";
import { SecurityProvider } from "@/components/SecurityProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { FacebookPixel } from "@/components/FacebookPixel";
import { SEOHead } from "@/components/SEOHead";

// Critical / small pages — keep as static imports
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";

// Lazy-loaded pages — code-split into separate chunks
const Index = lazy(() => import("./pages/Index"));
const RealEstateWholesaler = lazy(() => import("./pages/RealEstateWholesaler"));
const Landing = lazy(() => import("./pages/Landing"));
const Success = lazy(() => import("./pages/Success"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Refund = lazy(() => import("./pages/Refund"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const About = lazy(() => import("./pages/About"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const UseCases = lazy(() => import("./pages/UseCases"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Developers = lazy(() => import("./pages/Developers"));
const Markets = lazy(() => import("./pages/Markets"));
const MarketPage = lazy(() => import("./pages/MarketPage"));
const ComparisonPage = lazy(() => import("./pages/ComparisonPage"));
const Guides = lazy(() => import("./pages/Guides"));
const GuidePage = lazy(() => import("./pages/GuidePage"));
const OffMarket = lazy(() => import("./pages/OffMarket"));
const Analyzer = lazy(() => import("./pages/Analyzer"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Buyers = lazy(() => import("./pages/Buyers"));
const Sequences = lazy(() => import("./pages/Sequences"));
const Contracts = lazy(() => import("./pages/Contracts"));
const Account = lazy(() => import("./pages/Account"));
const ToolsIndex = lazy(() => import("./pages/tools/ToolsIndex"));
const MortgageCalculator = lazy(() => import("./pages/tools/MortgageCalculator"));
const WholesaleDealCalculator = lazy(() => import("./pages/tools/WholesaleDealCalculator"));
const ARVCalculator = lazy(() => import("./pages/tools/ARVCalculator"));
const CashFlowCalculator = lazy(() => import("./pages/tools/CashFlowCalculator"));
const RehabEstimator = lazy(() => import("./pages/tools/RehabEstimator"));
const BRRRRCalculator = lazy(() => import("./pages/tools/BRRRRCalculator"));
const OfferPriceCalculator = lazy(() => import("./pages/tools/OfferPriceCalculator"));
const CapRateCalculator = lazy(() => import("./pages/tools/CapRateCalculator"));
const WholesaleFeeCalculator = lazy(() => import("./pages/tools/WholesaleFeeCalculator"));
const HoldingCostCalculator = lazy(() => import("./pages/tools/HoldingCostCalculator"));
const SeventyPercentRuleCalculator = lazy(() => import("./pages/tools/SeventyPercentRuleCalculator"));
const RentalROICalculator = lazy(() => import("./pages/tools/RentalROICalculator"));
const DSCRCalculator = lazy(() => import("./pages/tools/DSCRCalculator"));
const Glossary = lazy(() => import("./pages/Glossary"));
const GlossaryPage = lazy(() => import("./pages/GlossaryPage"));
const CityStrategyPage = lazy(() => import("./pages/CityStrategyPage"));
const StrategyIndex = lazy(() => import("./pages/StrategyIndex"));
const StatePage = lazy(() => import("./pages/StatePage"));
const DealsHub = lazy(() => import("./pages/DealsHub"));
const DistressIndex = lazy(() => import("./pages/DistressIndex"));
const DistressPage = lazy(() => import("./pages/DistressPage"));
const StateLaws = lazy(() => import("./pages/StateLaws"));
const StateLawPage = lazy(() => import("./pages/StateLawPage"));
const CityComparisons = lazy(() => import("./pages/CityComparisons"));
const CityComparisonPage = lazy(() => import("./pages/CityComparisonPage"));
const Personas = lazy(() => import("./pages/Personas"));
const PersonaPage = lazy(() => import("./pages/PersonaPage"));
const ChecklistsPage = lazy(() => import("./pages/Checklists"));
const ChecklistPage = lazy(() => import("./pages/ChecklistPage"));

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SecurityProvider>
          <TooltipProvider>
            <SEOHead />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <GoogleAnalytics />
              <FacebookPixel />
              <Suspense fallback={<div className="min-h-screen bg-[#08090a]" />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/app" element={
                  <ProtectedRoute>
                    <RealEstateWholesaler />
                  </ProtectedRoute>
                } />
                <Route path="/app/off-market" element={
                  <ProtectedRoute>
                    <OffMarket />
                  </ProtectedRoute>
                } />
                <Route path="/app/analyzer" element={
                  <ProtectedRoute>
                    <Analyzer />
                  </ProtectedRoute>
                } />
                <Route path="/app/favorites" element={
                  <ProtectedRoute>
                    <Favorites />
                  </ProtectedRoute>
                } />
                <Route path="/app/alerts" element={
                  <ProtectedRoute>
                    <Alerts />
                  </ProtectedRoute>
                } />
                <Route path="/app/pipeline" element={
                  <ProtectedRoute>
                    <Pipeline />
                  </ProtectedRoute>
                } />
                <Route path="/app/buyers" element={
                  <ProtectedRoute>
                    <Buyers />
                  </ProtectedRoute>
                } />
                <Route path="/app/sequences" element={
                  <ProtectedRoute>
                    <Sequences />
                  </ProtectedRoute>
                } />
                <Route path="/app/contracts" element={
                  <ProtectedRoute>
                    <Contracts />
                  </ProtectedRoute>
                } />
                <Route path="/app/account" element={
                  <ProtectedRoute>
                    <Account />
                  </ProtectedRoute>
                } />
                <Route path="/auth" element={<Auth />} />
                <Route path="/success" element={<Success />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/refund" element={<Refund />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/about" element={<About />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/use-cases" element={<UseCases />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/developers" element={<Developers />} />
                <Route path="/markets" element={<Markets />} />
                <Route path="/markets/:slug" element={<MarketPage />} />
                <Route path="/vs/:slug" element={<ComparisonPage />} />
                <Route path="/guides" element={<Guides />} />
                <Route path="/guides/:slug" element={<GuidePage />} />
                <Route path="/index" element={<Index />} />
                <Route path="/tools/mortgage-calculator" element={<MortgageCalculator />} />
                <Route path="/tools/wholesale-deal-calculator" element={<WholesaleDealCalculator />} />
                <Route path="/tools/arv-calculator" element={<ARVCalculator />} />
                <Route path="/tools/cash-flow-calculator" element={<CashFlowCalculator />} />
                <Route path="/tools/rehab-estimator" element={<RehabEstimator />} />
                <Route path="/tools/brrrr-calculator" element={<BRRRRCalculator />} />
                <Route path="/tools/offer-price-calculator" element={<OfferPriceCalculator />} />
                <Route path="/tools/cap-rate-calculator" element={<CapRateCalculator />} />
                <Route path="/tools/wholesale-fee-calculator" element={<WholesaleFeeCalculator />} />
                <Route path="/tools/holding-cost-calculator" element={<HoldingCostCalculator />} />
                <Route path="/tools/70-percent-rule-calculator" element={<SeventyPercentRuleCalculator />} />
                <Route path="/tools/rental-roi-calculator" element={<RentalROICalculator />} />
                <Route path="/tools/dscr-calculator" element={<DSCRCalculator />} />
                <Route path="/tools" element={<ToolsIndex />} />
                <Route path="/invest/:strategy/:citySlug" element={<CityStrategyPage />} />
                <Route path="/invest/:strategy" element={<StrategyIndex />} />
                <Route path="/deals" element={<DealsHub />} />
                <Route path="/deals/:distressType" element={<DistressIndex />} />
                <Route path="/deals/:distressType/:citySlug" element={<DistressPage />} />
                <Route path="/glossary" element={<Glossary />} />
                <Route path="/glossary/:slug" element={<GlossaryPage />} />
                <Route path="/states/:stateSlug" element={<StatePage />} />
                <Route path="/laws" element={<StateLaws />} />
                <Route path="/laws/:stateSlug" element={<StateLawPage />} />
                <Route path="/compare" element={<CityComparisons />} />
                <Route path="/compare/:slug" element={<CityComparisonPage />} />
                <Route path="/for" element={<Personas />} />
                <Route path="/for/:slug" element={<PersonaPage />} />
                <Route path="/checklists" element={<ChecklistsPage />} />
                <Route path="/checklists/:slug" element={<ChecklistPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </SecurityProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
