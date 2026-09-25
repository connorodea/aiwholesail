/**
 * /app/auctions — auctions section, parallel to on-market/off-market.
 *
 * Pulls from the `aiwholesail-auctions-api` Python service. Auction-specific
 * fields (start date, starting bid, source badge, deep-link) live on the
 * card here rather than reusing PropertyCard — the data shape diverges
 * enough that mixing them produces a confusing UI.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gavel, ExternalLink, MapPin, Calendar } from 'lucide-react';

import { DashboardNav } from '@/components/DashboardNav';
import { ChatAssistant } from '@/components/ChatAssistant';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { listAuctions } from '@/lib/auctions-api';
import {
  AUCTION_SOURCE_LABEL,
  AUCTION_TYPE_LABEL,
  type Auction,
  type AuctionFilters,
  type AuctionType,
} from '@/types/auction';

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const AUCTION_TYPES: { value: AuctionType; label: string }[] = [
  { value: 'reo', label: 'REO' },
  { value: 'foreclosure', label: 'Foreclosure' },
  { value: 'tax_sale', label: 'Tax Sale' },
  { value: 'online_bid', label: 'Online Auction' },
  { value: 'live', label: 'Live Auction' },
  { value: 'sealed_bid', label: 'Sealed Bid' },
  { value: 'short_sale', label: 'Short Sale' },
];

function formatCents(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function AuctionCard({ auction }: { auction: Auction }) {
  const cover = auction.photos?.[0]?.url;
  return (
    <article className="feature-card overflow-hidden flex flex-col">
      <div className="aspect-[16/10] bg-neutral-900 relative overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={auction.title || auction.address_line1 || 'Auction property'}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-700">
            <Gavel className="h-12 w-12" />
          </div>
        )}
        <Badge className="absolute top-3 left-3 bg-black/70 text-white border-white/20">
          {AUCTION_SOURCE_LABEL[auction.source] || auction.source}
        </Badge>
        <Badge className="absolute top-3 right-3 bg-amber-500/90 text-black border-0">
          {AUCTION_TYPE_LABEL[auction.auction_type] || auction.auction_type}
        </Badge>
      </div>

      <div className="p-5 space-y-3 flex-1 flex flex-col">
        <div className="space-y-1">
          <h3 className="font-medium text-white tracking-tight line-clamp-1">
            {auction.address_line1 || auction.title || 'Untitled listing'}
          </h3>
          <div className="flex items-center text-sm text-neutral-400 gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span className="line-clamp-1">
              {[auction.city, auction.state, auction.postal_code].filter(Boolean).join(', ') || 'Location unknown'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-neutral-500 text-xs uppercase tracking-wider">Starting bid</div>
            <div className="text-white font-medium">{formatCents(auction.starting_bid_cents)}</div>
          </div>
          <div>
            <div className="text-neutral-500 text-xs uppercase tracking-wider">Est. value</div>
            <div className="text-white font-medium">{formatCents(auction.estimated_market_value_cents)}</div>
          </div>
        </div>

        <div className="flex items-center text-sm text-neutral-400 gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {auction.bid_deadline_at
              ? `Bids due ${formatDate(auction.bid_deadline_at)}`
              : auction.auction_start_at
                ? `Auction ${formatDate(auction.auction_start_at)}`
                : 'Schedule TBD'}
          </span>
        </div>

        {auction.source_url && (
          <a
            href={auction.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center justify-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300 smooth-transition pt-1"
          >
            View on {AUCTION_SOURCE_LABEL[auction.source] || auction.source}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  );
}

export default function Auctions() {
  const [filters, setFilters] = useState<AuctionFilters>({
    status: 'active',
    page: 1,
    page_size: 24,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['auctions', filters],
    queryFn: () => listAuctions(filters),
    retry: 1,
    staleTime: 30_000,
  });

  const setFilter = <K extends keyof AuctionFilters>(key: K, value: AuctionFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-8">
        <section className="space-y-3 max-w-3xl animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Gavel className="h-5 w-5 text-amber-400" />
            </div>
            <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Auctions</h1>
          </div>
          <p className="text-neutral-400 font-light leading-relaxed">
            REO, foreclosure, and online auction listings aggregated across HUD,
            and (pending) Hubzu, Auction.com, Xome, ServiceLink, and Williams &amp; Williams.
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <Select
            value={filters.state || 'all'}
            onValueChange={(v) => setFilter('state', v === 'all' ? undefined : v)}
          >
            <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All states</SelectItem>
              {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input
            placeholder="City"
            value={filters.city || ''}
            onChange={(e) => setFilter('city', e.target.value || undefined)}
          />

          <Select
            value={filters.auction_type || 'all'}
            onValueChange={(v) => setFilter('auction_type', v === 'all' ? undefined : (v as AuctionType))}
          >
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {AUCTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status || 'active'}
            onValueChange={(v) => setFilter('status', v as AuctionFilters['status'])}
          >
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {isLoading && (
          <div className="text-center text-neutral-500 py-12">Loading auctions…</div>
        )}

        {isError && (
          <div className="feature-card p-8 text-center max-w-xl mx-auto">
            <Gavel className="h-10 w-10 mx-auto mb-3 text-neutral-600" />
            <h3 className="text-lg font-medium mb-2">Auctions feed unavailable</h3>
            <p className="text-sm text-neutral-400 mb-1">
              We couldn’t reach the auctions service. It may still be deploying.
            </p>
            <p className="text-xs text-neutral-600">
              {(error as Error)?.message?.slice(0, 200) || 'Unknown error'}
            </p>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="feature-card p-10 text-center max-w-xl mx-auto">
            <Gavel className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
            <h3 className="text-lg font-medium mb-2">No auctions match those filters</h3>
            <p className="text-sm text-neutral-400 mb-6">
              Try widening the state or auction type, or clear filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ status: 'active', page: 1, page_size: 24 })}
            >
              Clear filters
            </Button>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="text-sm text-neutral-500">
              {data.total.toLocaleString()} {data.total === 1 ? 'auction' : 'auctions'}
            </div>
            <div className="property-grid animate-fade-in items-stretch">
              {data.items.map((a, i) => (
                <div
                  key={a.id}
                  className="animate-fade-in hover-scale flex"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <AuctionCard auction={a} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <ChatAssistant />
    </div>
  );
}
