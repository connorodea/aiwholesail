import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, Copy, Wand2, CheckCircle2 } from 'lucide-react';
import { ai } from '@/lib/api-client';
import { useSubscription } from '@/hooks/useSubscription';
import type { Property } from '@/types/zillow';

/**
 * Generates AI marketing copy for a property — Pro 25/mo, Elite unlimited.
 *
 * Phase 1.5 of ChatARV parity. Tone selector lets the wholesaler pick
 * the audience (cash buyer / flipper / landlord / retail). The output
 * is structured (headline + body + bullets) so it can drop into the
 * BuyerPitchPDF or be copied straight into Zillow / Facebook / Craigslist.
 */

type Tone = 'wholesaler' | 'flipper' | 'rental' | 'agent';

interface ListingResult {
  headline: string;
  description: string;
  bullets: string[];
  tone: string;
}

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: 'wholesaler', label: 'Wholesaler → cash buyers', hint: 'Spread, motivation, quick close' },
  { value: 'flipper',    label: 'Flipper',                   hint: 'ARV, rehab opportunity' },
  { value: 'rental',     label: 'Landlord / BRRRR',          hint: 'Cash flow, cap rate' },
  { value: 'agent',      label: 'Retail buyer',              hint: 'Lifestyle, move-in feel' },
];

interface ListingDescriptionGeneratorProps {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ListingDescriptionGenerator({ property, open, onOpenChange }: ListingDescriptionGeneratorProps) {
  const { isElite, isPro } = useSubscription();
  const allowed = isElite || isPro;

  const [tone, setTone] = useState<Tone>('wholesaler');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ListingResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!allowed) {
      toast.error('AI Listing Description is a Pro / Elite feature.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await ai.listingDescription({
        property: {
          address: property.address,
          price: property.price,
          zestimate: property.zestimate,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          sqft: property.sqft,
          yearBuilt: property.yearBuilt,
          lotSize: property.lotSize,
          propertyType: property.propertyType,
          isFSBO: property.isFSBO,
          status: property.status,
          daysOnMarket: property.daysOnMarket,
          description: property.description,
        },
        tone,
      });
      if (r.error) {
        toast.error(r.error, {
          description:
            r.code === 'TIER_REQUIRED'
              ? 'Upgrade to Pro or Elite to generate listing copy.'
              : r.code === 'QUOTA_EXCEEDED'
                ? 'Monthly Pro quota reached. Upgrade to Elite for unlimited.'
                : undefined,
        });
        return;
      }
      if (r.data) {
        setResult({
          headline: r.data.headline,
          description: r.data.description,
          bullets: r.data.bullets,
          tone: r.data.tone,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      toast.error('Copy failed — select + copy manually');
    }
  };

  const fullText = result
    ? `${result.headline}\n\n${result.description}\n\nKey points:\n${result.bullets.map((b) => `• ${b}`).join('\n')}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-cyan-400" />
            AI Listing Description
            <Badge variant="secondary" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Pro / Elite
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Generate marketing copy tuned to your audience. Drop it into Zillow, Facebook, Craigslist, or your buyer-pitch deck.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tone picker */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Audience tone</div>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={`text-left rounded-lg border p-2.5 transition-colors ${
                    tone === t.value
                      ? 'border-cyan-500/40 bg-cyan-500/[0.04]'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <div className="text-xs font-medium">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={loading || !allowed}
            className="w-full gap-2"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Writing…</>
            ) : (
              <><Wand2 className="h-4 w-4" /> {result ? 'Regenerate' : 'Generate'}</>
            )}
          </Button>
          {!allowed && (
            <p className="text-[11px] text-muted-foreground text-center">
              Pro: 25 generations/month · Elite: unlimited
            </p>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3 pt-2">
              <Card className="border-cyan-500/30 bg-cyan-500/[0.04]">
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
                  <CardTitle className="text-sm">Headline</CardTitle>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => copyToClipboard(result.headline, 'Headline')}
                    className="h-6 px-2 gap-1 text-[11px]"
                  >
                    {copiedField === 'Headline' ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </Button>
                </CardHeader>
                <CardContent className="text-base font-medium text-foreground">
                  {result.headline}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
                  <CardTitle className="text-sm">Description</CardTitle>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => copyToClipboard(result.description, 'Description')}
                    className="h-6 px-2 gap-1 text-[11px]"
                  >
                    {copiedField === 'Description' ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </Button>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed whitespace-pre-wrap">
                  {result.description}
                </CardContent>
              </Card>

              {result.bullets.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
                    <CardTitle className="text-sm">Key points</CardTitle>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => copyToClipboard(result.bullets.map((b) => `• ${b}`).join('\n'), 'Bullets')}
                      className="h-6 px-2 gap-1 text-[11px]"
                    >
                      {copiedField === 'Bullets' ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {result.bullets.map((b, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-cyan-400 mt-1">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={() => copyToClipboard(fullText, 'Full copy')}
                variant="outline"
                className="w-full gap-2"
              >
                {copiedField === 'Full copy' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy full listing (headline + description + bullets)
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
