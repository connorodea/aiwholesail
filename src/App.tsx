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
