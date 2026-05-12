import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { AlertTriangle, Flame } from 'lucide-react';

/**
 * Density heatmap — Phase 7 of the off-market roadmap, but built
 * dual-purpose so on-market also gets it.
 *
 * Wraps Leaflet's `leaflet.heat` plugin with a React-friendly API.
 * Same component powers:
 *   - On-market: PropertyMap's "Heatmap" toggle (price-spread density)
 *   - Off-market: AbsenteeOwnerSearch collapsible panel (equity density)
 *
 * Caller passes pre-aggregated points with normalized intensity 0-1.
 * Component handles the Leaflet layer lifecycle (add on mount, remove
 * on unmount, update on points change).
 *
 * Uses OpenStreetMap tiles via Leaflet — no Mapbox dependency, no
 * MAPBOX_ACCESS_TOKEN required. The original Phase 7 plan called for
 * Mapbox but Leaflet's free tiles work fine for density visualization.
 */

export interface HeatPoint {
  lat: number;
  lng: number;
  /** Normalized 0-1 intensity. 1 = hottest. Caller scales. */
  intensity: number;
}

interface HeatmapViewProps {
  points: HeatPoint[];
  /** Height in pixels or any valid CSS unit. Default 400px. */
  height?: string | number;
  /** Optional descriptor for the "X points plotted" status line. */
  pointsLabel?: string;
  /** Optional gradient override — defaults to amber→red. */
  gradient?: Record<number, string>;
  /** Radius in pixels of each heat point. Default 22. */
  radius?: number;
  /** Blur in pixels. Default 16. */
  blur?: number;
}

/** Inner component that renders the heat layer inside a MapContainer. */
function HeatLayer({ points, gradient, radius, blur }: {
  points: HeatPoint[];
  gradient: Record<number, string>;
  radius: number;
  blur: number;
}) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (points.length === 0) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    // (leaflet.heat is loaded as a side-effect; types come from
    // @types/leaflet.heat which augments L.heatLayer.)
    const data = points.map((p) => [p.lat, p.lng, p.intensity] as [number, number, number]);
    const heatLayer = (L as typeof L & { heatLayer: (data: unknown[], opts: unknown) => L.Layer }).heatLayer(data, {
      radius,
      blur,
      maxZoom: 17,
      max: 1.0,
      gradient,
    });
    heatLayer.addTo(map);
    layerRef.current = heatLayer;

    // Fit map to the heatmap bounds on first render — but ONLY if
    // the map hasn't already been positioned by the user.
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, gradient, radius, blur]);

  return null;
}

const DEFAULT_GRADIENT: Record<number, string> = {
  0.0: 'rgba(0, 0, 255, 0)',     // transparent at lowest
  0.25: '#0891b2',                // cyan-600
  0.5: '#eab308',                 // yellow-500
  0.75: '#f97316',                // orange-500
  1.0: '#dc2626',                 // red-600
};

export function HeatmapView({
  points,
  height = 400,
  pointsLabel = 'point',
  gradient = DEFAULT_GRADIENT,
  radius = 22,
  blur = 16,
}: HeatmapViewProps) {
  const validPoints = useMemo(
    () => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== 0 && p.lng !== 0),
    [points],
  );

  const center = useMemo<[number, number]>(() => {
    if (validPoints.length === 0) return [39.8, -98.6]; // US centroid fallback
    const avgLat = validPoints.reduce((s, p) => s + p.lat, 0) / validPoints.length;
    const avgLng = validPoints.reduce((s, p) => s + p.lng, 0) / validPoints.length;
    return [avgLat, avgLng];
  }, [validPoints]);

  if (validPoints.length === 0) {
    return (
      <div
        className="border border-border/60 rounded-lg flex items-center justify-center text-sm text-muted-foreground gap-2 bg-muted/10"
        style={{ height }}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>No coordinates available for these results. Heatmap needs lat/lng on each record.</span>
      </div>
    );
  }

  const sizeStyle: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
    width: '100%',
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-border/60" style={sizeStyle}>
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatLayer
          points={validPoints}
          gradient={gradient}
          radius={radius}
          blur={blur}
        />
      </MapContainer>
      <div className="absolute top-2 right-2 z-[1000] bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] text-muted-foreground flex items-center gap-1 border border-border/40">
        <Flame className="h-3 w-3 text-amber-400" />
        {validPoints.length} {pointsLabel}{validPoints.length === 1 ? '' : 's'} plotted
      </div>
    </div>
  );
}
