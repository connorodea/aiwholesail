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
import OffMarket from "./pages/OffMarket";
import Analyzer from "./pages/Analyzer";
import Favorites from "./pages/Favorites";
import Alerts from "./pages/Alerts";
import Pipeline from "./pages/Pipeline";
import Buyers from "./pages/Buyers";
import Sequences from "./pages/Sequences";

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
                <Route path="/auth" element={<Auth />} />
                <Route path="/success" element={<Success />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/refund" element={<Refund />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/index" element={<Index />} />
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
