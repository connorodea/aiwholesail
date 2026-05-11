/**
 * Adapters: source-specific shapes → UnifiedProperty.
 *
 * These are the ONLY place where vendor field names (Zillow's `zpid`,
 * `zestimate`; PropData's `parcel_id`, `valuation.market_value`) should
 * be referenced. Everywhere downstream should consume UnifiedProperty.
 *
 * Both mappers are pure functions — no I/O, no side effects, safe to
 * call inside React render. Missing source fields produce `undefined`
 * unified fields rather than synthetic defaults; the analyzer is the
 * single place that fills in computed values.
 */

import type { Property } from '@/types/zillow';
import type { PropDataPropertyRecord } from '@/lib/propdata-api';
import type { UnifiedProperty } from '@/types/unifiedProperty';

// ─── Zillow → Unified ──────────────────────────────────────────────────────

interface ZillowExtras {
  // Fields that exist at runtime on Property records but aren't declared
  // in the Property interface. Listed here for type safety inside the
  // mapper without polluting the global Property shape.
  city?: string;
  state?: string;
  zipcode?: string;
  livingArea?: number;
  homeType?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  detailUrl?: string;
  zestimateUnavailable?: boolean;
}

export function mapZillowToUnified(p: Property): UnifiedProperty {
  const ext = p as Property & ZillowExtras;
  return {
    id: p.zpid || p.id || p.address,
    source: 'on-market',

    address: p.address,
    city: ext.city,
    state: ext.state,
    zip: ext.zipcode,
    county: ext.county,
    lat: ext.latitude,
    lng: ext.longitude,

    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    sqft: p.sqft ?? ext.livingArea,
    lotSqft: p.lotSize,
    yearBuilt: p.yearBuilt,
    propertyType: p.propertyType ?? ext.homeType,

    listing: {
      listPrice: p.price,
      estimate: p.zestimate,
      daysOnMarket: p.daysOnMarket,
      listDate: p.listDate ?? p.datePostedString,
      pricePerSqft: p.pricePerSqft,
      isFSBO: p.isFSBO,
      status: p.status,
      listingUrl: p.listingUrl ?? ext.detailUrl,
      mlsId: p.mlsId,
      mlsName: p.mlsName,
      photos: p.images,
    },

    agent: (p.agentName || p.agentPhone || p.agentEmail)
      ? {
          name: p.agentName,
          phone: p.agentPhone ?? p.brokerPhone,
          email: p.agentEmail,
          licenseNumber: p.agentLicenseNumber,
          brokerage: p.brokerageName ?? p.brokerName,
          photoUrl: p.agentPhotoUrl,
        }
      : undefined,

    // Zillow doesn't surface owner-of-record by default. AttomData add-on
    // sometimes provides assessor figures — pulled into `record` below.
    record: p.attomData
      ? {
          assessedValue: p.attomData.taxAssessedValue,
          marketValue: p.attomData.marketValue ?? p.attomData.avm?.amount,
        }
      : undefined,

    _raw: p,
  };
}

// ─── PropData → Unified ────────────────────────────────────────────────────

/**
 * `enrichment` is a ZIP-level block that PropData returns alongside the
 * `properties` array — opportunity zone, flood zone, USDA rural status.
 * Mappers receive it explicitly so risk flags carry through.
 */
export interface PropDataEnrichment {
  is_opportunity_zone?: boolean;
  usda_rural_eligible?: boolean;
  fema_flood_zone?: string | null;
}

export function mapPropDataToUnified(
  rec: PropDataPropertyRecord,
  enrichment?: PropDataEnrichment
): UnifiedProperty {
  const a = rec.address;
  const o = rec.owner;
  const v = rec.valuation;
  const s = rec.sale;
  const c = rec.characteristics;
  const e = rec.equity;
  const f = rec.flags;

  const fullAddress = [a?.street, a?.city, a?.zip].filter(Boolean).join(', ');

  return {
    id: rec.parcel_id || fullAddress,
    source: 'off-market',

    address: a?.street || fullAddress || 'Unknown',
    city: a?.city,
    state: rec.state,
    zip: a?.zip,
    county: rec.county_name,

    bedrooms: c?.bedrooms ?? undefined,
    bathrooms: c?.bathrooms ?? undefined,
    sqft: c?.sq_ft_living ?? undefined,
    lotSqft: c?.sq_ft_lot ?? undefined,
    yearBuilt: c?.year_built,
    propertyType: c?.property_type,

    // No listing — off-market by definition. The analyzer accounts for this
    // by computing MAO from market value instead of a list price spread.
    listing: undefined,

    owner: (o?.name || o?.mailing_address || e || f?.is_absentee_owner)
      ? {
          name: o?.name,
          mailingAddress: o?.mailing_address,
          mailingCity: o?.mailing_city,
          mailingState: o?.mailing_state,
          mailingZip: o?.mailing_zip,
          isAbsentee: f?.is_absentee_owner,
          estimatedEquity: e?.estimated_equity,
          equityPct: e?.equity_pct,
          yearsHeld: e?.years_held,
        }
      : undefined,

    record: {
      assessedValue: v?.assessed_value,
      marketValue: v?.market_value,
      landValue: v?.land_value,
      improvementValue: v?.improvement_value,
      lastSalePrice: s?.last_sale_price,
      lastSaleDate: s?.last_sale_date,
      taxYear: v?.tax_year,
      apn: rec.parcel_id,
    },

    risk: enrichment
      ? {
          floodZone: enrichment.fema_flood_zone || undefined,
          isOpportunityZone: enrichment.is_opportunity_zone,
          usdaRuralEligible: enrichment.usda_rural_eligible,
        }
      : undefined,

    _raw: rec,
  };
}

/** Convenience: map a full PropData list response. */
export function mapPropDataListToUnified(list: {
  properties?: PropDataPropertyRecord[];
  enrichment?: PropDataEnrichment;
}): UnifiedProperty[] {
  return (list.properties ?? []).map((rec) => mapPropDataToUnified(rec, list.enrichment));
}

/** Convenience: bulk-map Zillow results. */
export function mapZillowListToUnified(properties: Property[]): UnifiedProperty[] {
  return properties.map(mapZillowToUnified);
}
