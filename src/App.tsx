import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from "@/contexts/AuthContext";
import { SecurityProvider } from "@/components/SecurityProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { FacebookPixel } from "@/components/FacebookPixel";
import { SEOHead } from "@/components/SEOHead";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import RealEstateWholesaler from "./pages/RealEstateWholesaler";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Success from "./pages/Success";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Refund from "./pages/Refund";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import UseCases from "./pages/UseCases";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import OffMarket from "./pages/OffMarket";
import Analyzer from "./pages/Analyzer";
import Favorites from "./pages/Favorites";
import Alerts from "./pages/Alerts";
import Pipeline from "./pages/Pipeline";
import Buyers from "./pages/Buyers";
import Sequences from "./pages/Sequences";
import Contracts from "./pages/Contracts";
import Account from "./pages/Account";
import ToolsIndex from "./pages/tools/ToolsIndex";
import MortgageCalculator from "./pages/tools/MortgageCalculator";
import WholesaleDealCalculator from "./pages/tools/WholesaleDealCalculator";
import ARVCalculator from "./pages/tools/ARVCalculator";
import CashFlowCalculator from "./pages/tools/CashFlowCalculator";
import RehabEstimator from "./pages/tools/RehabEstimator";
import BRRRRCalculator from "./pages/tools/BRRRRCalculator";
import OfferPriceCalculator from "./pages/tools/OfferPriceCalculator";
import CapRateCalculator from "./pages/tools/CapRateCalculator";

const queryClient = new QueryClient();

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
              <GoogleAnalytics />
              <FacebookPixel />
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
                <Route path="/index" element={<Index />} />
                <Route path="/tools/mortgage-calculator" element={<MortgageCalculator />} />
                <Route path="/tools/wholesale-deal-calculator" element={<WholesaleDealCalculator />} />
                <Route path="/tools/arv-calculator" element={<ARVCalculator />} />
                <Route path="/tools/cash-flow-calculator" element={<CashFlowCalculator />} />
                <Route path="/tools/rehab-estimator" element={<RehabEstimator />} />
                <Route path="/tools/brrrr-calculator" element={<BRRRRCalculator />} />
                <Route path="/tools/offer-price-calculator" element={<OfferPriceCalculator />} />
                <Route path="/tools/cap-rate-calculator" element={<CapRateCalculator />} />
                <Route path="/tools" element={<ToolsIndex />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SecurityProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
