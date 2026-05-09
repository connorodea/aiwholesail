/**
 * Property → calculator prefill bridge.
 *
 * Turns a Property into a flat Record<string, number|string> that calculator
 * pages read via the `prefill=<base64-json>` URL param. Each calculator picks
 * the keys it cares about; missing keys fall back to its existing defaults.
 *
 * Why base64 instead of individual query params: keeps the URL short, lets
 * us add new fields without breaking older calculators, and the calculator
 * page only needs `usePrefill()` regardless of how many fields land there.
 */

import type { Property } from '@/types/zillow';
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';

export interface PrefillBag {
  // Identity
  address?: string;
  // Money
  price?: number;
  zestimate?: number;
  arv?: number;                 // Caller may pass an explicit ARV; defaults to zestimate
  // Property
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  lotSize?: number;
  // Derived (rules of thumb when concrete numbers aren't available)
  estimatedMonthlyRent?: number;       // 0.8% of price (mid-market RoT)
  estimatedAnnualPropertyTax?: number; // 1.2% of price (national avg)
  estimatedAnnualInsurance?: number;   // 0.5% of price
}

const RENT_PCT_OF_PRICE = 0.008;
const TAX_PCT_OF_VALUE = 0.012;
const INSURANCE_PCT_OF_VALUE = 0.005;

export function buildPrefillFromProperty(property: Property, opts?: { arv?: number }): PrefillBag {
  const price = Number(property.price) || 0;
  const zestimate = Number(property.zestimate) || 0;
  const arv = opts?.arv ?? (zestimate > 0 ? zestimate : (price > 0 ? Math.round(price * 1.1) : 0));
  const baseValue = arv || zestimate || price || 0;

  const bag: PrefillBag = {
    address: property.address,
    price,
    zestimate: zestimate || undefined,
    arv: arv || undefined,
    sqft: property.sqft,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    yearBuilt: property.yearBuilt,
    lotSize: property.lotSize,
  };

  if (price > 0) {
    bag.estimatedMonthlyRent = Math.round(price * RENT_PCT_OF_PRICE);
  }
  if (baseValue > 0) {
    bag.estimatedAnnualPropertyTax = Math.round(baseValue * TAX_PCT_OF_VALUE);
    bag.estimatedAnnualInsurance = Math.round(baseValue * INSURANCE_PCT_OF_VALUE);
  }
  return bag;
}

export function encodePrefill(bag: PrefillBag): string {
  // Strip undefined and stringify
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bag)) {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
  }
  // base64url so it's URL-safe without manual encoding
  const json = JSON.stringify(cleaned);
  if (typeof window !== 'undefined') {
    return window.btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodePrefill(encoded: string | null | undefined): PrefillBag | null {
  if (!encoded) return null;
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof window !== 'undefined'
      ? decodeURIComponent(escape(window.atob(padded)))
      : Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object') return parsed as PrefillBag;
  } catch {
    // Bad input — caller falls back to defaults
  }
  return null;
}

/**
 * Hook: read `?prefill=...` once on mount. Returns the bag or null.
 *
 * Calculator pages spread the relevant fields into their initial state via
 * a per-field accessor:
 *   const prefill = usePrefill();
 *   const [price, setPrice] = useState(prefill?.price ?? 300000);
 */
export function usePrefill(): PrefillBag | null {
  const [params] = useSearchParams();
  const raw = params.get('prefill');
  return useMemo(() => decodePrefill(raw), [raw]);
}

/**
 * Build a `/tools/<slug>?prefill=<encoded>` URL for a property.
 */
export function toolsUrlForProperty(toolSlug: string, property: Property, opts?: { arv?: number }): string {
  const bag = buildPrefillFromProperty(property, opts);
  const encoded = encodePrefill(bag);
  return `/tools/${toolSlug}?prefill=${encoded}`;
}
