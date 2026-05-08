import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Search, ArrowRight, X } from 'lucide-react';
import allCountiesRaw from '@/data/all-us-counties.json';

interface County {
  slug: string;
  name: string;
  state: string;
  stateFull: string;
}

const counties = allCountiesRaw as County[];

// Pre-group by state at module load (one pass over the 3,143 entries).
const COUNTIES_BY_STATE = (() => {
  const grouped: Record<string, { state: string; stateFull: string; counties: County[] }> = {};
  for (const c of counties) {
    if (!grouped[c.stateFull]) {
      grouped[c.stateFull] = { state: c.state, stateFull: c.stateFull, counties: [] };
    }
    grouped[c.stateFull].counties.push(c);
  }
  for (const k of Object.keys(grouped)) {
    grouped[k].counties.sort((a, b) => a.name.localeCompare(b.name));
  }
  return Object.values(grouped).sort((a, b) => a.stateFull.localeCompare(b.stateFull));
})();

const TOTAL_COUNTIES = counties.length;
const TOTAL_STATES = COUNTIES_BY_STATE.length;

interface CountyBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCounty: (locationString: string) => void;
}

export function CountyBrowserDialog({ open, onOpenChange, onSelectCounty }: CountyBrowserDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const stateChipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Reset filters whenever the dialog reopens.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedState(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let groups = COUNTIES_BY_STATE;

    if (selectedState) {
      groups = groups.filter((g) => g.state === selectedState);
    }

    if (!q) return groups;

    return groups
      .map((group) => {
        const stateMatch =
          group.stateFull.toLowerCase().includes(q) ||
          group.state.toLowerCase() === q ||
          group.state.toLowerCase().startsWith(q);
        const matchedCounties = stateMatch
          ? group.counties
          : group.counties.filter((c) => c.name.toLowerCase().includes(q));
        return { ...group, counties: matchedCounties };
      })
      .filter((g) => g.counties.length > 0);
  }, [query, selectedState]);

  const handleSelect = (county: County) => {
    onSelectCounty(`${county.name}, ${county.state}`);
    onOpenChange(false);
  };

  const handleStateClick = (stateAbbr: string) => {
    if (selectedState === stateAbbr) {
      // Toggle off
      setSelectedState(null);
      return;
    }
    setSelectedState(stateAbbr);
    setQuery('');
    // Center the chip in the strip
    const chip = stateChipRefs.current[stateAbbr];
    if (chip) {
      chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const totalShown = filtered.reduce((sum, g) => sum + g.counties.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] p-0 bg-[#0c0d0f] border-neutral-800 text-white overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-neutral-800/60">
          <DialogTitle className="text-xl font-medium tracking-tight">Browse counties by state</DialogTitle>
          <DialogDescription className="text-sm text-neutral-500 leading-relaxed">
            Pick a county to instantly run a search there. All {TOTAL_COUNTIES.toLocaleString()} US counties across {TOTAL_STATES} states + DC.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-neutral-800/60 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
            <Input
              autoFocus
              placeholder="Filter by state name, state abbreviation, or county name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-neutral-500"
            />
          </div>

          {/* Horizontal state picker — scroll or click to filter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-neutral-500">
                {selectedState ? `Filtering · ${selectedState}` : 'Scroll to pick a state'}
              </p>
              {selectedState && (
                <button
                  type="button"
                  onClick={() => setSelectedState(null)}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-500 hover:text-cyan-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
            <div
              className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth snap-x snap-mandatory"
              style={{ scrollbarWidth: 'thin' }}
            >
              {COUNTIES_BY_STATE.map((g) => {
                const isActive = selectedState === g.state;
                return (
                  <button
                    key={g.state}
                    ref={(el) => { stateChipRefs.current[g.state] = el; }}
                    type="button"
                    onClick={() => handleStateClick(g.state)}
                    title={`${g.stateFull} · ${g.counties.length} counties`}
                    className={`flex-shrink-0 snap-start min-w-[56px] h-12 rounded-lg px-3 flex flex-col items-center justify-center gap-0 border transition-all ${
                      isActive
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                        : 'bg-white/[0.02] border-white/[0.06] text-neutral-300 hover:bg-white/[0.05] hover:border-white/[0.12] hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-bold tabular-nums leading-none">{g.state}</span>
                    <span className="text-[9px] text-neutral-500 leading-none mt-0.5 tabular-nums">{g.counties.length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-neutral-500">
            {totalShown.toLocaleString()} {totalShown === 1 ? 'county' : 'counties'} {query || selectedState ? 'match' : 'available'}
            {query && !selectedState ? ` across ${filtered.length} ${filtered.length === 1 ? 'state' : 'states'}` : ''}
          </p>
        </div>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="px-6 py-4 space-y-6">
            {filtered.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <MapPin className="h-8 w-8 text-neutral-700 mx-auto" />
                <p className="text-sm text-neutral-400">No matches for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-neutral-500">
                  Try the state abbreviation (e.g. &ldquo;TX&rdquo;) or first few letters of the county name.
                </p>
              </div>
            )}

            {filtered.map((group) => (
              <div key={group.stateFull}>
                <div className="flex items-baseline gap-2 mb-2 sticky top-0 bg-[#0c0d0f] py-1 z-10">
                  <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-cyan-400">
                    {group.stateFull}
                  </h3>
                  <span className="text-xs text-neutral-600">
                    {group.state} · {group.counties.length} {group.counties.length === 1 ? 'county' : 'counties'}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1">
                  {group.counties.map((county) => (
                    <button
                      key={county.slug}
                      type="button"
                      onClick={() => handleSelect(county)}
                      className="group flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border border-transparent hover:border-cyan-500/30 hover:bg-white/[0.03] transition-all text-left"
                    >
                      <span className="text-sm text-neutral-200 group-hover:text-white truncate min-w-0">
                        {county.name}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="px-6 py-3 border-t border-neutral-800/60 text-xs text-neutral-500">
          Source: US Census Bureau · {TOTAL_COUNTIES.toLocaleString()} counties across {TOTAL_STATES} states + DC
        </div>
      </DialogContent>
    </Dialog>
  );
}
