/**
 * Map a `property_search_cache` row to the frontend `Property` shape.
 *
 * Pure function — no DB, no I/O. Extracted from routes/property.js so it can
 * be unit-tested without spinning up Express + Postgres. Pairs with
 * `GET /api/property/by-zpid` which resolves spread-alert email deep-links.
 *
 * The cache schema uses snake_case + nullable NUMERIC/INT columns; the
 * frontend Property type uses camelCase + `undefined` for missing values.
 * This mapper handles:
 *  - NUMERIC → Number (since `pg` returns strings for NUMERIC by default)
 *  - NULL/undefined → undefined (NOT 0, which would render as "0 bedrooms")
 *  - `image_url` (single) → `images: string[]` (array, even when single)
 *  - `status` default 'forSale' (the only status the cache currently holds)
 *
 * Returns a plain object — no class, so JSON.stringify works directly.
 */
function mapCachedRowToProperty(row) {
  if (!row || typeof row !== 'object') return null;

  return {
    id: row.zpid,
    zpid: row.zpid,
    address: row.address || '',
    price: Number(row.price) || 0,
    zestimate: row.zestimate != null ? Number(row.zestimate) : undefined,
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms != null ? Number(row.bathrooms) : undefined,
    sqft: row.sqft ?? undefined,
    propertyType: row.property_type || undefined,
    daysOnMarket: row.days_on_market ?? undefined,
    status: 'forSale',
    images: row.image_url ? [row.image_url] : [],
  };
}

/**
 * Guard for the `zpid` query param on the deep-link endpoint.
 * Zillow IDs are unsigned integers. Anything else is a typo, an attack, or
 * a different identifier scheme — reject early before hitting the DB.
 * Returns the validated string (so the caller can pass it to a parameterized
 * SQL placeholder) or null if invalid.
 */
function validateZpid(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\d{1,20}$/.test(trimmed)) return null;
  return trimmed;
}

module.exports = { mapCachedRowToProperty, validateZpid };
