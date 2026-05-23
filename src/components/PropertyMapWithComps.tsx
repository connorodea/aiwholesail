/**
 * Property-detail map view with nearby comparable properties.
 *
 * Renders the subject property as a primary marker (cyan) and up to N
 * comparable sales as secondary markers (amber). Each marker:
 *   - is clickable (mouse + Enter/Space when focused)
 *   - has a tooltip with address, price, beds/baths, sqft
 *   - is keyboard-focusable for a11y
 *   - exposes a screen-reader label via aria-label
 *
 * Bounds auto-fit on first render and on comps[] count change so the map
 * always includes everything we want to show — same convention as the
 * existing `PropertyMap` component (search results), but the subject is
 * always anchored.
 *
 * Uses Leaflet + OpenStreetMap tiles (no API key required). Leaflet was
 * already pulled in by `PropertyMap.tsx` so no new dependencies are added.
 *
 * A "Skip map" link is rendered before the map for keyboard users who
 * don't want to tab through every marker.
 */

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet bundles its default marker icons as static assets that bundlers
// can't resolve out of the box. We use SVG divIcons below — these fallbacks
// only matter if a downstream consumer adds a default-icon Marker.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface MapSubject {
  zpid?: string;
  address: string;
  lat: number;
  lng: number;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
}

export interface MapComp {
  zpid?: string;
  address: string;
  lat: number;
  lng: number;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  /** Distance in miles from the subject — shown in the popup when present. */
  distance?: number;
}

interface PropertyMapWithCompsProps {
  subject: MapSubject;
  comps: MapComp[];
  /** Container height. Defaults to 400px. */
  height?: string;
  /** Click handler for marker → triggers detail view in caller. Optional. */
  onSelectComp?: (comp: MapComp) => void;
}

/** Build a colored teardrop SVG icon — same visual family as PropertyMap. */
function createIcon(color: string, size: number, ariaLabel: string): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${size}" height="${Math.round(size * 1.43)}" role="img" aria-label="${ariaLabel}">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#000" stroke-width="0.5" stroke-opacity="0.3"/>
      <circle cx="12" cy="12" r="5" fill="white" fill-opacity="0.92"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'aw-map-marker',
    iconSize: [size, Math.round(size * 1.43)],
    iconAnchor: [Math.round(size / 2), Math.round(size * 1.43)],
    popupAnchor: [0, -Math.round(size * 1.43)],
  });
}

// Cyan = subject, amber = comps. Larger subject so it's instantly identifiable
// against the comp markers.
const subjectIcon = createIcon('#00c4c8', 36, 'Subject property');
const compIcon = createIcon('#f59e0b', 28, 'Comparable property');

function fmtPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return 'Price N/A';
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${Math.round(price)}`;
}

function fmtSqft(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return `${n.toLocaleString()} sqft`;
}

/**
 * Fits the map bounds to include the subject + all comp points. We re-fit
 * whenever the comp count changes (so adding/removing comps re-centers)
 * but NOT on every render — that would steal back the user's manual pan/zoom.
 */
function FitBounds({
  subject,
  comps,
}: {
  subject: MapSubject;
  comps: MapComp[];
}) {
  const map = useMap();
  const lastCountRef = useRef<number>(-1);

  useEffect(() => {
    if (lastCountRef.current === comps.length) return;
    lastCountRef.current = comps.length;

    const points: Array<[number, number]> = [[subject.lat, subject.lng]];
    for (const c of comps) {
      if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
        points.push([c.lat, c.lng]);
      }
    }
    if (points.length === 1) {
      // Just the subject — keep a sensible default zoom so we don't fly to z=18
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, subject.lat, subject.lng, comps]);

  return null;
}

/**
 * Marker for one comp — keyboard-focusable with Enter/Space triggering the
 * popup + onSelectComp. Leaflet's default marker isn't keyboard-accessible,
 * so we attach a focusable element via the icon's title + use a ref + a
 * tabindex on the marker element.
 */
function CompMarker({
  comp,
  onSelect,
}: {
  comp: MapComp;
  onSelect?: (comp: MapComp) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    el.setAttribute('tabindex', '0');
    el.setAttribute(
      'aria-label',
      `Comparable property: ${comp.address}, ${fmtPrice(comp.price)}` +
        (comp.bedrooms != null ? `, ${comp.bedrooms} bedrooms` : '') +
        (comp.bathrooms != null ? `, ${comp.bathrooms} bathrooms` : '')
    );
    el.setAttribute('role', 'button');
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        markerRef.current?.openPopup();
        onSelect?.(comp);
      }
    };
    el.addEventListener('keydown', handler);
    return () => {
      el.removeEventListener('keydown', handler);
    };
  }, [comp, onSelect]);

  return (
    <Marker
      ref={markerRef}
      position={[comp.lat, comp.lng]}
      icon={compIcon}
      eventHandlers={{
        click: () => onSelect?.(comp),
      }}
    >
      <Popup>
        <div className="text-sm min-w-[200px]" style={{ color: '#1a1a1a' }}>
          <p className="font-semibold text-base mb-1">{fmtPrice(comp.price)}</p>
          <p className="text-xs text-gray-600 mb-2 leading-relaxed">{comp.address}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            {comp.bedrooms != null && <span>{comp.bedrooms} bed</span>}
            {comp.bathrooms != null && <span>{comp.bathrooms} bath</span>}
            {comp.sqft != null && <span>{fmtSqft(comp.sqft)}</span>}
            {comp.distance != null && Number.isFinite(comp.distance) && (
              <span>{comp.distance.toFixed(2)} mi away</span>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export function PropertyMapWithComps({
  subject,
  comps,
  height = '400px',
  onSelectComp,
}: PropertyMapWithCompsProps) {
  // Filter to comps with valid coordinates only — anything missing lat/lng
  // can't be mapped, and showing 0/0 would mislead the user.
  const mappableComps = useMemo(
    () =>
      comps.filter(
        (c) =>
          Number.isFinite(c.lat) &&
          Number.isFinite(c.lng) &&
          c.lat !== 0 &&
          c.lng !== 0
      ),
    [comps]
  );

  const subjectMarkerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    const el = subjectMarkerRef.current?.getElement();
    if (!el) return;
    el.setAttribute('tabindex', '0');
    el.setAttribute(
      'aria-label',
      `Subject property: ${subject.address}, ${fmtPrice(subject.price)}` +
        (subject.bedrooms != null ? `, ${subject.bedrooms} bedrooms` : '') +
        (subject.bathrooms != null ? `, ${subject.bathrooms} bathrooms` : '')
    );
    el.setAttribute('role', 'button');
  }, [subject]);

  // If the subject itself has no valid coordinates, there's nothing to render
  // — fall back to a small notice rather than dropping a 0/0 marker in the
  // Atlantic Ocean.
  if (
    !Number.isFinite(subject.lat) ||
    !Number.isFinite(subject.lng) ||
    (subject.lat === 0 && subject.lng === 0)
  ) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]"
        style={{ height }}
      >
        <p className="text-sm text-neutral-400 font-light">
          No location data available — map view unavailable for this property.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Skip-map link for keyboard users — visually hidden until focused */}
      <a
        href="#aw-map-with-comps-end"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[1000] focus:bg-background focus:text-foreground focus:px-3 focus:py-1.5 focus:rounded-md focus:border focus:border-border focus:shadow-md text-xs"
      >
        Skip map
      </a>

      {/* Legend — keeps the colour key visible even when the map is below the
          fold so users on small screens understand the distinction. */}
      <div className="flex items-center gap-4 text-xs text-neutral-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: '#00c4c8' }}
            aria-hidden="true"
          />
          Subject property
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: '#f59e0b' }}
            aria-hidden="true"
          />
          Comparable sale ({mappableComps.length})
        </span>
      </div>

      <div
        className="rounded-2xl overflow-hidden border border-white/[0.06]"
        style={{ height }}
        aria-label="Map showing the subject property and nearby comparable sales"
      >
        <MapContainer
          center={[subject.lat, subject.lng]}
          zoom={14}
          scrollWheelZoom
          zoomControl
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds subject={subject} comps={mappableComps} />

          <Marker
            ref={subjectMarkerRef}
            position={[subject.lat, subject.lng]}
            icon={subjectIcon}
          >
            <Popup>
              <div className="text-sm min-w-[200px]" style={{ color: '#1a1a1a' }}>
                <p className="font-semibold text-base mb-1">
                  {fmtPrice(subject.price)}
                </p>
                <p className="text-xs text-gray-700 mb-1 font-medium">Subject property</p>
                <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                  {subject.address}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  {subject.bedrooms != null && <span>{subject.bedrooms} bed</span>}
                  {subject.bathrooms != null && <span>{subject.bathrooms} bath</span>}
                  {subject.sqft != null && <span>{fmtSqft(subject.sqft)}</span>}
                </div>
              </div>
            </Popup>
          </Marker>

          {mappableComps.map((c, i) => (
            <CompMarker
              key={`${c.zpid || c.address}-${i}`}
              comp={c}
              onSelect={onSelectComp}
            />
          ))}
        </MapContainer>
      </div>

      <p id="aw-map-with-comps-end" className="text-xs text-neutral-500">
        {mappableComps.length === 0
          ? 'No nearby comparable properties with location data yet.'
          : `Showing the subject plus ${mappableComps.length} nearby ${
              mappableComps.length === 1 ? 'comparable sale' : 'comparable sales'
            }.`}
      </p>

      {/* Same marker styles as PropertyMap, kept local so the component is
          self-contained when dropped in elsewhere. */}
      <style>{`
        .aw-map-marker {
          background: transparent !important;
          border: none !important;
        }
        .aw-map-marker:focus {
          outline: 2px solid #00c4c8;
          outline-offset: 2px;
          border-radius: 50%;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
}
