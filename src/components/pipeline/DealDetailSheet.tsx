import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MapPin, Bed, Bath, Square, Calendar, DollarSign,
  TrendingUp, ExternalLink, Trash2, Save, Clock, X, Home,
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
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);

  const formatSpread = (val: number) => {
    const abs = Math.abs(val);
    const prefix = val >= 0 ? '+' : '-';
    if (abs >= 1000000) return `${prefix}$${(abs / 1000000).toFixed(2)}M`;
    return `${prefix}$${(abs / 1000).toFixed(0)}K`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl w-full p-0 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#0c0d0f', borderColor: 'rgba(255,255,255,0.08)', color: '#fff' }}>
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
            <X className="h-4 w-4 text-neutral-400" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Home className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {propertyData.price ? formatPrice(propertyData.price) : 'Price TBD'}
              </div>
              <p className="text-sm text-neutral-400 flex items-center gap-1.5 mt-1 truncate">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {propertyData.address || 'No address'}
              </p>
            </div>
          </div>

          {/* Stage selector */}
          <div className="mt-4">
            <Select value={deal.status} onValueChange={(val) => onStageChange(deal.id, val as PipelineStage)}>
              <SelectTrigger className="w-full bg-white/[0.03] border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${currentStage?.color || 'bg-neutral-500'}`} />
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
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Spread</div>
              <div className={`text-lg font-bold ${
                spread >= 30000 ? 'text-green-400' : spread > 0 ? 'text-green-500' : spread < 0 ? 'text-orange-400' : 'text-neutral-500'
              }`}>
                {propertyData.zestimate ? formatSpread(spread) : 'N/A'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Zestimate</div>
              <div className="text-lg font-bold text-white">
                {propertyData.zestimate ? formatPrice(propertyData.zestimate) : 'N/A'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Score</div>
              <div className="text-lg font-bold text-cyan-400">
                {deal.overallScore ?? 'N/A'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">DOM</div>
              <div className="text-lg font-bold text-white">
                {propertyData.daysOnMarket ?? 'N/A'}
              </div>
            </div>
          </div>

          {/* Property specs */}
          <div className="flex flex-wrap gap-3">
            {propertyData.bedrooms != null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-300">
                <Bed className="h-3.5 w-3.5 text-cyan-400" /> {propertyData.bedrooms} beds
              </div>
            )}
            {propertyData.bathrooms != null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-300">
                <Bath className="h-3.5 w-3.5 text-cyan-400" /> {propertyData.bathrooms} baths
              </div>
            )}
            {propertyData.sqft != null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-300">
                <Square className="h-3.5 w-3.5 text-cyan-400" /> {propertyData.sqft.toLocaleString()} sqft
              </div>
            )}
            {propertyData.yearBuilt && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-300">
                <Calendar className="h-3.5 w-3.5 text-cyan-400" /> {propertyData.yearBuilt}
              </div>
            )}
            {propertyData.propertyType && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-300">
                {propertyData.propertyType}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this deal..."
              className="min-h-[80px] resize-none text-sm text-white placeholder:text-neutral-500"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-white/[0.08]"
              onClick={() => onNotesUpdate(deal.id, notes)}
              disabled={notes === (deal.notes || '')}
            >
              <Save className="h-3.5 w-3.5" /> Save Notes
            </Button>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Timeline</label>
            <div className="space-y-2 text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                Added: {new Date(deal.createdAt).toLocaleDateString()}
              </div>
              {deal.updatedAt !== deal.createdAt && (
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${currentStage?.color || 'bg-neutral-500'}`} />
                  Updated: {new Date(deal.updatedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-white/[0.06] flex flex-col sm:flex-row gap-2 bg-white/[0.01]">
          {propertyData.address && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 flex-1 border-white/[0.08]"
              onClick={() => window.open(`https://www.zillow.com/homes/${encodeURIComponent(propertyData.address)}_rb/`, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" /> View on Zillow
            </Button>
          )}
          {!showConfirmDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => setShowConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="gap-2 flex-1"
                onClick={() => { onRemove(deal.id); onClose(); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Confirm
              </Button>
              <Button variant="outline" size="sm" className="border-white/[0.08]" onClick={() => setShowConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
