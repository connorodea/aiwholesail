import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { zillowAPI } from '@/lib/zillow-api';
import type { Property } from '@/types/zillow';
import {
  UserCircle, RefreshCw, AlertTriangle, Phone, Mail, BadgeCheck,
  Star, Building, ChevronDown, ChevronUp, ExternalLink, History,
} from 'lucide-react';

/**
 * Rich Listing Agent profile section for the PropertyModal Overview tab.
 *
 * Surfaces the 4 Zillow Scraper agent endpoints (the only remaining
 * unsurfaced endpoints after PR #203, #204, #206 closed out the rest):
 *
 *   - getAgentDetails(username)  → photo, bio, license, brokerage
 *   - getAgentListings(username) → currently for-sale listings
 *   - getAgentSold(username)     → recently sold deals
 *   - getAgentReviews(username)  → client reviews + rating
 *
 * Lazy: only fetched when the property has a resolvable agent username
 * AND the user expands the section. Default collapsed so it doesn't
 * burn 4 API calls every modal open.
 *
 * Why this matters for wholesalers:
 *   - "How many active listings does this agent carry?" — signal of
 *     whether they're a low-volume listing agent (more receptive to a
 *     wholesale offer) or a high-volume one (busy, less time)
 *   - "What % did they typically negotiate off list?" — derivable from
 *     sold history; informs offer strategy
 *   - "What do clients say?" — reviews surface motivated-seller signals
 *     ("agent was helpful with a quick close")
 */

interface AgentDetails {
  name?: string;
  username?: string;
  photoUrl?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  brokerageName?: string;
  bio?: string;
  profileUrl?: string;
  reviewCount?: number;
  rating?: number;
  yearsExperience?: number;
  totalSales?: number;
  citiesServed?: string[];
}

interface AgentListing {
  zpid?: string;
  address?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  daysOnZillow?: number;
}

interface AgentSold extends AgentListing {
  soldDate?: string;
  soldPrice?: number;
  listPrice?: number;
}

interface AgentReview {
  rating?: number;
  reviewerName?: string;
  reviewText?: string;
  date?: string;
}

function readNum(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,]/g, ''));
    return isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizeDetails(raw: unknown): AgentDetails {
  if (!raw || typeof raw !== 'object') return {};
  const d = raw as Record<string, unknown>;
  const root = (d.agent ?? d.data ?? d) as Record<string, unknown>;
  return {
    name: (root.name as string) || (root.fullName as string),
    username: (root.username as string) || (root.encodedZuid as string),
    photoUrl: (root.photoUrl as string) || (root.image as string) || (root.profilePhoto as string),
    phone: (root.phone as string) || (root.businessPhone as string),
    email: (root.email as string),
    licenseNumber: (root.licenseNumber as string),
    brokerageName: (root.brokerageName as string) || (root.brokerage as string),
    bio: (root.bio as string) || (root.aboutMe as string) || (root.description as string),
    profileUrl: (root.profileUrl as string) || (root.url as string),
    reviewCount: readNum(root.reviewCount) ?? readNum(root.reviews_count),
    rating: readNum(root.rating) ?? readNum(root.averageRating),
    yearsExperience: readNum(root.yearsExperience) ?? readNum(root.years),
    totalSales: readNum(root.totalSales) ?? readNum(root.salesCount),
    citiesServed: Array.isArray(root.citiesServed) ? (root.citiesServed as string[]) : undefined,
  };
}

function normalizeListings(raw: unknown): AgentListing[] {
  if (!raw) return [];
  const d = raw as Record<string, unknown>;
  const arr = (d.listings ?? d.data ?? (Array.isArray(raw) ? raw : null)) as unknown[];
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 6).map((l) => {
    const r = (l ?? {}) as Record<string, unknown>;
    return {
      zpid: (r.zpid as string) || String(r.id ?? ''),
      address: (r.address as string) || (r.streetAddress as string),
      price: readNum(r.price),
      beds: readNum(r.bedrooms) ?? readNum(r.beds),
      baths: readNum(r.bathrooms) ?? readNum(r.baths),
      sqft: readNum(r.livingArea) ?? readNum(r.sqft),
      daysOnZillow: readNum(r.daysOnZillow),
    };
  });
}

function normalizeSold(raw: unknown): AgentSold[] {
  if (!raw) return [];
  const d = raw as Record<string, unknown>;
  const arr = (d.sold ?? d.listings ?? d.data ?? (Array.isArray(raw) ? raw : null)) as unknown[];
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 6).map((l) => {
    const r = (l ?? {}) as Record<string, unknown>;
    return {
      zpid: (r.zpid as string) || String(r.id ?? ''),
      address: (r.address as string) || (r.streetAddress as string),
      soldPrice: readNum(r.soldPrice) ?? readNum(r.price),
      listPrice: readNum(r.listPrice) ?? readNum(r.originalListPrice),
      soldDate: (r.soldDate as string) || (r.dateSold as string),
      beds: readNum(r.bedrooms) ?? readNum(r.beds),
      baths: readNum(r.bathrooms) ?? readNum(r.baths),
      sqft: readNum(r.livingArea) ?? readNum(r.sqft),
    };
  });
}

function normalizeReviews(raw: unknown): AgentReview[] {
  if (!raw) return [];
  const d = raw as Record<string, unknown>;
  const arr = (d.reviews ?? d.data ?? (Array.isArray(raw) ? raw : null)) as unknown[];
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 5).map((rev) => {
    const r = (rev ?? {}) as Record<string, unknown>;
    return {
      rating: readNum(r.rating) ?? readNum(r.stars),
      reviewerName: (r.reviewerName as string) || (r.reviewer as string) || (r.author as string),
      reviewText: (r.text as string) || (r.review as string) || (r.body as string),
      date: (r.date as string) || (r.reviewDate as string),
    };
  });
}

