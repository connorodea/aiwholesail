import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  MapPin, Bed, Bath, Square, Calendar, DollarSign,
  TrendingUp, ExternalLink, Trash2, Save, Clock,
} from 'lucide-react';
import { Deal, PipelineStage, PIPELINE_STAGES } from '@/types/pipeline';

interface DealDetailSheetProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
  onStageChange: (dealId: string, stage: PipelineStage) => void;
  onNotesUpdate: (dealId: string, notes: string) => void;
  onRemove: (dealId: string) => void;
}

export function DealDetailSheet({
  deal,
  isOpen,
  onClose,
  onStageChange,
  onNotesUpdate,
  onRemove,
}: DealDetailSheetProps) {
  const [notes, setNotes] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Sync notes when deal changes
  if (deal && notes !== (deal.notes || '') && !isOpen) {
    setNotes(deal.notes || '');
  }

  const handleOpen = (open: boolean) => {
    if (open && deal) {
      setNotes(deal.notes || '');
      setShowConfirmDelete(false);
    }
    if (!open) onClose();
  };

  if (!deal) return null;

  const { propertyData } = deal;
  const spread = deal.spread || 0;
  const currentStage = PIPELINE_STAGES.find(s => s.id === deal.status);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);

  const formatSpread = (val: number) => {
    const abs = Math.abs(val);
    const prefix = val >= 0 ? '+' : '-';
    if (abs >= 1000000) return `${prefix}$${(abs / 1000000).toFixed(2)}M`;
    return `${prefix}$${(abs / 1000).toFixed(0)}K`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <SheetTitle className="text-left text-lg font-semibold tracking-tight">
            Deal Details
          </SheetTitle>

          {/* Stage Selector */}
          <Select
            value={deal.status}
            onValueChange={(val) => onStageChange(deal.id, val as PipelineStage)}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${currentStage?.color || 'bg-muted'}`} />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                    {stage.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Property Header */}
          <div>
            <div className="text-2xl font-bold tracking-tight">
              {propertyData.price ? formatPrice(propertyData.price) : 'Price TBD'}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              {propertyData.address || 'No address'}
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Spread
              </div>
              <div className={`text-lg font-bold ${
                spread >= 30000 ? 'text-green-600' :
                spread > 0 ? 'text-green-500' :
                spread < 0 ? 'text-orange-500' :
                'text-muted-foreground'
              }`}>
                {propertyData.zestimate ? formatSpread(spread) : 'N/A'}
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Zestimate
              </div>
              <div className="text-lg font-bold">
                {propertyData.zestimate ? formatPrice(propertyData.zestimate) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {propertyData.bedrooms != null && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <Bed className="h-4 w-4 text-primary" />
                <span>{propertyData.bedrooms} beds</span>
              </div>
            )}
            {propertyData.bathrooms != null && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <Bath className="h-4 w-4 text-primary" />
                <span>{propertyData.bathrooms} baths</span>
              </div>
            )}
            {propertyData.sqft != null && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <Square className="h-4 w-4 text-primary" />
                <span>{propertyData.sqft.toLocaleString()} sqft</span>
              </div>
            )}
            {propertyData.yearBuilt && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Built {propertyData.yearBuilt}</span>
              </div>
            )}
            {propertyData.daysOnMarket != null && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <Clock className="h-4 w-4 text-primary" />
                <span>{propertyData.daysOnMarket} DOM</span>
              </div>
            )}
            {propertyData.propertyType && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <span className="text-primary text-xs font-medium">Type</span>
                <span className="truncate">{propertyData.propertyType}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this deal..."
              className="min-h-[100px] resize-none"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => onNotesUpdate(deal.id, notes)}
              disabled={notes === (deal.notes || '')}
            >
              <Save className="h-3.5 w-3.5" />
              Save Notes
            </Button>
          </div>

          <Separator />

          {/* Timeline */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Timeline</label>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Added to pipeline: {new Date(deal.createdAt).toLocaleDateString()}
              </div>
              {deal.updatedAt !== deal.createdAt && (
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${currentStage?.color || 'bg-muted'}`} />
                  Last updated: {new Date(deal.updatedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {propertyData.address && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 justify-start"
                onClick={() =>
                  window.open(
                    `https://www.zillow.com/homes/${encodeURIComponent(propertyData.address)}_rb/`,
                    '_blank'
                  )
                }
              >
                <ExternalLink className="h-4 w-4" />
                View on Zillow
              </Button>
            )}

            {!showConfirmDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Remove from Pipeline
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 flex-1"
                  onClick={() => {
                    onRemove(deal.id);
                    onClose();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Confirm Remove
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
