import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, Mail, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { alerts } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SaveSearchAsAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLocation: string;
  defaultMinSpread?: number;
}

const FREQUENCY_OPTIONS = [
  { value: 'instant', label: 'Instant', desc: 'New deals checked every hour' },
  { value: 'daily', label: 'Daily', desc: 'One digest per day' },
  { value: 'weekly', label: 'Weekly', desc: 'Sunday morning digest' },
] as const;

export function SaveSearchAsAlertDialog({
  open,
  onOpenChange,
  defaultLocation,
  defaultMinSpread = 30000,
}: SaveSearchAsAlertDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [location, setLocation] = useState(defaultLocation);
  const [minSpread, setMinSpread] = useState(defaultMinSpread);
  const [alertFrequency, setAlertFrequency] = useState<'instant' | 'daily' | 'weekly'>('instant');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setLocation(defaultLocation);
      setMinSpread(defaultMinSpread);
      setSuccess(false);
    }
  }, [open, defaultLocation, defaultMinSpread]);

  if (!user && open) {
    onOpenChange(false);
    navigate('/auth?mode=signup&redirect=/app');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      toast.error('Location is required');
      return;
    }
    setSubmitting(true);
    try {
      const response = await alerts.create({
        location: location.trim(),
        minSpread,
        alertFrequency,
      });
      if (response.error) throw new Error(response.error);
      setSuccess(true);
      toast.success("Alert saved! We'll notify you when matching deals hit the market.");
      setTimeout(() => onOpenChange(false), 1500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save alert');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] bg-[#0c0d0f] border-neutral-800 text-white p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-medium tracking-tight">Save as alert</DialogTitle>
              <DialogDescription className="text-xs text-neutral-500 mt-0.5">
                Get notified the moment new deals hit this market
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="px-6 pb-8 pt-4 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-white">Alert saved</p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              We&rsquo;ll scan {location} every hour and email you the moment a deal with at least{' '}
              <span className="text-emerald-400 font-medium">${minSpread.toLocaleString()}</span> spread shows up.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="alert-location" className="text-xs font-medium text-neutral-300">
                Location
              </Label>
              <Input
                id="alert-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Detroit, MI"
                required
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="min-spread" className="text-xs font-medium text-neutral-300">
                Minimum spread <span className="text-neutral-500 font-normal">(price below Zestimate)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">$</span>
                <Input
                  id="min-spread"
                  type="number"
                  inputMode="numeric"
                  step={5000}
                  min={0}
                  value={minSpread}
                  onChange={(e) => setMinSpread(Number(e.target.value) || 0)}
                  required
                  className="h-10 pl-7 bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
              <div className="flex gap-1.5 pt-1">
                {[15000, 30000, 50000, 100000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMinSpread(v)}
                    className={`flex-1 text-[11px] py-1.5 rounded border transition-colors ${
                      minSpread === v
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'border-white/[0.06] text-neutral-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    ${(v / 1000)}K
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-neutral-300">Frequency</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAlertFrequency(opt.value)}
                    className={`py-2 rounded-lg border text-left px-3 transition-all ${
                      alertFrequency === opt.value
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                        : 'border-white/[0.06] text-neutral-400 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {opt.value === 'instant' && <Zap className="h-3 w-3" />}
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </div>
                    <p className="text-[10px] mt-0.5 text-neutral-500 leading-tight">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3 flex items-start gap-2.5">
              <Mail className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Alerts are emailed to <span className="text-neutral-200">{user?.email}</span>.
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitting || !location.trim()}
              className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving alert…
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Create alert
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