function resolveUsername(property: Property): string | null {
  const loose = property as Record<string, unknown>;
  // Zillow uses several path shapes for the agent identifier. Try them all.
  const candidates = [
    loose.agentUsername,
    loose.agent_username,
    loose.listingAgent_username,
    loose.attributionInfo_agentUsername,
    loose.property_listing_agentUsername,
    // Sometimes the username is embedded in a profile URL like
    // zillow.com/profile/JaneDoe
    loose.agentProfileUrl,
    loose.listingAgent_profileUrl,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) {
      // Strip URL prefix if present
      const m = c.match(/\/profile\/([^/?#]+)/i);
      return m ? decodeURIComponent(m[1]) : c.trim();
    }
  }
  return null;
}

const fmtCurrency = (val?: number) =>
  val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : '—';

export function ListingAgentProfile({ property }: { property: Property }) {
  const username = resolveUsername(property);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [listings, setListings] = useState<AgentListing[]>([]);
  const [sold, setSold] = useState<AgentSold[]>([]);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded || !username || details) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [d, l, s, r] = await Promise.allSettled([
        zillowAPI.getAgentDetails(username),
        zillowAPI.getAgentListings(username),
        zillowAPI.getAgentSold(username),
        zillowAPI.getAgentReviews(username),
      ]);
      if (cancelled) return;
      let anyOk = false;
      if (d.status === 'fulfilled') { setDetails(normalizeDetails(d.value)); anyOk = true; }
      if (l.status === 'fulfilled') { setListings(normalizeListings(l.value)); anyOk = true; }
      if (s.status === 'fulfilled') { setSold(normalizeSold(s.value)); anyOk = true; }
      if (r.status === 'fulfilled') { setReviews(normalizeReviews(r.value)); anyOk = true; }
      if (!anyOk) setErr('Could not load agent profile.');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, username, details]);

  // If we can't even find a username, no point rendering the section.
  if (!username) return null;

  const displayName = details?.name || property.agentName || 'Listing agent';
  const brokerage = details?.brokerageName || property.brokerageName;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            {details?.photoUrl ? (
              <img
                src={details.photoUrl}
                alt={displayName}
                className="h-10 w-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserCircle className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {displayName}
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {brokerage || 'Listing agent profile (click to expand)'}
              </p>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading agent profile…
            </div>
          )}

          {err && !details && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <AlertTriangle className="h-4 w-4" /> {err}
            </div>
          )}

          {details && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {details.totalSales != null && (
                  <Stat icon={History} label="Total sales" value={String(details.totalSales)} />
                )}
                {details.yearsExperience != null && (
                  <Stat icon={BadgeCheck} label="Experience" value={`${details.yearsExperience} yr`} />
                )}
                {details.rating != null && (
                  <Stat icon={Star} label="Rating" value={`${details.rating.toFixed(1)}/5${details.reviewCount ? ` (${details.reviewCount})` : ''}`} />
                )}
                {details.licenseNumber && (
                  <Stat icon={BadgeCheck} label="License" value={details.licenseNumber} />
                )}
              </div>

              {details.bio && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                  {details.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {details.phone && (
                  <a href={`tel:${details.phone}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Phone className="h-3 w-3 mr-1.5" /> {details.phone}
                    </Button>
                  </a>
                )}
                {details.email && (
                  <a href={`mailto:${details.email}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Mail className="h-3 w-3 mr-1.5" /> Email
                    </Button>
                  </a>
                )}
                {details.profileUrl && (
                  <a href={details.profileUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <ExternalLink className="h-3 w-3 mr-1.5" /> Zillow profile
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}

          {listings.length > 0 && (
            <Section title={`Active listings (${listings.length})`} icon={Building}>
              <div className="space-y-1.5">
                {listings.map((l, i) => (
                  <div key={l.zpid || i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                    <span className="truncate flex-1 mr-2">{l.address || 'Address pending'}</span>
                    <span className="font-medium">{fmtCurrency(l.price)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {sold.length > 0 && (
            <Section title={`Recently sold (${sold.length})`} icon={History}>
              <div className="space-y-1.5">
                {sold.map((s, i) => {
                  const overUnder =
                    s.listPrice && s.soldPrice
                      ? (s.soldPrice - s.listPrice) / s.listPrice
                      : null;
                  return (
                    <div key={s.zpid || i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="truncate">{s.address || 'Address pending'}</div>
                        {s.soldDate && <div className="text-[10px] text-muted-foreground">{s.soldDate.slice(0, 10)}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{fmtCurrency(s.soldPrice)}</div>
                        {overUnder !== null && (
                          <div className={`text-[10px] ${overUnder >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {overUnder >= 0 ? '+' : ''}{(overUnder * 100).toFixed(1)}% vs list
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {reviews.length > 0 && (
            <Section title={`Recent reviews (${reviews.length})`} icon={Star}>
              <div className="space-y-2">
                {reviews.map((r, i) => (
                  <div key={i} className="text-xs space-y-1 py-2 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2">
                      {r.rating != null && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          <Star className="h-2.5 w-2.5 mr-0.5" /> {r.rating}/5
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {r.reviewerName || 'Anonymous'}
                        {r.date && <span className="ml-1 text-muted-foreground/60">· {r.date.slice(0, 10)}</span>}
                      </span>
                    </div>
                    {r.reviewText && (
                      <p className="text-muted-foreground leading-relaxed line-clamp-3">
                        {r.reviewText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 pt-2 border-t border-border/40">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
