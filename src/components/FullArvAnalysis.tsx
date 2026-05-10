import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Zap, Calculator, Wand2, Award, ArrowRight, Crown } from 'lucide-react';
import type { Property } from '@/types/zillow';
import { useSubscription } from '@/hooks/useSubscription';
import { AIRankedComps } from './AIRankedComps';
import { ListingDescriptionPanel } from './ListingDescriptionGenerator';
import { generateBuyerPitch } from './BuyerPitchPDF';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { analytics } from '@/lib/analytics';

/**
 * Phase 1.4 — "Run Full ARV Analysis" single-button bundle.
 *
 * The ChatARV-parity headline demo. Compresses the four building blocks
 * we shipped over Phase 1.1–1.5 into one CTA:
 *
 *  • AI-ranked top-6 comps with reasoning + adjustments  (Phase 1.1)
 *  • As-Is + ARV + Rehab Headroom headline cards         (Phase 1.2)
 *  • Live deal-math sliders (MAO / repair / fee)         (Phase 1.3)
 *  • AI listing description (auto-runs on open)          (Phase 1.5)
 *  • Buyer-pitch PDF export button                       (shipped earlier)
 *
 * Mounted from PropertyModal via a single "Full ARV Analysis" button.
 * Embeds AIRankedComps and ListingDescriptionPanel side by side — both
 * components fire their own backend calls (rank-comps + listing-desc)
 * concurrently when the dialog opens.
 */

interface FullArvAnalysisProps {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FullArvAnalysis({ property, open, onOpenChange }: FullArvAnalysisProps) {
  const { isElite, isPro } = useSubscription();
  const { user } = useAuth();
  const allowed = isElite || isPro;

  // Don't auto-fire on closed dialog (saves a wasted API call if the
  // user opens then immediately closes). We keep state so reopening
  // doesn't re-run unless they explicitly Regenerate.
  const [hasRun, setHasRun] = useState(false);

  // The user clicked "Run Full ARV Analysis" — this is what kicks both
  // backend calls (rank-comps + listing-description) at the same time
  // by mounting the two child components below.
  const handleRun = () => {
    if (!allowed) {
      toast.error('Full ARV Analysis is a Pro / Elite feature.');
      return;
    }
    setHasRun(true);
    analytics.dataExport?.('full-arv-analysis', 1);
  };

  const handleBuyerPitch = () => {
    generateBuyerPitch(property, {
      wholesalerName: user?.fullName || user?.email?.split('@')[0],
      wholesalerEmail: user?.email,
    });
    analytics.dataExport?.('buyer-pitch-pdf', 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-auto p-0 bg-[#0c0d0f] border-neutral-800">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 flex-wrap">
                <Zap className="h-5 w-5 text-cyan-400 shrink-0" />
                Full ARV Analysis
                <Badge variant="secondary" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Pro / Elite
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm mt-1">
                {property.address} — AI-picked comps, deal math, and marketing copy in one pass.
              </DialogDescription>
            </div>
            {hasRun && allowed && (
              <Button onClick={handleBuyerPitch} size="sm" variant="outline" className="gap-1.5 shrink-0 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10">
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">Export Buyer PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="p-5 sm:p-6 space-y-6">
          {!allowed && (
            <Card className="border-cyan-500/30 bg-cyan-500/[0.04]">
              <CardContent className="p-5 text-center space-y-3">
                <Crown className="h-8 w-8 text-cyan-400 mx-auto" />
                <h3 className="font-semibold">Full ARV Analysis is a Pro / Elite feature</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  One click runs AI comp selection, deal math, and listing copy generation against this property. Pro and Elite both include it.
                </p>
                <Button asChild>
                  <a href="/pricing">View plans</a>
                </Button>
              </CardContent>
            </Card>
          )}

          {allowed && !hasRun && (
            <Card className="border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.04] to-transparent">
              <CardContent className="p-6 text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-cyan-400">
                  <Zap className="h-6 w-6" />
                  <span className="text-sm font-medium tracking-wide uppercase">Single-click analysis</span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight">Run full deal analysis on this property</h3>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                  In about 60 seconds, AI will:
                </p>
                <ul className="text-sm text-muted-foreground max-w-md mx-auto space-y-1 text-left">
                  <li className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-cyan-400" /> Pick the 6 best comparable sales with reasoning</li>
                  <li className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-cyan-400" /> Calculate As-Is value, ARV, and rehab headroom</li>
                  <li className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-cyan-400" /> Surface adjustable deal math (MAO, repair, fee)</li>
                  <li className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-cyan-400" /> Write marketing copy tuned to your buyer audience</li>
                </ul>
                <Button onClick={handleRun} size="lg" className="gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold mt-2">
                  <Zap className="h-4 w-4" />
                  Run Full ARV Analysis
                </Button>
              </CardContent>
            </Card>
          )}

          {allowed && hasRun && (
            <>
              {/* Section A — AI comp analysis (reuses the existing component which
                  fires its own /api/ai/rank-comps call on mount). The component
                  already renders headline cards, ranked comps, and deal-math sliders. */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-cyan-400" />
                  Step 1 · Comps + ARV + deal math
                </h2>
                <AIRankedComps property={property} />
              </section>

              <Separator className="bg-border/40" />

              {/* Section B — AI listing copy (auto-fires on mount via panel's
                  autoGenerate prop, so the user doesn't have to click again). */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-cyan-400" />
                  Step 2 · Marketing copy
                </h2>
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Listing description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ListingDescriptionPanel property={property} autoGenerate />
                  </CardContent>
                </Card>
              </section>

              {/* Footer CTA — close the loop with a single "send it" button */}
              <Card className="border-cyan-500/30 bg-cyan-500/[0.04]">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Ready to share this deal?</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Export the buyer pitch PDF with comps, ARV, and your offer math.</p>
                  </div>
                  <Button onClick={handleBuyerPitch} className="gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shrink-0">
                    <Award className="h-4 w-4" />
                    Export Buyer Pitch PDF
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
