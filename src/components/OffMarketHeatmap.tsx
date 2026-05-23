/**
 * Off-market heatmap (Phase 7).
 *
 * Takes the absentee-owner search results (which lack lat/lng on the
 * bulk PropData response) and renders them as a Leaflet heatmap weighted
 * by equity %. The geocoding fan-out happens on the backend via
 * POST /api/property/heatmap-coords, which caches results in geocode_cache
 * (migration 015) — second visits to the same market are pure cache hits.
 *
 * Bundle hygiene: Leaflet + react-leaflet + leaflet.heat add ~80KB
 * (gzipped). This file is the only place that imports them; consumers
 * mount it via React.lazy so the deps land in their own chunk, OUT of
 * the main /app bundle.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { apiFetch } from '@/lib/api-client';
import type { PropDataPropertyRecord } from '@/lib/propdata-api';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';

interface OffMarketHeatmapProps {
  records: PropDataPropertyRecord[];
}

// Carto's dark-matter basemap. Free for commercial use up to ~75k req/day
// without registration; pairs with the app's dark theme. Switch the URL
// to positron / voyager etc. if we ever rebrand to light.
const CARTO_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

type GeoRecord = PropDataPropertyRecord & { lat?: number; lng?: number };

interface HeatmapStats {
  hits: number;
  misses: number;
  failed: number;
}

/**
 * Pure transform: records → Leaflet.heat input `[lat, lng, intensity]`.
 * Intensity is the equity_pct (0-100) scaled to 0-1, falling back to 0.5
 * when equity is missing so the dot still renders.
 */
function recordsToHeatPoints(records: GeoRecord[]): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  for (const r of records) {
    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') continue;
    const equityPct = typeof r.equity?.equity_pct === 'number' ? r.equity.equity_pct : null;
    const intensity = equityPct != null ? Math.max(0.1, Math.min(1, equityPct / 100)) : 0.5;
    points.push([r.lat, r.lng, intensity]);
  }
  return points;
}

/**
 * Compute the map's initial center + zoom from the points. Empty input
 * defaults to a US-wide view so the user sees "we tried, no coords yet".
 */
function fitView(points: Array<[number, number, number]>): { center: [number, number]; zoom: number } {
  if (points.length === 0) return { center: [39.5, -98.35], zoom: 4 };
  let minLat = points[0][0], maxLat = points[0][0];
  let minLng = points[0][1], maxLng = points[0][1];
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const center: [number, number] = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  const spread = Math.max(maxLat - minLat, maxLng - minLng);
  let zoom = 11;
  if (spread > 5) zoom = 6;
  else if (spread > 1) zoom = 9;
  else if (spread > 0.2) zoom = 11;
  else zoom = 13;
  return { center, zoom };
}

/** Inner layer — receives the map ref via useMap and attaches Leaflet.heat. */
function HeatLayer({ points }: { points: Array<[number, number, number]> }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (points.length === 0) return;
    // leaflet.heat extends L but isn't typed in @types/leaflet. The plugin
    // adds L.heatLayer at runtime; the cast is intentional and contained.
    const heat = (L as unknown as { heatLayer: (pts: Array<[number, number, number]>, opts: object) => L.Layer })
      .heatLayer(points, {
        radius: 25,
        blur: 18,
        maxZoom: 14,
        // Dark-theme palette: cyan (low equity) → amber → magenta (high).
        gradient: {
          0.2: '#00c4c8',
          0.4: '#0ea5e9',
          0.6: '#a855f7',
          0.8: '#f59e0b',
          1.0: '#ef4444',
        },
      });
    heat.addTo(map);
    layerRef.current = heat;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

export function OffMarketHeatmap({ records }: OffMarketHeatmapProps) {
  const [enriched, setEnriched] = useState<GeoRecord[] | null>(null);
  const [stats, setStats] = useState<HeatmapStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Geocode on mount / when the records array reference changes. Slice to
  // 200 (the backend cap) and only send the fields the backend actually
  // needs — strips PII-shaped owner fields that have no business going to
  // the geocode endpoint.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setEnriched(null);
    setStats(null);
    const slim = records.slice(0, 200).map((r) => ({
      parcel_id: r.parcel_id,
      address: r.address,
    }));
    if (slim.length === 0) {
      setEnriched([]);
      setStats({ hits: 0, misses: 0, failed: 0 });
      return;
    }

    (async () => {
      try {
        const res = await apiFetch<{ records: GeoRecord[]; stats: HeatmapStats }>(
          '/api/property/heatmap-coords',
          {
            method: 'POST',
            body: JSON.stringify({ records: slim }),
          }
        );
        if (cancelled) return;
        if (res.error || !res.data) {
          setError(res.error || 'Geocoding failed');
          return;
        }
        // Stitch coords back onto the FULL records array (preserving
        // equity / valuation / flags) by parcel_id.
        const byId = new Map<string, GeoRecord>();
        for (const r of res.data.records) {
          if (r.parcel_id) byId.set(r.parcel_id, r);
        }
        const merged: GeoRecord[] = records.map((orig) => {
          const geo = orig.parcel_id ? byId.get(orig.parcel_id) : undefined;
          return geo ? { ...orig, lat: geo.lat, lng: geo.lng } : orig;
        });
        setEnriched(merged);
        setStats(res.data.stats);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Geocoding failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [records]);

  const points = useMemo(() => (enriched ? recordsToHeatPoints(enriched) : []), [enriched]);
  const view = useMemo(() => fitView(points), [points]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-zinc-900/40 border border-zinc-800 rounded-lg">
        <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
        <p className="text-zinc-300 font-medium">Couldn&apos;t load the heatmap</p>
        <p className="text-zinc-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (enriched === null) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-zinc-900/40 border border-zinc-800 rounded-lg">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
        <p className="text-zinc-300 font-medium">Geocoding {records.length} addresses…</p>
        <p className="text-zinc-500 text-sm mt-1">Cached results return in &lt;1s; fresh lookups may take ~{Math.ceil(records.length / 5)}s.</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-zinc-900/40 border border-zinc-800 rounded-lg">
        <MapPin className="w-8 h-8 text-zinc-500 mb-3" />
        <p className="text-zinc-300 font-medium">No coordinates resolved</p>
        <p className="text-zinc-500 text-sm mt-1">
          PropData couldn&apos;t geocode any of these addresses — try a different ZIP or come back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          {points.length} of {records.length} plotted
          {stats && (
            <>
              {' · '}
              <span className="text-cyan-500">{stats.hits} cached</span>
              {' · '}
              <span className="text-purple-400">{stats.misses} fresh</span>
              {stats.failed > 0 && (
                <>
                  {' · '}
                  <span className="text-amber-500">{stats.failed} failed</span>
                </>
              )}
            </>
          )}
        </span>
        <span className="text-zinc-500">Heat = owner equity %</span>
      </div>
      <div className="h-[600px] rounded-lg overflow-hidden border border-zinc-800">
        <MapContainer
          center={view.center}
          zoom={view.zoom}
          style={{ height: '100%', width: '100%', background: '#0a0a0b' }}
          scrollWheelZoom
        >
          <TileLayer url={CARTO_TILE_URL} attribution={CARTO_ATTRIBUTION} />
          <HeatLayer points={points} />
        </MapContainer>
      </div>
    </div>
  );
}

export default OffMarketHeatmap;
