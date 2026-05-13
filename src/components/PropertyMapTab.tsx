/**
 * Property-detail "Map" tab — wraps PropertyMapWithComps with the data-fetch
 * logic to pull lat/lng for the subject and nearby comparable sales.
 *
 * Flow:
 *   1. Resolve subject lat/lng — from the Property itself (some sources) or
 *      from a one-shot propertyDetails fetch on zpid.
 *   2. Fetch comps via zillowAPI.getPropertyComps (same call AIRankedComps
 *      uses, but we pull lat/lng off each result for the map).
 *   3. Render the map + a count.
 *
 * Renders a graceful no-op (not a crash) when the property has no usable
 * coordinates or no zpid — the modal stays usable for hand-keyed leads.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, MapIcon } from 'lucide-react';
import type { Property } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { PropertyMapWithComps, type MapComp, type MapSubject } from './PropertyMapWithComps';

interface PropertyMapTabProps {
  property: Property;
}

/**
 * Pull lat/lng off a property in whatever field-name shape the upstream
 * pipeline left it. Some sources nest under `location`, some flat. Returns
 * null if no usable coordinates are present.
 */
function extractCoords(p: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat =
    (p.latitude as number | undefined) ??
    (p.lat as number | undefined) ??
    ((p.location as Record<string, unknown> | undefined)?.latitude as number | undefined);
  const lng =
    (p.longitude as number | undefined) ??
    (p.lng as number | undefined) ??
    ((p.location as Record<string, unknown> | undefined)?.longitude as number | undefined);
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }
  return { lat, lng };
}

export function PropertyMapTab({ property }: PropertyMapTabProps) {
  const [subject, setSubject] = useState<MapSubject | null>(null);
  const [comps, setComps] = useState<MapComp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only fetch comps when we have a real Zillow zpid — internal app ids
  // won't resolve and would cost a wasted scrape.do credit.
  const zpid = property.zpid && /^\d{5,}$/.test(String(property.zpid))
    ? String(property.zpid)
    : null;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);

    const run = async () => {
      // Step 1: resolve subject coords. Some search-result Property shapes
      // already carry inline lat/lng; if not, pull from detail.
      let coords = extractCoords(property as unknown as Record<string, unknown>);
      let resolvedSubjectAddress = property.address;

      if (!coords && zpid) {
        try {
          const details = await zillowAPI.getPropertyDetails(zpid);
          coords = extractCoords(details || {});
          // Prefer the canonical address from details if we got one
          if (details?.streetAddress || details?.address) {
            const addr = typeof details.address === 'string'
              ? details.address
              : [details.streetAddress, details.city, details.state, details.zipcode]
                  .filter(Boolean)
                  .join(', ');
            if (addr) resolvedSubjectAddress = addr;
          }
        } catch (e) {
          // Non-fatal — continue without subject coords; we'll show the
          // empty-state inside PropertyMapWithComps.
          console.warn('[PropertyMapTab] propertyDetails fetch failed:', e);
        }
      }

      if (!coords) {
        if (!cancelled) {
          setSubject(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setSubject({
          zpid: zpid || undefined,
          address: resolvedSubjectAddress,
          lat: coords.lat,
          lng: coords.lng,
          price: property.price,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          sqft: property.sqft,
        });
      }

      // Step 2: fetch comps (only if we have a zpid — without one the comps
      // action can't anchor).
      if (zpid) {
        try {
          const rawComps = await zillowAPI.getPropertyComps(
            zpid,
            property.address,
            coords.lat,
            coords.lng
          );
          if (cancelled) return;
          const mapped: MapComp[] = Array.isArray(rawComps)
            ? rawComps
                .map((c: Record<string, unknown>) => {
                  const cc = extractCoords(c);
                  if (!cc) return null;
                  return {
                    zpid: c.zpid ? String(c.zpid) : undefined,
                    address: String(c.address || 'Unknown'),
                    lat: cc.lat,
                    lng: cc.lng,
                    price: typeof c.price === 'number' ? c.price : undefined,
                    bedrooms:
                      typeof c.bedrooms === 'number'
                        ? c.bedrooms
                        : typeof c.beds === 'number'
                          ? (c.beds as number)
                          : undefined,
                    bathrooms:
                      typeof c.bathrooms === 'number'
                        ? c.bathrooms
                        : typeof c.baths === 'number'
                          ? (c.baths as number)
                          : undefined,
                    sqft: typeof c.sqft === 'number' ? c.sqft : undefined,
                    distance: typeof c.distance === 'number' ? c.distance : undefined,
                  } as MapComp;
                })
                .filter((x): x is MapComp => x !== null)
            : [];
          if (!cancelled) setComps(mapped);
        } catch (e) {
          if (!cancelled) {
            setError(
              (e as Error)?.message ||
                'Could not fetch nearby comparable sales — map will show subject only.'
            );
          }
        }
      }

      if (!cancelled) setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [property.id, zpid, property.address, property.price, property.bedrooms, property.bathrooms, property.sqft, property]);

  if (loading && !subject) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading map and nearby comps…</p>
        </CardContent>
      </Card>
    );
  }

  if (!subject) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-10 text-center space-y-3">
          <MapIcon className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            No location data available for this property — map view unavailable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-cyan-400" />
          Subject + nearby comparable sales
        </h3>
        {loading && comps.length === 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading comps…
          </span>
        )}
      </div>

      <PropertyMapWithComps subject={subject} comps={comps} height="480px" />

      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-400 px-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
