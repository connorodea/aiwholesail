import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Property } from '@/types/zillow';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Flame, MapPin as MapPinIcon } from 'lucide-react';

// Fix default marker icon issue with bundlers (Leaflet assets not found)
// We use custom colored SVG markers instead, so this is just a fallback
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface PropertyMapProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

/** Create a colored SVG marker icon */
function createColoredIcon(color: string): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="40">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#000" stroke-width="0.5" stroke-opacity="0.3"/>
      <circle cx="12" cy="12" r="5" fill="white" fill-opacity="0.9"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-map-marker',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}

const greenIcon = createColoredIcon('#16a34a');
const yellowIcon = createColoredIcon('#eab308');
const redIcon = createColoredIcon('#dc2626');
const grayIcon = createColoredIcon('#6b7280');

function getMarkerIcon(property: Property): L.DivIcon {
  if (!property.price || !property.zestimate) return grayIcon;
  const spread = property.zestimate - property.price;
  if (spread >= 30000) return greenIcon;
  if (spread > 0) return yellowIcon;
  return redIcon;
}

function formatPrice(price: number): string {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`;
  }
  return `$${(price / 1000).toFixed(0)}K`;
}

/**
 * Inner heat-layer component — wraps leaflet.heat with a React-friendly
 * lifecycle. Used by the heatmap view toggle below. Off-market has its
 * own component (OffMarketHeatmap from PR #253); this stays inline here
 * because on-market data is fundamentally simpler (Property already has
 * lat/lng inline, no geocode fan-out needed).
 */
function HeatLayer({ points }: { points: Array<[number, number, number]> }) {
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
    const heatLayer = (L as typeof L & {
      heatLayer: (data: unknown[], opts: unknown) => L.Layer;
    }).heatLayer(points, {
      radius: 22,
      blur: 16,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: 'rgba(0, 0, 255, 0)',
        0.25: '#0891b2',  // cyan-600
        0.5: '#eab308',   // yellow-500
        0.75: '#f97316',  // orange-500
        1.0: '#dc2626',   // red-600 — hottest = strongest wholesale margin
      },
    });
    heatLayer.addTo(map);
    layerRef.current = heatLayer;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

/** Auto-fit map bounds to show all markers */
function FitBounds({ properties }: { properties: Property[] }) {
  const map = useMap();
  const prevCountRef = useRef(0);

  useEffect(() => {
    const mappable = properties.filter(p => p.latitude && p.longitude);
    // Only re-fit when the count of mappable properties changes
    if (mappable.length === 0 || mappable.length === prevCountRef.current) return;
    prevCountRef.current = mappable.length;

    const bounds = L.latLngBounds(
      mappable.map(p => [p.latitude!, p.longitude!] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [properties, map]);

  return null;
}

export function PropertyMap({ properties, onSelectProperty }: PropertyMapProps) {
  // Phase 7 (on-market half) — heatmap toggle. Off-market got its own
  // heatmap in PR #253 (`off-market-heatmap` flag, separate component
  // OffMarketHeatmap with backend geocode-cache). This is the on-market
  // sister feature: simpler because Property already has inline lat/lng
  // — no fan-out needed.
  const { enabled: heatmapEnabled } = useFeatureFlag('on-market-heatmap');
  const [view, setView] = useState<'markers' | 'heat'>('markers');

  const mappableProperties = useMemo(
    () => properties.filter(p => p.latitude && p.longitude),
    [properties]
  );

  // Heat points: each mappable property weighted by Zestimate spread.
  // Max positive spread in the set normalizes to 1.0; minimum floor 0.2
  // so weak signals still register on the heatmap.
  const heatPoints = useMemo<Array<[number, number, number]>>(() => {
    if (mappableProperties.length === 0) return [];
    const spreads = mappableProperties.map((p) => {
      if (!p.price || !p.zestimate) return 0;
      return Math.max(0, p.zestimate - p.price);
    });
    const maxSpread = Math.max(...spreads, 1);
    return mappableProperties.map((p, i) => [
      p.latitude!,
      p.longitude!,
      Math.max(0.2, spreads[i] / maxSpread),
    ]);
  }, [mappableProperties]);

  const center: [number, number] = useMemo(() => {
    if (mappableProperties.length === 0) return [39.8283, -98.5795]; // Center of US
    const avgLat = mappableProperties.reduce((s, p) => s + p.latitude!, 0) / mappableProperties.length;
    const avgLng = mappableProperties.reduce((s, p) => s + p.longitude!, 0) / mappableProperties.length;
    return [avgLat, avgLng];
  }, [mappableProperties]);

  if (mappableProperties.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <p className="text-neutral-400 text-sm font-light">No properties with location data available for map view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row — legend swaps for a contextual hint in heat mode; toggle is flag-gated */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-neutral-400 flex-wrap">
          {view === 'markers' ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />
                $30K+ spread
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                Positive spread
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                Negative spread
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gray-500 inline-block" />
                No data
              </span>
            </>
          ) : (
            <span>Heat intensity reflects price-vs-Zestimate spread — red = strongest wholesale margin in this result set</span>
          )}
        </div>
        {heatmapEnabled && (
          <div className="inline-flex items-center rounded-md border border-white/[0.08] overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView('markers')}
              className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${
                view === 'markers' ? 'bg-cyan-500/10 text-cyan-300' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <MapPinIcon className="h-3 w-3" /> Markers
            </button>
            <button
              type="button"
              onClick={() => setView('heat')}
              className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${
                view === 'heat' ? 'bg-cyan-500/10 text-cyan-300' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Flame className="h-3 w-3" /> Heatmap
            </button>
          </div>
        )}
      </div>

      {/* Map container — same Leaflet base, heatlayer in heat mode, markers otherwise */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.06]" style={{ height: '500px' }}>
        <MapContainer
          center={center}
          zoom={10}
          scrollWheelZoom={true}
          zoomControl={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds properties={mappableProperties} />
          {view === 'heat' && heatmapEnabled && <HeatLayer points={heatPoints} />}
          {view === 'markers' && mappableProperties.map((property) => (
            <Marker
              key={property.id}
              position={[property.latitude!, property.longitude!]}
              icon={getMarkerIcon(property)}
              eventHandlers={{
                click: () => onSelectProperty(property),
              }}
            >
              <Popup>
                <div className="text-sm min-w-[200px]" style={{ color: '#1a1a1a' }}>
                  <p className="font-semibold text-base mb-1">
                    {property.price ? formatPrice(property.price) : 'Price N/A'}
                  </p>
                  <p className="text-xs text-gray-600 mb-2 leading-relaxed">{property.address}</p>
                  {property.zestimate && property.price && (
                    <p className={`text-xs font-medium mb-1 ${
                      property.zestimate - property.price >= 30000
                        ? 'text-green-700'
                        : property.zestimate - property.price > 0
                        ? 'text-yellow-700'
                        : 'text-red-700'
                    }`}>
                      Spread: {property.zestimate - property.price >= 0 ? '+' : ''}
                      ${((property.zestimate - property.price) / 1000).toFixed(0)}K
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {property.bedrooms != null && <span>{property.bedrooms} bed</span>}
                    {property.bathrooms != null && <span>{property.bathrooms} bath</span>}
                    {property.sqft != null && <span>{property.sqft.toLocaleString()} sqft</span>}
                  </div>
                  <button
                    onClick={() => onSelectProperty(property)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer bg-transparent border-none p-0"
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <p className="text-xs text-neutral-500">
        Showing {mappableProperties.length} of {properties.length} properties on map
        {mappableProperties.length < properties.length && ' (some lack location data)'}
      </p>

      {/* Custom styles for map markers */}
      <style>{`
        .custom-map-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .leaflet-popup-tip {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
}
