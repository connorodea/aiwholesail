/**
 * Self-hosted Zillow scraper, routed through scrape.do.
 *
 * Replaces specific RapidAPI `zillow-working-api` actions with direct
 * HTML scrapes of Zillow's own pages. We extract Zillow's `__NEXT_DATA__`
 * JSON blob (a serialized Apollo store embedded in every listing page)
 * and reshape it to match the field names downstream code already expects
 * — `data.zpid`, `data.ownerName`, `data.zestimate`, `data.taxAnnualAmount`,
 * etc. as consumed in routes/property.js `/intelligence`.
 *
 * Implemented actions (mirrors the RapidAPI proxy surface):
 *   Detail-class — fetches one detail page, slices the parsed property:
 *     propertyDetails       full Property record
 *     photos                photos[] only
 *     taxes                 taxHistory + taxAnnualAmount + taxAssessedValue
 *     priceHistory          priceHistory[] (list, price-change, sold events)
 *     zestimate             current zestimate + low/high range + rentZestimate
 *     schools               schools[] (ratings + distance)
 *     comps                 homeRecommendations[] (Zillow's "Similar Homes")
 *
 *   Search-class — fetches a /homes/<location>_rb/ page, parses listResults:
 *     search                generic, takes {location, status, filters, page}
 *     searchByAddress       alias — runs search() with the address as location
 *     forSale, forRent, recentlySold, foreclosures, fsbo
 *                           filter-preset wrappers over search()
 *
 *   Coordinate / URL search variants:
 *     searchByCoordinates   {lat, lng, radius_mi} → builds searchQueryState mapBounds
 *     searchByBounds        {sw_lat, sw_lng, ne_lat, ne_lng} → direct rectangle
 *     searchByUrl           accepts a full Zillow URL (validated to www.zillow.com)
 *
 *   Value / agent / market / mortgage:
 *     zestimateHistory      time-series snapshots from homeValueChartData on
 *                           the detail page
 *     mortgageRates         scrapes /mortgage-rates/<zip|state> page
 *     mortgageCalculator    pure math — no network call (PMT formula)
 *     agentProfile          scrapes /profile/<slug>/ page
 *     marketStats           scrapes /<region>/home-values/ page
 *
 * All detail-class actions share one underlying scrape per zpid (one cost),
 * so calling taxes + photos + comps for the same property triple-counts
 * against the scrape.do bill. Callers that need several slices should call
 * propertyDetails once and slice in-process — these convenience wrappers
 * exist so the agent-tool layer can stay one-action-one-call.
 *
 * Failure semantics: if scrape.do returns success but the HTML doesn't
 * contain a parseable __NEXT_DATA__ blob (Zillow served a captcha or
 * dropped a soft-403), we throw — the caller decides whether to fall back
 * to RapidAPI. We never return partially-parsed garbage.
 */

const { scrape, ScrapeDoError } = require('./scrapeDoClient');

const ZILLOW_BASE = 'https://www.zillow.com';
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

class ZillowScrapeError extends Error {
  constructor(message, { status = 0, action, reason } = {}) {
    super(message);
    this.name = 'ZillowScrapeError';
    this.status = status;
    this.action = action;
    this.reason = reason;
  }
}

// ─────────────────────────── HTML → __NEXT_DATA__ ───────────────────────────

const NEXT_DATA_RE =
  /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i;

/**
 * Pull the __NEXT_DATA__ JSON blob from a Zillow HTML page.
 * Throws ZillowScrapeError if the blob is missing — likely a captcha or
 * a 200-OK soft-block from Zillow.
 */
function extractNextData(html) {
  if (typeof html !== 'string' || html.length < 200) {
    throw new ZillowScrapeError('Zillow returned empty/short body', {
      reason: 'empty_html',
    });
  }
  const m = html.match(NEXT_DATA_RE);
  if (!m) {
    throw new ZillowScrapeError('Zillow page missing __NEXT_DATA__ (likely block)', {
      reason: 'no_next_data',
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(m[1]);
  } catch (err) {
    throw new ZillowScrapeError(`Could not JSON.parse __NEXT_DATA__: ${err.message}`, {
      reason: 'json_parse',
    });
  }
  return parsed;
}

/**
 * Walk the Apollo cache inside __NEXT_DATA__ and pull out the Property record.
 * Zillow's structure has changed several times; we check the known paths in
 * order and fall back to a recursive search for a node that looks like a
 * Property (has zpid + price OR zestimate).
 */
function findPropertyRecord(nextData) {
  // Most-common: props.pageProps.componentProps.gdpClientCache as a JSON string
  // containing { "PropertyV2.0_<zpid>": { property: {...} } }
  const componentProps = nextData?.props?.pageProps?.componentProps;
  const cacheStr = componentProps?.gdpClientCache;
  if (typeof cacheStr === 'string' && cacheStr.length > 10) {
    try {
      const cache = JSON.parse(cacheStr);
      for (const key of Object.keys(cache)) {
        const node = cache[key];
        if (node && typeof node === 'object' && node.property) {
          return node.property;
        }
      }
    } catch {
      // fall through to deep search
    }
  }

  // Sometimes the record sits directly on componentProps.property
  if (componentProps?.property && typeof componentProps.property === 'object') {
    return componentProps.property;
  }

  // Last resort: recurse looking for a zpid-bearing object that has price-like fields.
  return deepFindProperty(nextData);
}

function deepFindProperty(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (
    typeof node.zpid !== 'undefined' &&
    (node.price !== undefined ||
      node.zestimate !== undefined ||
      node.livingArea !== undefined ||
      node.address !== undefined)
  ) {
    return node;
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const v of values) {
    const found = deepFindProperty(v, depth + 1);
    if (found) return found;
  }
  return null;
}

// ─────────────────────────── Property → RapidAPI shape ──────────────────────

/**
 * Map a parsed Zillow Property record to the field names the rest of the
 * codebase already consumes (the existing /pro/byaddress payload). Anything
 * the page didn't include comes through as undefined.
 *
 * Many of the wholesaler-critical fields (HOA, year renovated, parking,
 * listing agent, open houses, foreclosure stage) live under `resoFacts` and
 * `attributionInfo` in Zillow's __NEXT_DATA__. We hoist them to top-level so
 * downstream consumers don't have to know about Zillow's internal shape.
 */
function mapPropertyToRapidApiShape(p) {
  if (!p || typeof p !== 'object') return null;
  const addr = p.address || {};
  const addressString =
    p.streetAddress && p.city && p.state
      ? `${p.streetAddress}, ${p.city}, ${p.state} ${p.zipcode || ''}`.trim()
      : [addr.streetAddress, addr.city, addr.state, addr.zipcode].filter(Boolean).join(', ');

  const photos = Array.isArray(p.responsivePhotos)
    ? p.responsivePhotos
        .map((ph) => ph?.mixedSources?.jpeg?.[0]?.url || ph?.url || null)
        .filter(Boolean)
    : Array.isArray(p.photos)
      ? p.photos.map((ph) => ph?.url || ph).filter(Boolean)
      : [];

  // ── HOA — top-level keys + resoFacts fallback (Zillow shipped both) ───
  const resoFacts = (p.resoFacts && typeof p.resoFacts === 'object') ? p.resoFacts : {};

  // Trim-aware non-empty string. Used for ID-shaped fields (apn, mlsNumber)
  // where Zillow's "absent" payload variants include "", "   ", and numbers.
  // Numbers are coerced to string and trimmed (a parcel number arriving as
  // `12345678` should surface as `"12345678"`, not `undefined`).
  const safeString = (v) => {
    if (v == null) return undefined;
    const s = typeof v === 'string' ? v : String(v);
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  const monthlyHoaFee = p.monthlyHoaFee ?? p.hoaFee ?? resoFacts.hoaFee ?? undefined;
  const hoaFeeFrequency =
    p.hoaFeeFrequency ?? resoFacts.hoaFeeFrequency ?? undefined;
  const hoaAnnualAmount =
    monthlyHoaFee != null && (!hoaFeeFrequency || /month/i.test(String(hoaFeeFrequency)))
      ? Number(monthlyHoaFee) * 12
      : monthlyHoaFee != null && /year|annual/i.test(String(hoaFeeFrequency))
        ? Number(monthlyHoaFee)
        : undefined;

  // ── Listing agent — `attributionInfo` is canonical (broker disclosure) ──
  const attribution = (p.attributionInfo && typeof p.attributionInfo === 'object')
    ? p.attributionInfo
    : {};
  const listingAgent = attribution.agentName
    ? {
        name: attribution.agentName,
        email: attribution.agentEmail || undefined,
        phone: attribution.agentPhoneNumber || undefined,
        licenseNumber: attribution.agentLicenseNumber || undefined,
        brokerage: attribution.brokerName || attribution.buyerBrokerName || undefined,
        brokeragePhone: attribution.brokerPhoneNumber || undefined,
        mlsId: attribution.mlsId || undefined,
        mlsName: attribution.mlsName || undefined,
      }
    : undefined;

  // ── Open houses — array of {startTime, endTime} entries ─────────────
  const openHouses = Array.isArray(p.openHouseSchedule)
    ? p.openHouseSchedule
        .filter((oh) => oh && (oh.startTime || oh.startDate))
        .map((oh) => ({
          startTime: oh.startTime || oh.startDate || undefined,
          endTime: oh.endTime || oh.endDate || undefined,
          openHouseType: oh.openHouseType || undefined,
        }))
    : undefined;
  const nextOpenHouse = openHouses && openHouses.length > 0 ? openHouses[0] : undefined;

  // ── Price-reduction signal (wholesalers chase price-cut listings) ───
  const priceReduction = (() => {
    if (Array.isArray(p.priceHistory) && p.priceHistory.length > 1) {
      // Find latest price-change event with a delta
      const sorted = [...p.priceHistory].filter((h) => h && h.date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const last = sorted[0];
      const prev = sorted[1];
      if (last && prev && Number(last.price) < Number(prev.price)) {
        return {
          isPriceReduced: true,
          amount: Number(prev.price) - Number(last.price),
          changeDate: last.date,
          previousPrice: Number(prev.price),
          currentPrice: Number(last.price),
        };
      }
    }
    if (p.priceChange != null) {
      return {
        isPriceReduced: Number(p.priceChange) < 0,
        amount: Math.abs(Number(p.priceChange)),
        changeDate: p.priceChangeDate || undefined,
      };
    }
    return undefined;
  })();

  // ── Foreclosure stage — Zillow distinguishes 4 phases ─────────────
  const foreclosureStage = (() => {
    const f = p.foreclosure || {};
    if (p.isReo || f.isReo) return 'REO';
    if (p.isAuction || p.isPreForeclosureAuction || f.isAuction) return 'AUCTION';
    if (p.isPreForeclosure || f.isPreForeclosure) return 'PRE_FORECLOSURE';
    if (p.isForeclosure || f.isForeclosure) return 'FORECLOSURE';
    return undefined;
  })();

  // ── Owner-occupancy — compare owner mailing address to property address.
  // Wholesalers filter HARD on this — absentee owners are the highest-yield
  // direct-mail / call cohort. We normalize aggressively (lowercase + strip
  // every non-alphanumeric) so cosmetic differences (commas, "St" vs "St.",
  // double spaces, ZIP+4) don't produce false negatives. If ownerAddress is
  // absent we return undefined — "unknown" is meaningfully different from
  // "owner-occupied = false" in downstream filters.
  const normalizeAddr = (s) =>
    typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9]+/g, '') : '';
  const isOwnerOccupied = (() => {
    if (!p.ownerAddress && !p.owner?.mailingAddress) return undefined;
    const ownerAddr = normalizeAddr(p.ownerAddress || p.owner?.mailingAddress || '');
    const propAddr = normalizeAddr(
      [p.streetAddress, p.city, p.state, p.zipcode].filter(Boolean).join(' ')
    );
    if (!ownerAddr || !propAddr) return undefined;
    return ownerAddr === propAddr;
  })();

  // ── Tax history (normalized) — keep raw `taxHistory` untouched for back-
  // compat, but emit a year-keyed normalized form for new consumers.
  const taxHistoryNormalized = Array.isArray(p.taxHistory)
    ? p.taxHistory
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const t = row.time;
          const ts = typeof t === 'number' ? t : t != null ? Number(t) : NaN;
          const date = Number.isFinite(ts) ? new Date(ts) : null;
          return {
            year: date ? date.getUTCFullYear() : undefined,
            date: date ? date.toISOString() : undefined,
            taxPaid: row.taxPaid ?? undefined,
            assessedValue: row.value ?? row.assessedValue ?? undefined,
            valueIncrease: row.valueIncreaseRate ?? row.valueIncrease ?? undefined,
          };
        })
        .filter((r) => r && r.year != null)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
    : undefined;

  // ── School district — assemble from three resoFacts keys ─────────────
  const schoolDistrict =
    resoFacts.elementarySchoolDistrict ||
    resoFacts.middleOrJuniorSchoolDistrict ||
    resoFacts.highSchoolDistrict
      ? {
          elementary: resoFacts.elementarySchoolDistrict || undefined,
          middleOrJunior: resoFacts.middleOrJuniorSchoolDistrict || undefined,
          high: resoFacts.highSchoolDistrict || undefined,
        }
      : undefined;

  return {
    zpid: p.zpid != null ? String(p.zpid) : undefined,
    address: addressString || undefined,
    streetAddress: p.streetAddress || addr.streetAddress,
    city: p.city || addr.city,
    state: p.state || addr.state,
    zipcode: p.zipcode || addr.zipcode,
    price: p.price ?? p.listPrice ?? undefined,
    zestimate: p.zestimate ?? undefined,
    rentZestimate: p.rentZestimate ?? undefined,
    bedrooms: p.bedrooms ?? undefined,
    bathrooms: p.bathrooms ?? undefined,
    livingArea: p.livingArea ?? p.livingAreaValue ?? undefined,
    lotSize: p.lotSize ?? p.lotAreaValue ?? undefined,
    lotSizeDimensions: resoFacts.lotSizeDimensions ?? undefined,
    lotFeatures: Array.isArray(resoFacts.lotFeatures) ? resoFacts.lotFeatures : undefined,
    yearBuilt: p.yearBuilt ?? undefined,
    // `yearBuiltEffective` is Zillow's "year renovated" — when the home was
    // last substantially renovated. Often higher ARV signal than yearBuilt.
    yearRenovated: resoFacts.yearBuiltEffective ?? p.yearBuiltEffective ?? undefined,
    homeType: p.homeType ?? p.propertyTypeDimension ?? undefined,
    homeStatus: p.homeStatus ?? undefined,
    // Distinct from homeStatus; pendingDate when the home went pending.
    pendingDate: p.pendingDate ?? resoFacts.contingency ?? undefined,
    daysOnZillow: p.daysOnZillow ?? undefined,
    // `onMarketDate` is the original listing date; daysOnMarket is derived
    // from it and may differ from daysOnZillow (relistings reset DoZ).
    onMarketDate: p.onMarketDate ?? resoFacts.onMarketDate ?? undefined,
    daysOnMarket: p.daysOnMarket ?? resoFacts.daysOnZillow ?? undefined,
    description: p.description || undefined,
    taxAssessedValue: p.taxAssessedValue ?? undefined,
    taxAnnualAmount: p.taxAnnualAmount ?? undefined,
    taxHistory: Array.isArray(p.taxHistory) ? p.taxHistory : undefined,
    priceHistory: Array.isArray(p.priceHistory) ? p.priceHistory : undefined,
    schools: Array.isArray(p.schools) ? p.schools : undefined,
    ownerName: p.ownerName || p.owner?.fullName || undefined,
    ownerAddress: p.ownerAddress || p.owner?.mailingAddress || undefined,
    isAbsenteeOwner: p.isAbsenteeOwner ?? undefined,
    isForeclosure: p.isForeclosure ?? p.foreclosure?.isForeclosure ?? undefined,
    isPreForeclosureAuction: p.isPreForeclosureAuction ?? undefined,
    foreclosureStage,
    foreclosureAmount: p.foreclosureAmount ?? p.foreclosure?.unpaidBalance ?? undefined,
    foreclosureAuctionDate:
      p.foreclosureAuctionDate ?? p.foreclosure?.auctionDate ?? undefined,
    foreclosurePastDueBalance:
      p.foreclosurePastDueBalance ?? p.foreclosure?.pastDueBalance ?? undefined,
    isTaxDelinquent: p.isTaxDelinquent ?? p.taxDelinquent ?? undefined,
    // HOA (hoisted from resoFacts)
    monthlyHoaFee: monthlyHoaFee != null ? Number(monthlyHoaFee) : undefined,
    hoaFeeFrequency,
    hoaAnnualAmount: hoaAnnualAmount != null ? Number(hoaAnnualAmount) : undefined,
    // Parking
    parkingCapacity:
      resoFacts.parkingCapacity ?? resoFacts.garageParkingCapacity ?? p.parkingCapacity ?? undefined,
    parkingFeatures: Array.isArray(resoFacts.parkingFeatures)
      ? resoFacts.parkingFeatures
      : undefined,
    hasGarage: resoFacts.hasGarage ?? p.hasGarage ?? undefined,
    // Heating / cooling
    heating: Array.isArray(resoFacts.heating)
      ? resoFacts.heating
      : resoFacts.heating
        ? [resoFacts.heating]
        : undefined,
    cooling: Array.isArray(resoFacts.cooling)
      ? resoFacts.cooling
      : resoFacts.cooling
        ? [resoFacts.cooling]
        : undefined,
    // Listing agent
    listingAgent,
    // Open houses
    openHouses,
    nextOpenHouse,
    // Price-reduction signal
    priceReduction,
    isPriceReduced: priceReduction?.isPriceReduced ?? undefined,
    photos,
    hdpUrl: p.hdpUrl
      ? p.hdpUrl.startsWith('http')
        ? p.hdpUrl
        : `${ZILLOW_BASE}${p.hdpUrl}`
      : undefined,
    latitude: p.latitude ?? p.location?.latitude ?? undefined,
    longitude: p.longitude ?? p.location?.longitude ?? undefined,
    // ── Construction & systems (Tier A) ─────────────────────────────
    // Always emit array form so frontend consumers can `.map(...)` safely.
    // Mirrors the heating/cooling pattern at L377-386.
    foundation: Array.isArray(resoFacts.foundationDetails)
      ? resoFacts.foundationDetails
      : resoFacts.foundation
        ? [resoFacts.foundation]
        : undefined,
    roofType: resoFacts.roof ?? resoFacts.roofType ?? undefined,
    constructionMaterials: Array.isArray(resoFacts.constructionMaterials)
      ? resoFacts.constructionMaterials
      : undefined,
    exteriorFeatures: Array.isArray(resoFacts.exteriorFeatures)
      ? resoFacts.exteriorFeatures
      : undefined,
    structureType: resoFacts.structureType ?? undefined,
    architecturalStyle: resoFacts.architecturalStyle ?? undefined,
    stories: resoFacts.stories ?? resoFacts.storiesTotal ?? undefined,
    basement: resoFacts.basement ?? undefined,
    basementArea: resoFacts.basementSize ?? undefined,
    finishedAreaAboveGrade: resoFacts.aboveGradeFinishedArea ?? undefined,
    finishedAreaBelowGrade: resoFacts.belowGradeFinishedArea ?? undefined,
    flooring: Array.isArray(resoFacts.flooring) ? resoFacts.flooring : undefined,
    fireplaceCount: resoFacts.fireplaces ?? resoFacts.fireplacesTotal ?? undefined,
    appliances: Array.isArray(resoFacts.appliances) ? resoFacts.appliances : undefined,
    // ── Utilities (Tier A) ─────────────────────────────────────────
    waterSource: Array.isArray(resoFacts.waterSource) ? resoFacts.waterSource : undefined,
    sewer: Array.isArray(resoFacts.sewer) ? resoFacts.sewer : undefined,
    electric: Array.isArray(resoFacts.electric) ? resoFacts.electric : undefined,
    electricUtilityCompany: resoFacts.electricUtilityCompany ?? undefined,
    gas: Array.isArray(resoFacts.gas) ? resoFacts.gas : undefined,
    // ── Lot / parcel / location (Tier A) — apn is THE skip-tracing key ─
    // safeString handles numeric + string + whitespace-only + empty inputs.
    apn: safeString(resoFacts.parcelNumber),
    zoning: resoFacts.zoning ?? undefined,
    zoningDescription: resoFacts.zoningDescription ?? undefined,
    countyFips: resoFacts.countyFIPS ?? resoFacts.countyFips ?? undefined,
    subdivisionName: resoFacts.subdivisionName ?? resoFacts.communityName ?? undefined,
    schoolDistrict,
    // ── Listing terms (Tier A) — HIGHEST wholesaler value ─────────────
    // specialListingConditions flags REO / short-sale / probate / court approval.
    // listingTerms === ["Cash"] alone is a strong distressed-seller signal.
    // cumulativeDaysOnMarket is the TRUE distress signal — daysOnZillow resets
    // on every relist, so a 30-day DoZ home can have 240 cumulative days.
    specialListingConditions: Array.isArray(resoFacts.specialListingConditions)
      ? resoFacts.specialListingConditions
      : undefined,
    disclosures: Array.isArray(resoFacts.disclosures) ? resoFacts.disclosures : undefined,
    listingTerms: Array.isArray(resoFacts.listingTerms) ? resoFacts.listingTerms : undefined,
    buyerCommission:
      resoFacts.buyerAgencyCompensation != null || resoFacts.buyerAgencyCompensationType != null
        ? {
            amount: resoFacts.buyerAgencyCompensation ?? undefined,
            type: resoFacts.buyerAgencyCompensationType ?? undefined,
          }
        : undefined,
    possession: resoFacts.possession ?? undefined,
    contingencyType: resoFacts.contingentListingType ?? undefined,
    cumulativeDaysOnMarket: resoFacts.cumulativeDaysOnMarket ?? undefined,
    lastStatusChange:
      p.lastStatusChangeDate != null || p.isRecentStatusChange != null
        ? {
            // Zillow emits this as a UNIX epoch ms (like taxHistory[].time).
            // Normalize to ISO so frontend types can declare `date: string`.
            date: (() => {
              const raw = p.lastStatusChangeDate;
              if (raw == null) return undefined;
              if (typeof raw === 'string') return raw;
              const ts = typeof raw === 'number' ? raw : Number(raw);
              if (!Number.isFinite(ts)) return undefined;
              return new Date(ts).toISOString();
            })(),
            isRecent: p.isRecentStatusChange ?? undefined,
          }
        : undefined,
    ownershipType: resoFacts.ownership ?? resoFacts.ownershipType ?? undefined,
    // mlsNumber is distinct from listingAgent.mlsId (the attribution mlsId).
    // Try resoFacts.listingId first (canonical MLS number on most pages),
    // fall back to resoFacts.mlsId for older payload shapes. safeString
    // handles empty / whitespace-only Zillow "absent" variants.
    mlsNumber: safeString(resoFacts.listingId) ?? safeString(resoFacts.mlsId),
    // ── Lifestyle / amenities (Tier A) ─────────────────────────────
    view: Array.isArray(resoFacts.view) ? resoFacts.view : undefined,
    hasView: resoFacts.hasView ?? undefined,
    waterfront:
      resoFacts.waterfrontFeatures != null || resoFacts.isWaterfront != null
        ? {
            features: Array.isArray(resoFacts.waterfrontFeatures)
              ? resoFacts.waterfrontFeatures
              : undefined,
            isWaterfront: resoFacts.isWaterfront ?? undefined,
          }
        : undefined,
    pool:
      resoFacts.poolFeatures != null || resoFacts.hasPrivatePool != null
        ? {
            features: Array.isArray(resoFacts.poolFeatures)
              ? resoFacts.poolFeatures
              : undefined,
            hasPrivatePool: resoFacts.hasPrivatePool ?? undefined,
          }
        : undefined,
    spa:
      resoFacts.spaFeatures != null || resoFacts.hasSpa != null
        ? {
            features: Array.isArray(resoFacts.spaFeatures)
              ? resoFacts.spaFeatures
              : undefined,
            hasSpa: resoFacts.hasSpa ?? undefined,
          }
        : undefined,
    fencing: Array.isArray(resoFacts.fencing) ? resoFacts.fencing : undefined,
    accessibilityFeatures: Array.isArray(resoFacts.accessibilityFeatures)
      ? resoFacts.accessibilityFeatures
      : undefined,
    // `undefined` when neither source field is set — callers MUST be able to
    // distinguish "no garage info from Zillow" from "explicitly zero spaces".
    garageSpaces:
      resoFacts.garageSpaces ??
      (resoFacts.hasAttachedGarage === true ? 1 : undefined),
    // ── HOA extended (Tier A) — extends existing monthlyHoaFee / hoaAnnualAmount
    hoaName: resoFacts.associationName ?? undefined,
    hoaFeeIncludes: Array.isArray(resoFacts.associationFeeIncludes)
      ? resoFacts.associationFeeIncludes
      : undefined,
    hoaAmenities: Array.isArray(resoFacts.associationAmenities)
      ? resoFacts.associationAmenities
      : undefined,
    hoaPhone: resoFacts.associationPhone ?? undefined,
    // ── Computed (Tier A) — owner-occupancy is the #1 wholesaler filter ─
    isOwnerOccupied,
    // ── Tax history extended (Tier A) — raw `taxHistory` preserved above ─
    taxHistoryNormalized,
    propertyTaxRate: p.propertyTaxRate ?? resoFacts.propertyTaxRate ?? undefined,
  };
}

// ──────────────────────────────── Actions ───────────────────────────────────

function detailUrlForZpid(zpid) {
  return `${ZILLOW_BASE}/homedetails/${encodeURIComponent(zpid)}_zpid/`;
}

function detailUrlForAddress(address) {
  // Zillow accepts /homes/<encoded-address>_rb/ which redirects to the
  // canonical homedetails page. We follow the redirect via scrape.do.
  const slug = String(address).trim().replace(/\s+/g, '-').replace(/,/g, '');
  return `${ZILLOW_BASE}/homes/${encodeURIComponent(slug)}_rb/`;
}

/**
 * Fetch + parse a single Zillow detail page.
 * @param {{zpid?: string, address?: string}} args
 * @returns {Promise<object>}  RapidAPI-shaped property record
 */
async function propertyDetails(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('propertyDetails requires zpid or address', {
      reason: 'bad_args',
    });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);

  let resp;
  try {
    resp = await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      // Detail pages render their __NEXT_DATA__ server-side, so no JS execution
      // is needed — keeps cost at 1x. If we start seeing block rates climb we
      // can flip render=true here.
      render: false,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'propertyDetails',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }

  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate Property in __NEXT_DATA__', {
      action: 'propertyDetails',
      reason: 'no_property_in_payload',
    });
  }
  return mapPropertyToRapidApiShape(record);
}

// ───────────────────────── Detail-derived slices ────────────────────────────
// Each of these runs one detail fetch and returns just the relevant subset.
// Callers can `propertyDetails(args)` once and slice locally if they need
// more than one — these wrappers exist so the agent tool layer stays clean.

async function photos(args = {}) {
  const d = await propertyDetails(args);
  return { zpid: d.zpid, photos: d.photos };
}

async function taxes(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    taxAnnualAmount: d.taxAnnualAmount,
    taxAssessedValue: d.taxAssessedValue,
    taxHistory: d.taxHistory || [],
  };
}

async function priceHistory(args = {}) {
  const d = await propertyDetails(args);
  return { zpid: d.zpid, priceHistory: d.priceHistory || [] };
}

async function zestimate(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    zestimate: d.zestimate,
    rentZestimate: d.rentZestimate,
  };
}

async function schools(args = {}) {
  const d = await propertyDetails(args);
  return { zpid: d.zpid, schools: d.schools || [] };
}

/**
 * Zillow's "Similar Homes" widget on each detail page. The data lives at
 * a couple of different paths in __NEXT_DATA__ depending on the page; we
 * pull whichever populated first.
 */
async function comps(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('comps requires zpid or address', { reason: 'bad_args' });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);

  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'comps',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  const compsList =
    record?.homeRecommendations?.homes ||
    record?.comparableHomes ||
    record?.similarSales ||
    [];
  return {
    zpid: record?.zpid != null ? String(record.zpid) : zpid,
    comps: compsList.map(mapListingToSummary).filter(Boolean),
  };
}

// ═════════════════════════ Tier B1 — detail-slice wrappers ═══════════════════
// Six focused views over the SAME propertyDetails fetch (1x scrape cost). Each
// returns a wholesaler-consumer-tuned slice of the rich shape Tier A exposed.
// Callers that want multiple slices for the same zpid should call propertyDetails
// once and select in-process — calling N slices triple-counts against scrape.do.
// (Same triple-count caveat that already applies to photos / taxes / priceHistory.)

/**
 * Full media payload — photos, virtual tours, floor plans, video. Single
 * detail fetch. Use this when building a dispo packet or buyer email — the
 * full set of media URLs in one call.
 */
async function propertyMedia(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    photos: d.photos || [],
    photoCount: Array.isArray(d.photos) ? d.photos.length : 0,
    // The richer photo metadata (responsivePhotos with subjectType/captions)
    // isn't on the Tier-A shape yet — surfaced as a follow-up in Tier B1.b
    // once we extend mapPropertyToRapidApiShape to preserve responsivePhotos.
  };
}

/**
 * Pure transform: take a Tier-A propertyDetails record, return the
 * propertyTaxHistory slice. Exported for direct unit testing without
 * stubbing the network fetch.
 *
 * Inputs: `taxHistoryNormalized` (year-sorted asc/desc agnostic — we re-sort),
 * `propertyTaxRate`, `apn`, `isTaxDelinquent`.
 *
 * Derivations:
 *   - signals.assessmentCagr5y / taxCagr5y — 5-year compound growth, null on
 *     too-few-data-points or zero base.
 *   - signals.missedYears[] — years in the data window where taxPaid is
 *     null/0. Three+ consecutive missed years is a strong pre-auction signal.
 */
function derivePropertyTaxHistory(d) {
  const series = Array.isArray(d.taxHistoryNormalized) ? d.taxHistoryNormalized : [];
  const sorted = [...series].sort((a, b) => (b.year || 0) - (a.year || 0));

  const cagr = (pick) => {
    if (sorted.length < 2) return null;
    const recent = sorted.slice(0, Math.min(5, sorted.length));
    const newest = pick(recent[0]);
    const oldest = pick(recent[recent.length - 1]);
    if (!newest || !oldest || oldest <= 0) return null;
    const years = (recent[0].year || 0) - (recent[recent.length - 1].year || 0);
    if (years <= 0) return null;
    return Math.pow(newest / oldest, 1 / years) - 1;
  };

  const ascending = [...sorted].reverse();
  const missedYears = [];
  if (ascending.length >= 2) {
    const first = ascending[0].year;
    const last = ascending[ascending.length - 1].year;
    const byYear = new Map(ascending.map((r) => [r.year, r]));
    for (let y = first; y <= last; y++) {
      const row = byYear.get(y);
      if (!row || row.taxPaid == null || row.taxPaid === 0) {
        missedYears.push(y);
      }
    }
  }

  return {
    zpid: d.zpid,
    propertyTaxRate: d.propertyTaxRate,
    latestAssessedValue: sorted[0]?.assessedValue,
    latestTaxAnnualAmount: sorted[0]?.taxPaid,
    parcelNumber: d.apn,
    history: sorted,
    signals: {
      yearsOfData: sorted.length,
      assessmentCagr5y: cagr((r) => r.assessedValue),
      taxCagr5y: cagr((r) => r.taxPaid),
      missedYears,
      isTaxDelinquent: d.isTaxDelinquent ?? undefined,
    },
  };
}

/**
 * Normalized tax history + computed signals. See `derivePropertyTaxHistory`
 * for the transformation logic.
 */
async function propertyTaxHistory(args = {}) {
  return derivePropertyTaxHistory(await propertyDetails(args));
}

/**
 * Construction & systems — rehab-cost-relevant subset. Wholesalers underwriting
 * a flip want foundation/roof/basement/appliances together; this returns just
 * those fields without the rest of the propertyDetails noise.
 */
async function propertyConstruction(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    yearBuilt: d.yearBuilt,
    yearRenovated: d.yearRenovated,
    foundation: d.foundation,
    roofType: d.roofType,
    constructionMaterials: d.constructionMaterials,
    exteriorFeatures: d.exteriorFeatures,
    structureType: d.structureType,
    architecturalStyle: d.architecturalStyle,
    stories: d.stories,
    basement: d.basement,
    basementArea: d.basementArea,
    finishedAreaAboveGrade: d.finishedAreaAboveGrade,
    finishedAreaBelowGrade: d.finishedAreaBelowGrade,
    flooring: d.flooring,
    fireplaceCount: d.fireplaceCount,
    appliances: d.appliances,
    heating: d.heating,
    cooling: d.cooling,
  };
}

/**
 * Utility infrastructure — water/sewer/electric/gas. Critical for end-buyer
 * financeability (well/septic disqualifies FHA), and a leading indicator of
 * rehab scope (oil heat conversions, septic replacement, etc.).
 */
async function propertyUtilities(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    waterSource: d.waterSource,
    sewer: d.sewer,
    electric: d.electric,
    electricUtilityCompany: d.electricUtilityCompany,
    gas: d.gas,
  };
}

/**
 * Listing terms — the wholesaler bullseye. specialListingConditions surfaces
 * REO / short-sale / probate / court-approval flags. listingTerms === ["Cash"]
 * is a strong distressed-seller signal. cumulativeDaysOnMarket is the TRUE
 * distress signal (relistings reset Zillow's daysOnZillow but not CDOM).
 */
async function propertyListingTerms(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    specialListingConditions: d.specialListingConditions,
    disclosures: d.disclosures,
    listingTerms: d.listingTerms,
    buyerCommission: d.buyerCommission,
    possession: d.possession,
    contingencyType: d.contingencyType,
    cumulativeDaysOnMarket: d.cumulativeDaysOnMarket,
    daysOnMarket: d.daysOnMarket,
    lastStatusChange: d.lastStatusChange,
    ownershipType: d.ownershipType,
    mlsNumber: d.mlsNumber,
    apn: d.apn,
    zoning: d.zoning,
  };
}

/**
 * Composite livability — bundles walk/climate/schools/market signals into one
 * payload. Zero new fetches: everything sourced from the detail-page shape.
 * Use this in property cards/modals where you want a single "is this neighborhood
 * a buy?" summary instead of four separate widget calls.
 */
async function livabilityProfile(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    region: {
      city: d.city,
      state: d.state,
      zipcode: d.zipcode,
      subdivisionName: d.subdivisionName,
      countyFips: d.countyFips,
      schoolDistrict: d.schoolDistrict,
    },
    schools: d.schools || [],
    climate: d.climate,             // Tier A surfaces this on propertyDetails
    walk: {
      walkScore: d.walkScore,        // Tier A passthrough
      transitScore: d.transitScore,
      bikeScore: d.bikeScore,
    },
    foreclosureStage: d.foreclosureStage,
    isTaxDelinquent: d.isTaxDelinquent,
  };
}

// ───────────────────────── Search (location-string) ─────────────────────────

const STATUS_TO_ZILLOW = {
  for_sale: 'ForSale',
  forSale: 'ForSale',
  for_rent: 'ForRent',
  forRent: 'ForRent',
  recently_sold: 'RecentlySold',
  recentlySold: 'RecentlySold',
  sold: 'RecentlySold',
};

/**
 * Build the canonical /homes/<location>_rb/ URL Zillow uses for any
 * location-string search. The slug is forgiving — Zillow's frontend
 * normalizes "Austin, TX 78701" → "austin-tx-78701".
 *
 * Slug normalization pipeline (confirmed live 2026-05-13):
 *
 * 1. Compound-case split (camelCase → hyphenated):
 *    Zillow's slugs include a hyphen at the internal case-break for words
 *    like "DeKalb" → "de-kalb" and "DuPage" → "du-page". The `[a-z][A-Z]`
 *    regex catches these. Acronyms ("USA") are unaffected.
 *
 *    EXCEPTION — Mc/Mac prefixes: "McKinney" → "mckinney" (NOT "mc-kinney"),
 *    "MacDonough" → "macdonough". These are single-word proper nouns in
 *    Zillow's index. We suppress the split by temporarily replacing
 *    "Mc[A-Z]" and "Mac[A-Z]" before running the general camelCase regex,
 *    then restoring. Confirmed live: mc-kinney-tx returns 0 results;
 *    mckinney-tx returns 2,021.
 *
 * 2. Accent / diacritic normalization:
 *    "San José" → "san-jose". Unicode NFKD decomposition + strip combining
 *    marks. Zillow accepts the URL-encoded accent but the normalized form
 *    is canonical and more robust across proxy layers.
 *
 * 3. Period stripping:
 *    "St. Louis" → "st-louis". The period is removed before spacing is
 *    collapsed. Zillow tolerates the dot in practice but the clean form
 *    is more stable.
 *
 * 4. Apostrophe stripping:
 *    "O'Fallon" → "ofallon", "St. Mary's" → "st-marys". Zillow accepts
 *    the apostrophe in the slug but it degrades gracefully either way.
 *    Stripping produces the cleaner canonical form.
 *
 * 5. ZIP+4 stripping:
 *    "78737-1234" → "78737". The four-digit extension is not a valid
 *    Zillow search target and produces no listResults. Confirmed live.
 *
 * 6. Double-hyphen collapse + leading/trailing trim:
 *    Any combination of the above transformations that would produce "--"
 *    or a leading/trailing "-" is collapsed/trimmed.
 *
 * Failure-mode patterns discovered during live probe (2026-05-13):
 *   - Mc/Mac prefix: McKinney → mc-kinney (0 results) vs mckinney (2,021)
 *   - ZIP+4: 78737-1234 → 0 results; strip to 78737 → 192 results
 *   - Accents: san-jos%C3%A9-ca works but san-jose-ca is cleaner/canonical
 *   - Full address: "123 Main St, Austin TX" → slug has no listResults (expected)
 *   - "MacDonough, GA" (user typo): slug correct for the typo but no Zillow page;
 *     real city is "McDonough, GA" → cannot fix typos
 *   - "TX" / "California" (state-only): returns results (500k+), handled correctly
 *
 * @param {string} location  Free-form: "City, ST", ZIP, "State", etc.
 * @returns {string}  Full https://www.zillow.com/homes/<slug>_rb/ URL
 */
function searchUrlForLocation(location) {
  // ── Step 1: Unicode NFKD normalization → strip combining marks (accents) ──
  // "San José" → "San Jose"
  let s = String(location)
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, ''); // strip combining diacritical marks

  // ── Step 2: ZIP+4 stripping — "78737-1234" → "78737" ──
  // A hyphen flanked by exactly 5 digits on the left and 4 on the right is a ZIP+4.
  s = s.replace(/\b(\d{5})-\d{4}\b/g, '$1');

  // ── Step 3: Period stripping (St., Dr., etc.) ──
  s = s.replace(/\./g, '');

  // ── Step 4: Apostrophe stripping ──
  // Covers ASCII apostrophe ('), backtick (`), and Unicode quote variants
  // that iOS auto-correct, smart-quote-enabled keyboards, and transliterated
  // place names emit:
  //   U+2018 LEFT SINGLE QUOTATION MARK (e.g. ‘Twas)
  //   U+2019 RIGHT SINGLE QUOTATION MARK (e.g. O’Fallon — iOS replaces ASCII)
  //   U+02BB HAWAIIAN OKINA (e.g. Kaʻu, Hawaiʻi — Hawaiian place names)
  //   U+02BC MODIFIER LETTER APOSTROPHE (related but distinct codepoint)
  s = s.replace(/['`‘’ʻʼ]/g, '');

  // ── Step 5: CamelCase → hyphenated, EXCEPT Mc/Mac prefixes ──
  // Temporarily protect Mc[A-Z] and Mac[A-Z] by replacing them with a
  // placeholder that has no lowercase→uppercase transition, then restore.
  //
  // We use a two-pass approach:
  //   a) Replace Mc/Mac followed by uppercase with a placeholder sequence
  //      that survives the camelCase regex untouched.
  //   b) Run the general [a-z][A-Z] → $1-$2 replacement.
  //   c) Restore the placeholders (they're already lowercase-safe).
  //
  // Placeholder: "__MC__X" where X is the capital letter. After lowercasing
  // in step 6 the whole thing becomes "mcx" as intended.
  s = s
    .replace(/\bMac(?=[A-Z])/g, '\x00MAC\x00')
    .replace(/\bMc(?=[A-Z])/g, '\x00MC\x00')
    .replace(/([a-z])([A-Z])/g, '$1-$2')       // general camelCase split
    .replace(/\x00MAC\x00/g, 'Mac')
    .replace(/\x00MC\x00/g, 'Mc');

  // ── Step 6: Lowercase + strip commas + collapse spaces → hyphens ──
  s = s
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '-');

  // ── Step 7: Collapse multiple hyphens + trim leading/trailing ──
  s = s.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');

  return `${ZILLOW_BASE}/homes/${encodeURIComponent(s)}_rb/`;
}

/**
 * Walk __NEXT_DATA__ and pull the listResults array. Zillow nests it under
 * props.pageProps.searchPageState.cat1.searchResults.listResults on the
 * /homes/<location>_rb/ render. Defensive deep-find as a fallback.
 */
function findListResults(nextData) {
  const direct =
    nextData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults;
  if (Array.isArray(direct)) return direct;
  const alt = nextData?.props?.pageProps?.searchPageState?.cat1?.searchList?.listResults;
  if (Array.isArray(alt)) return alt;
  return deepFindArray(nextData, 'listResults');
}

function findTotalResultCount(nextData) {
  const a = nextData?.props?.pageProps?.searchPageState?.cat1?.searchList?.totalResultCount;
  if (typeof a === 'number') return a;
  const b = nextData?.props?.pageProps?.searchPageState?.searchResults?.totalResultCount;
  if (typeof b === 'number') return b;
  return undefined;
}

function deepFindArray(node, key, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (Array.isArray(node)) {
    for (const v of node) {
      const r = deepFindArray(v, key, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (Array.isArray(node[key])) return node[key];
  for (const v of Object.values(node)) {
    const r = deepFindArray(v, key, depth + 1);
    if (r) return r;
  }
  return null;
}

/**
 * Reshape a search-page listResult into the field names downstream consumers
 * already expect (matches what RapidAPI's /search/byaddress and friends
 * return for each item).
 *
 * `homeRecommendations.homes` items (the comps shape) carry top-level
 * latitude/longitude rather than a latLong object, so we accept both. The
 * map view in the frontend depends on these being populated.
 */
function mapListingToSummary(l) {
  if (!l || typeof l !== 'object') return null;
  // listResults items sometimes nest payload under hdpData.homeInfo
  const hi = l.hdpData?.homeInfo || {};
  return {
    zpid: (l.zpid ?? hi.zpid) != null ? String(l.zpid ?? hi.zpid) : undefined,
    address: l.address ?? hi.streetAddress ?? l.addressStreet,
    addressStreet: l.addressStreet ?? hi.streetAddress,
    addressCity: l.addressCity ?? hi.city,
    addressState: l.addressState ?? hi.state,
    addressZipcode: l.addressZipcode ?? hi.zipcode,
    latitude:
      l.latLong?.latitude ??
      hi.latitude ??
      l.latitude ??
      (typeof l.lat === 'number' ? l.lat : undefined),
    longitude:
      l.latLong?.longitude ??
      hi.longitude ??
      l.longitude ??
      (typeof l.lng === 'number' ? l.lng : undefined),
    price: l.unformattedPrice ?? l.price ?? hi.price,
    priceLabel: l.price,
    zestimate: l.zestimate ?? hi.zestimate,
    rentZestimate: l.rentZestimate ?? hi.rentZestimate,
    beds: l.beds ?? hi.bedrooms,
    baths: l.baths ?? hi.bathrooms,
    area: l.area ?? hi.livingArea,
    homeStatus: l.statusType ?? hi.homeStatus,
    homeType: l.hdpData?.homeInfo?.homeType ?? l.homeType,
    daysOnZillow: l.daysOnZillow ?? hi.daysOnZillow,
    detailUrl: l.detailUrl
      ? l.detailUrl.startsWith('http')
        ? l.detailUrl
        : `${ZILLOW_BASE}${l.detailUrl}`
      : undefined,
    imgSrc: l.imgSrc,
    isForeclosure: hi.isPreforeclosureAuction ?? hi.isForeclosure ?? l.isForeclosure,
  };
}

/**
 * Generic location-string search. The location can be a ZIP, a "City, ST",
 * or a full address — Zillow's own URL canonicalization handles all three.
 *
 * @param {{location: string, status?: string, page?: number|string}} args
 */
async function search(args = {}) {
  const { location, status, page } = args;
  if (!location) {
    throw new ZillowScrapeError('search requires location', { reason: 'bad_args' });
  }
  let url = searchUrlForLocation(location);

  // Status appends a sub-path that Zillow recognises (e.g. /sold/, /rentals/).
  const z = STATUS_TO_ZILLOW[status] || status;
  if (z === 'RecentlySold') url = url.replace(/_rb\/$/, '_rb/sold/');
  else if (z === 'ForRent') url = url.replace(/_rb\/$/, '_rb/rentals/');
  if (page && Number(page) > 1) {
    url = url.replace(/\/$/, `/${Number(page)}_p/`);
  }

  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'search',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }

  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: 'search',
      reason: 'no_list_results',
    });
  }
  const totalResultCount = findTotalResultCount(nextData);
  const results = listResults.map(mapListingToSummary).filter(Boolean);
  // Pagination shape that the FRONTEND (src/lib/zillow-api.ts performSearch)
  // expects: `total_pages` + `total_results` mirror the RapidAPI/standalone-
  // proxy shape so the same iteration loop works regardless of which backend
  // answered. Without these keys, performSearch defaults to 1 page and the
  // user sees only the first ~40 of (potentially) hundreds of listings.
  //
  // Page-size derivation: prefer the actual results.length on this page
  // (Zillow may return 40-41 depending on listing density) over a hardcoded
  // constant. Falls back to 40 (Zillow's canonical page size) when the
  // current page is empty.
  const total = totalResultCount ?? results.length;
  const pageSize = results.length > 0 ? results.length : 40;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    location,
    status: z || 'ForSale',
    page: Number(page) || 1,
    totalResultCount: total,
    // Frontend-compat pagination keys — additive, original keys preserved.
    total_results: total,
    total_pages: totalPages,
    results,
    // Frontend processPropertyData() tries multiple keys (`searchResults`,
    // `props`, `results`, `listings`, ...). `results` is already in the list,
    // so no alias needed there.
  };
}

/** Alias: search by address. Same wire call — Zillow disambiguates. */
async function searchByAddress(args = {}) {
  const { address, ...rest } = args;
  return search({ location: address, ...rest });
}

/** Filter preset: just for-sale (the default). */
async function forSale(args = {}) {
  return search({ ...args, status: 'ForSale' });
}

/** Filter preset: rentals. */
async function forRent(args = {}) {
  return search({ ...args, status: 'ForRent' });
}

/** Filter preset: recently sold (Zillow's "Sold" tab). */
async function recentlySold(args = {}) {
  return search({ ...args, status: 'RecentlySold' });
}

/**
 * Filter preset: foreclosures. Zillow exposes these via a query-string
 * `searchQueryState` filter on the same URL. We hit the public foreclosures
 * sub-path which already pre-filters server-side.
 */
async function foreclosures(args = {}) {
  const { location, page } = args;
  if (!location) {
    throw new ZillowScrapeError('foreclosures requires location', { reason: 'bad_args' });
  }
  let url = searchUrlForLocation(location).replace(/_rb\/$/, '_rb/foreclosures/');
  if (page && Number(page) > 1) {
    url = url.replace(/\/$/, `/${Number(page)}_p/`);
  }
  return runSearchUrl(url, { location, status: 'Foreclosure', page });
}

/** Filter preset: for-sale by owner (FSBO). */
async function fsbo(args = {}) {
  const { location, page } = args;
  if (!location) {
    throw new ZillowScrapeError('fsbo requires location', { reason: 'bad_args' });
  }
  let url = searchUrlForLocation(location).replace(/_rb\/$/, '_rb/fsbo/');
  if (page && Number(page) > 1) {
    url = url.replace(/\/$/, `/${Number(page)}_p/`);
  }
  return runSearchUrl(url, { location, status: 'FSBO', page });
}

async function runSearchUrl(url, ctx) {
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'search',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: 'search',
      reason: 'no_list_results',
    });
  }
  const total = findTotalResultCount(nextData);
  const results = listResults.map(mapListingToSummary).filter(Boolean);
  return {
    location: ctx.location,
    status: ctx.status,
    page: Number(ctx.page) || 1,
    totalResultCount: total ?? results.length,
    results,
  };
}

// ───────────────────────── Coordinate / bounds search ──────────────────────

/**
 * Build a searchQueryState JSON blob that Zillow accepts as a `searchQueryState`
 * URL-parameter on /homes/. The shape is what Zillow's own frontend sends —
 * mapBounds with N/S/E/W floats, plus a regionSelection list (which we leave
 * empty for free-form coordinate searches).
 *
 * The pagination + filter sub-keys mirror what Zillow itself emits when you
 * pan the map manually — pretty stable as of 2026-04 but liable to drift.
 *
 * @param {{north: number, south: number, east: number, west: number}} bounds
 * @param {object} [filters]
 *   - status: 'forSale' | 'forRent' | 'recentlySold' | 'foreclosures' | 'fsbo'
 *   - bedsMin / bedsMax / bathsMin / bathsMax / priceMin / priceMax
 * @returns {string}  URL-encoded JSON ready for ?searchQueryState=
 */
function buildSearchQueryState(bounds, filters = {}) {
  const filterState = {};
  if (filters.bedsMin != null) filterState.beds = { min: Number(filters.bedsMin) };
  if (filters.bedsMax != null) {
    filterState.beds = { ...(filterState.beds || {}), max: Number(filters.bedsMax) };
  }
  if (filters.bathsMin != null) filterState.baths = { min: Number(filters.bathsMin) };
  if (filters.priceMin != null || filters.priceMax != null) {
    filterState.price = {};
    if (filters.priceMin != null) filterState.price.min = Number(filters.priceMin);
    if (filters.priceMax != null) filterState.price.max = Number(filters.priceMax);
  }
  const status = filters.status;
  if (status === 'recentlySold' || status === 'RecentlySold' || status === 'sold') {
    filterState.isRecentlySold = { value: true };
    filterState.isForSaleByAgent = { value: false };
    filterState.isForSaleByOwner = { value: false };
    filterState.isNewConstruction = { value: false };
    filterState.isComingSoon = { value: false };
    filterState.isAuction = { value: false };
    filterState.isForSaleForeclosure = { value: false };
  } else if (status === 'forRent' || status === 'ForRent') {
    filterState.isForRent = { value: true };
    filterState.isForSaleByAgent = { value: false };
    filterState.isForSaleByOwner = { value: false };
  } else if (status === 'fsbo' || status === 'FSBO') {
    filterState.isForSaleByOwner = { value: true };
    filterState.isForSaleByAgent = { value: false };
  } else if (status === 'foreclosures' || status === 'Foreclosure') {
    filterState.isForSaleForeclosure = { value: true };
  }

  return JSON.stringify({
    pagination: {},
    isMapVisible: true,
    mapBounds: {
      north: Number(bounds.north),
      south: Number(bounds.south),
      east: Number(bounds.east),
      west: Number(bounds.west),
    },
    filterState,
    isListVisible: true,
  });
}

/**
 * One degree of latitude ≈ 69.0 statute miles (constant). Longitude varies
 * with latitude (cos approximation). We use these to expand a centre point
 * by a radius-in-miles into N/S/E/W lat/lng bounds.
 */
function boundsFromCenterRadius(lat, lng, radiusMi) {
  const r = Math.max(0.01, Number(radiusMi));
  const latDelta = r / 69.0;
  const cos = Math.max(0.0001, Math.cos((Number(lat) * Math.PI) / 180));
  const lngDelta = r / (69.0 * cos);
  return {
    north: Number(lat) + latDelta,
    south: Number(lat) - latDelta,
    east: Number(lng) + lngDelta,
    west: Number(lng) - lngDelta,
  };
}

async function runSearchQueryState(searchQueryState, ctx) {
  const url = `${ZILLOW_BASE}/homes/?searchQueryState=${encodeURIComponent(searchQueryState)}`;
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: ctx.action || 'searchByCoordinates',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: ctx.action || 'searchByCoordinates',
      reason: 'no_list_results',
    });
  }
  const total = findTotalResultCount(nextData);
  const results = listResults.map(mapListingToSummary).filter(Boolean);
  return {
    ...ctx.echo,
    totalResultCount: total ?? results.length,
    results,
  };
}

/**
 * Search by centre + radius. radius_mi defaults to 1 if missing.
 *
 * @param {{lat: number, lng: number, radius_mi?: number, status?: string,
 *           bedsMin?: number, bedsMax?: number, bathsMin?: number,
 *           priceMin?: number, priceMax?: number}} args
 */
async function searchByCoordinates(args = {}) {
  const { lat, lng, radius_mi: radiusMi = 1 } = args;
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    throw new ZillowScrapeError('searchByCoordinates requires numeric lat + lng', {
      reason: 'bad_args',
    });
  }
  const bounds = boundsFromCenterRadius(Number(lat), Number(lng), radiusMi);
  const sqs = buildSearchQueryState(bounds, args);
  return runSearchQueryState(sqs, {
    action: 'searchByCoordinates',
    echo: { lat: Number(lat), lng: Number(lng), radiusMi: Number(radiusMi), bounds },
  });
}

/**
 * Search by an explicit lat/lng rectangle. Useful when the frontend already
 * has the viewport bounds (e.g. user pans the map) and we don't want to
 * round-trip through a centre+radius approximation.
 *
 * @param {{sw_lat: number, sw_lng: number, ne_lat: number, ne_lng: number,
 *           status?: string, bedsMin?: number, ...}} args
 */
async function searchByBounds(args = {}) {
  const { sw_lat: swLat, sw_lng: swLng, ne_lat: neLat, ne_lng: neLng } = args;
  const nums = [swLat, swLng, neLat, neLng];
  if (nums.some((n) => n == null || !Number.isFinite(Number(n)))) {
    throw new ZillowScrapeError(
      'searchByBounds requires numeric sw_lat, sw_lng, ne_lat, ne_lng',
      { reason: 'bad_args' }
    );
  }
  const bounds = {
    south: Number(swLat),
    west: Number(swLng),
    north: Number(neLat),
    east: Number(neLng),
  };
  // Quick sanity: NE corner must actually be NE of SW (Zillow returns 0
  // results for inverted rectangles — fail fast so the caller sees why).
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
    throw new ZillowScrapeError('searchByBounds: NE corner must be north-east of SW', {
      reason: 'bad_args',
    });
  }
  const sqs = buildSearchQueryState(bounds, args);
  return runSearchQueryState(sqs, {
    action: 'searchByBounds',
    echo: { bounds },
  });
}

/**
 * Search by pasting a full Zillow URL — typically a saved-search URL the
 * user copy-pasted from their browser. Host must be www.zillow.com; we don't
 * follow open redirects.
 *
 * SSRF guard: we parse the URL with the WHATWG URL parser and only accept
 * https + the canonical Zillow hostname. Any other host throws bad_args so
 * a hostile caller can't pivot scrape.do at an internal address.
 *
 * @param {string|{url: string}} arg
 */
async function searchByUrl(arg) {
  const raw = typeof arg === 'string' ? arg : arg && arg.url;
  if (!raw || typeof raw !== 'string') {
    throw new ZillowScrapeError('searchByUrl requires a url string', { reason: 'bad_args' });
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ZillowScrapeError(`searchByUrl: invalid URL: ${raw}`, { reason: 'bad_args' });
  }
  if (parsed.protocol !== 'https:') {
    throw new ZillowScrapeError('searchByUrl: only https URLs allowed', { reason: 'bad_args' });
  }
  if (parsed.hostname !== 'www.zillow.com') {
    throw new ZillowScrapeError(
      `searchByUrl: hostname must be www.zillow.com (got ${parsed.hostname})`,
      { reason: 'bad_args' }
    );
  }
  let resp;
  try {
    resp = await scrape(parsed.toString(), {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      render: false,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'searchByUrl',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: 'searchByUrl',
      reason: 'no_list_results',
    });
  }
  const total = findTotalResultCount(nextData);
  const results = listResults.map(mapListingToSummary).filter(Boolean);
  return {
    url: parsed.toString(),
    totalResultCount: total ?? results.length,
    results,
  };
}

// ───────────────────────── Zestimate history ─────────────────────────

/**
 * Walk __NEXT_DATA__ for the `homeValueChartData` array that Zillow embeds on
 * detail pages. It's a series of `{ points: [{ x: timestamp_ms, y: usd }] }`
 * blocks keyed by `name` (e.g. "This home", "Local"). We return the property's
 * own series, normalised to `{ date: ISO-string, value: number }`.
 */
function findZestimateHistory(record) {
  const candidates = [
    record?.homeValueChartData,
    record?.zestimateHistory,
    record?.historicalZestimates,
  ].filter(Boolean);
  for (const c of candidates) {
    if (!Array.isArray(c)) continue;
    // If c[0].points exists, that's the canonical chart shape
    const thisHome = c.find((s) => s && (s.name === 'This home' || s.name === 'This Home')) || c[0];
    if (thisHome && Array.isArray(thisHome.points)) {
      return thisHome.points
        .filter((p) => p && p.x != null && p.y != null)
        .map((p) => ({
          date: new Date(Number(p.x)).toISOString(),
          value: Number(p.y),
        }));
    }
    // Fallback: a flat array of {date, value}
    if (c[0] && (c[0].date || c[0].timestamp)) {
      return c
        .filter((p) => p && (p.value != null || p.zestimate != null))
        .map((p) => ({
          date: p.date || new Date(Number(p.timestamp)).toISOString(),
          value: Number(p.value ?? p.zestimate),
        }));
    }
  }
  return null;
}

/**
 * Time-series of zestimate snapshots from the detail page's homeValueChartData.
 * Throws ZillowScrapeError('no_history_in_payload') if the property doesn't
 * have a chart embedded — the caller can fall back to RapidAPI.
 *
 * @param {{zpid?: string, address?: string}} args
 */
async function zestimateHistory(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('zestimateHistory requires zpid or address', {
      reason: 'bad_args',
    });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'zestimateHistory',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate Property in __NEXT_DATA__', {
      action: 'zestimateHistory',
      reason: 'no_property_in_payload',
    });
  }
  const series = findZestimateHistory(record);
  if (!series || series.length === 0) {
    throw new ZillowScrapeError('No homeValueChartData on detail page', {
      action: 'zestimateHistory',
      reason: 'no_history_in_payload',
    });
  }
  return {
    zpid: record.zpid != null ? String(record.zpid) : zpid,
    history: series,
  };
}

// ───────────────────────── Mortgage rates / calculator ──────────────────

function mortgageRatesUrlForZip(zip) {
  return `${ZILLOW_BASE}/mortgage-rates/${encodeURIComponent(String(zip))}`;
}

function mortgageRatesUrlForState(state) {
  return `${ZILLOW_BASE}/mortgage-rates/${encodeURIComponent(String(state).toLowerCase())}`;
}

/**
 * Defensive walk for mortgage-rate rows in __NEXT_DATA__. Zillow has shipped
 * three slightly different shapes here over the past year; we accept any of
 * them and normalise to a flat row.
 */
function findMortgageRates(nextData) {
  const candidates = [
    nextData?.props?.pageProps?.componentProps?.rateTable?.lenderQuotes,
    nextData?.props?.pageProps?.componentProps?.rates,
    nextData?.props?.pageProps?.componentProps?.lenders,
    nextData?.props?.pageProps?.rates,
    nextData?.props?.pageProps?.lenderQuotes,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return deepFindArray(nextData, 'lenderQuotes') || deepFindArray(nextData, 'rates');
}

function normalizeMortgageRate(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    lender: r.lenderName || r.lender || r.name || undefined,
    nmlsId: r.nmlsId || r.nmls || undefined,
    apr: r.apr != null ? Number(r.apr) : undefined,
    rate: r.rate != null ? Number(r.rate) : r.interestRate != null ? Number(r.interestRate) : undefined,
    points: r.points != null ? Number(r.points) : undefined,
    monthlyPayment:
      r.monthlyPayment != null ? Number(r.monthlyPayment) : undefined,
    feesAmount: r.fees != null ? Number(r.fees) : r.totalFees != null ? Number(r.totalFees) : undefined,
    loanType: r.loanType || r.programName || undefined,
    loanTerm: r.loanTerm || r.term || undefined,
  };
}

/**
 * Mortgage rates for a ZIP (preferred) or a state code. Returns an array of
 * lender quotes parsed from /mortgage-rates/<location>.
 *
 * @param {{zip?: string|number, state?: string, loanType?: string, term?: number}} args
 */
async function mortgageRates(args = {}) {
  const { zip, state } = args;
  if (!zip && !state) {
    throw new ZillowScrapeError('mortgageRates requires zip or state', {
      reason: 'bad_args',
    });
  }
  const url = zip ? mortgageRatesUrlForZip(zip) : mortgageRatesUrlForState(state);
  let resp;
  try {
    // /mortgage-rates/* is heavily protected and the default residential
    // pool returns 502 on most attempts (observed 2026-05). The premium
    // pool (super=true) gets through. Pricing is 2x the standard call —
    // acceptable for a marketing-page surface that we cache aggressively
    // upstream.
    resp = await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      render: false,
      super: true,
      timeoutMs: 60_000,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'mortgageRates',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const raw = findMortgageRates(nextData);
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ZillowScrapeError('No mortgage rate rows in __NEXT_DATA__', {
      action: 'mortgageRates',
      reason: 'no_rates_in_payload',
    });
  }
  const rates = raw.map(normalizeMortgageRate).filter(Boolean);
  return {
    zip: zip != null ? String(zip) : undefined,
    state: state || undefined,
    loanType: args.loanType,
    term: args.term,
    rates,
  };
}

/**
 * Pure-math mortgage calculator — no scrape.do round-trip. PMT formula on
 * (price - down) over `term` years at `rate`% nominal annual. Returns the
 * monthly payment plus rolled-up totals; if `args.schedule` is true we also
 * return a month-by-month amortization array (can be heavy — opt-in only).
 *
 * Caller-supplied numbers are coerced to Number. We don't enforce sanity
 * limits (someone might ask for a 100-year loan at 0%) but we throw if any
 * input would produce NaN / Infinity.
 *
 * @param {{price: number, down?: number, term: number, rate: number,
 *           schedule?: boolean}} args
 */
function mortgageCalculator(args = {}) {
  const price = Number(args.price);
  const down = Number(args.down || 0);
  const termYears = Number(args.term);
  const annualRatePct = Number(args.rate);
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(down) ||
    !Number.isFinite(termYears) ||
    !Number.isFinite(annualRatePct) ||
    price <= 0 ||
    termYears <= 0 ||
    annualRatePct < 0
  ) {
    throw new ZillowScrapeError(
      'mortgageCalculator requires positive numeric price, term, and rate (down optional)',
      { reason: 'bad_args' }
    );
  }
  const principal = Math.max(0, price - down);
  const n = Math.round(termYears * 12);
  const monthlyRate = annualRatePct / 100 / 12;

  let monthlyPayment;
  if (monthlyRate === 0) {
    monthlyPayment = principal / n;
  } else {
    const factor = Math.pow(1 + monthlyRate, n);
    monthlyPayment = (principal * monthlyRate * factor) / (factor - 1);
  }
  const totalCost = monthlyPayment * n;
  const totalInterest = totalCost - principal;

  let schedule;
  if (args.schedule) {
    schedule = [];
    let remaining = principal;
    for (let i = 1; i <= n; i += 1) {
      const interest = remaining * monthlyRate;
      const princ = monthlyPayment - interest;
      remaining = Math.max(0, remaining - princ);
      schedule.push({
        month: i,
        payment: round2(monthlyPayment),
        principal: round2(princ),
        interest: round2(interest),
        balance: round2(remaining),
      });
    }
  }

  return {
    principal: round2(principal),
    monthlyPayment: round2(monthlyPayment),
    totalInterest: round2(totalInterest),
    totalCost: round2(totalCost),
    months: n,
    ...(schedule ? { schedule } : {}),
  };
}

function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

// ───────────────────────── Agent profile ─────────────────────────

function agentProfileUrl(slug) {
  return `${ZILLOW_BASE}/profile/${encodeURIComponent(String(slug))}/`;
}

/**
 * Walk __NEXT_DATA__ for an agentProfile-shaped node. Zillow has used both
 * `agentProfile` (PT-built) and `agent` (Apollo) over the past year; we
 * accept both and merge the meaningful keys.
 */
function findAgentProfile(nextData) {
  const pp = nextData?.props?.pageProps;
  const direct = pp?.agentProfile || pp?.agent;
  if (direct && typeof direct === 'object') return direct;

  // 2026-05 shape: /profile/<slug>/ pages embed the agent under `displayData`
  // — the page is rendered from a single React tree, not Apollo. We accept
  // it here and let the normaliser collapse the field-name drift.
  if (pp?.displayData && typeof pp.displayData === 'object') {
    return pp.displayData;
  }

  // Sometimes the page nests it inside an Apollo cache JSON string
  const cacheStr = pp?.apolloState;
  if (cacheStr && typeof cacheStr === 'object') {
    for (const key of Object.keys(cacheStr)) {
      if (/^Agent[:_]/.test(key)) return cacheStr[key];
    }
  }
  return deepFindAgentNode(nextData);
}

function deepFindAgentNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (
    typeof node === 'object' &&
    !Array.isArray(node) &&
    // Either {first/full/displayName + brokerage/broker/business} OR a
    // node with profileDisplayName + recentSales/recentListings (the
    // 2026-05 /profile/ shape).
    ((node.firstName || node.fullName || node.displayName) &&
      (node.brokerage || node.brokerName || node.businessName ||
        node.recentListings || node.recentSales || node.profileDisplayName))
  ) {
    return node;
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const v of values) {
    const r = deepFindAgentNode(v, depth + 1);
    if (r) return r;
  }
  return null;
}

function normalizeAgentProfile(a) {
  if (!a || typeof a !== 'object') return null;
  const recent = Array.isArray(a.recentListings)
    ? a.recentListings
    : Array.isArray(a.activeListings)
      ? a.activeListings
      : Array.isArray(a.listings)
        ? a.listings
        : [];
  return {
    name: a.fullName || a.displayName || [a.firstName, a.lastName].filter(Boolean).join(' ') || undefined,
    firstName: a.firstName,
    lastName: a.lastName,
    brokerage: a.brokerage || a.brokerName || a.businessName || undefined,
    phone: a.phone || a.phoneNumber || a.preferredPhone || undefined,
    email: a.email || undefined,
    photoUrl: a.photoUrl || a.profilePhoto || a.profileImage || undefined,
    reviewCount: a.reviewCount != null ? Number(a.reviewCount) : undefined,
    rating: a.rating != null ? Number(a.rating) : undefined,
    reviews: Array.isArray(a.reviews) ? a.reviews : undefined,
    recentListings: recent.map(mapListingToSummary).filter(Boolean),
    languages: Array.isArray(a.languages) ? a.languages : undefined,
    licenseNumber: a.licenseNumber || a.license || undefined,
    licenseState: a.licenseState || undefined,
    profileUrl: a.profileUrl
      ? a.profileUrl.startsWith('http')
        ? a.profileUrl
        : `${ZILLOW_BASE}${a.profileUrl}`
      : undefined,
  };
}

/**
 * Agent profile page parser — name, brokerage, phone, reviews, recent listings.
 *
 * @param {{slug: string}} args  Zillow profile slug (e.g. "jane-doe-1234")
 */
async function agentProfile(args = {}) {
  const { slug } = args;
  if (!slug) {
    throw new ZillowScrapeError('agentProfile requires slug', { reason: 'bad_args' });
  }
  const url = agentProfileUrl(slug);
  let resp;
  try {
    // Agent profile pages 502 on the default pool, similar to mortgage-rates.
    // Use super=true to get a premium proxy through.
    resp = await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      render: false,
      super: true,
      timeoutMs: 60_000,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'agentProfile',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findAgentProfile(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate agentProfile in __NEXT_DATA__', {
      action: 'agentProfile',
      reason: 'no_agent_in_payload',
    });
  }
  return normalizeAgentProfile(record);
}

// ───────────────────────── Market stats / region pages ──────────────────

function marketStatsUrl(region, regionType) {
  // /<region-slug>/home-values/ is the canonical canonical regional rollup.
  // regionType is hint-only: it determines the URL prefix when known
  // ("zip", "city", "state", "county"), defaults to flat /<region>/home-values/.
  const slug = String(region)
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '-');
  if (regionType === 'zip') {
    return `${ZILLOW_BASE}/home-values/${encodeURIComponent(slug)}/`;
  }
  return `${ZILLOW_BASE}/${encodeURIComponent(slug)}/home-values/`;
}

function findMarketStats(nextData) {
  const cp = nextData?.props?.pageProps?.componentProps;
  const pp = nextData?.props?.pageProps;

  // 2026-05 shape: home-values pages expose data in two siblings —
  // `zhviRegion` (the region itself) and `odpMarketAnalytics` (the stats).
  // We merge them into one record so the downstream normaliser doesn't have
  // to branch.
  if (pp?.odpMarketAnalytics || pp?.zhviRegion) {
    const merged = {
      ...(pp.zhviRegion || {}),
      ...(pp.odpMarketAnalytics || {}),
      // Hoist deep-nested values so normalizeMarketStats sees them
      typicalHomeValue:
        pp.odpMarketAnalytics?.zhviLatest?.dataValue ??
        pp.odpMarketAnalytics?.zhviYoY,
      yoyChangePct: pp.odpMarketAnalytics?.zhviLatest?.zhviYoY,
      medianListPrice: pp.odpMarketAnalytics?.mrktListingLatest?.medianListPrice,
      medianSalePrice: pp.odpMarketAnalytics?.mrktSaleLatest?.medianSalePrice,
      inventoryCount: pp.odpMarketAnalytics?.mrktListingLatest?.forSaleInventory,
      regionName: pp.zhviRegion?.name || pp.requestedRegion?.name,
      regionType: pp.zhviRegion?.regionTypeName,
    };
    return merged;
  }

  const candidates = [
    cp?.regionInfo,
    cp?.region,
    cp?.marketStats,
    cp?.homeValueData,
    pp?.region,
    pp?.marketStats,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'object') return c;
  }
  return deepFindRegionNode(nextData);
}

function deepFindRegionNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (
    !Array.isArray(node) &&
    (node.typicalHomeValue != null ||
      node.zhviValue != null ||
      node.medianHomeValue != null ||
      node.homeValueIndex != null)
  ) {
    return node;
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const v of values) {
    const r = deepFindRegionNode(v, depth + 1);
    if (r) return r;
  }
  return null;
}

function normalizeMarketStats(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    regionName: r.regionName || r.name || r.displayName || undefined,
    regionType: r.regionType || r.type || undefined,
    typicalHomeValue:
      r.typicalHomeValue ?? r.zhviValue ?? r.medianHomeValue ?? r.homeValueIndex ?? undefined,
    momChangePct: r.monthOverMonthChange ?? r.momChange ?? r.mom ?? undefined,
    yoyChangePct: r.yearOverYearChange ?? r.yoyChange ?? r.yoy ?? undefined,
    forecastOneYearPct: r.oneYearForecast ?? r.forecast1Yr ?? undefined,
    medianListPrice: r.medianListPrice ?? r.medianListingPrice ?? undefined,
    medianSalePrice: r.medianSalePrice ?? undefined,
    medianDaysOnMarket: r.medianDaysOnMarket ?? r.medianDom ?? undefined,
    saleToListRatio: r.saleToListRatio ?? undefined,
    inventoryCount: r.inventoryCount ?? r.activeListings ?? undefined,
  };
}

/**
 * Pure extractor for a named market time-series from a Zillow region-page
 * __NEXT_DATA__ blob. Walks `pageProps.odpMarketAnalytics.<seriesKey>` first,
 * then falls back to `pageProps.<seriesKey>` as a sibling. Coerces both
 * `{date, value}` and Zillow's `{x, y}` point shapes into a uniform
 * `{date: string, value: number}` array. Drops points missing a date or a
 * non-finite numeric value. Returns `[]` on any miss / garbage input so
 * callers never have to null-check.
 *
 * Shared infrastructure for Tier B5 market-analytics endpoints
 * (localPriceTrends, domTrends, inventoryTrends, forecast). Co-locate
 * design: one home-values scrape feeds all four extractors by varying
 * `seriesKey`.
 *
 * @param {object} nextData - parsed __NEXT_DATA__ JSON
 * @param {string} seriesKey - e.g. 'zhviSeries', 'mrktSaleSeries',
 *                             'medianDomSeries', 'forSaleInventorySeries',
 *                             'zhvfForecast'
 * @returns {Array<{date: string, value: number}>}
 */
function findMarketTimeSeries(nextData, seriesKey) {
  const pp = nextData?.props?.pageProps;
  if (!pp || typeof pp !== 'object' || !seriesKey) return [];
  const raw = pp.odpMarketAnalytics?.[seriesKey] ?? pp[seriesKey];
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const pt of raw) {
    if (!pt || typeof pt !== 'object') continue;
    const date = pt.date ?? pt.x ?? null;
    const rawValue = pt.value ?? pt.y;
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!date || typeof date !== 'string') continue;
    if (!Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  return out;
}

// ─────────────────────────── Tier B5 cycle 4 — co-locate cache ───────────
//
// All Tier B5 market-analytics endpoints (localPriceTrends, domTrends,
// inventoryTrends, forecast) scrape the SAME /<region>/home-values/ page —
// they differ only in which sub-payload of `pageProps.odpMarketAnalytics`
// they pluck. Without co-location, calling all four for one region costs
// 4 scrape.do requests. With it, they share one cached __NEXT_DATA__ blob
// per (region, regionType) pair — 4x cost reduction in the hot path.
//
// Cache scope:  'zillow_home_values_payload'
// Cache key:    `${regionType||'default'}:${lowercase(region)}`
// TTL:          3600s (1 hour). Market data refreshes hourly at most;
//               anything shorter defeats the optimization, anything longer
//               risks stale topline pcts in fast-moving markets.
//
// The cached value is the *parsed __NEXT_DATA__ JSON object*, NOT the raw
// HTML — extraction happens before caching so every consumer skips the
// HTML→JSON parse on hits.
//
// Test-only setters (`__setHomeValuesPayloadCacheDbForTests`,
// `__resetHomeValuesPayloadCacheForTests`) let unit tests substitute an
// in-memory cache DB so we can assert on scrape-call counts. NEVER call
// these from production code.

// eslint-disable-next-line global-require
const _scrapeDoCache = require('./scrapeDoCache');

let _homeValuesCacheDb = null;     // null = use the module default (real Postgres)
let _homeValuesCachedFn = null;    // lazy: built on first call, rebuilt on db swap

function _buildHomeValuesCachedFn() {
  return _scrapeDoCache.withCache({
    scope: 'zillow_home_values_payload',
    ttlSec: 3600,
    keyFn: ({ region, regionType } = {}) =>
      `${regionType || 'default'}:${String(region || '').trim().toLowerCase()}`,
    fn: async ({ region, regionType }) => {
      const url = marketStatsUrl(region, regionType);
      // eslint-disable-next-line global-require
      const scrapeDoClient = require('./scrapeDoClient');
      let resp;
      try {
        resp = await scrapeDoClient.scrape(url, {
          headers: DEFAULT_HEADERS,
          geoCode: 'us',
          render: false,
          super: true,
          timeoutMs: 60_000,
        });
      } catch (err) {
        if (err instanceof ScrapeDoError) {
          throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
            status: err.status,
            action: '_fetchHomeValuesPayload',
            reason: 'fetch_failed',
          });
        }
        throw err;
      }
      // Cached value is the parsed __NEXT_DATA__ JSON — every consumer
      // skips the HTML→JSON parse on hits.
      return extractNextData(resp.data);
    },
    db: _homeValuesCacheDb || undefined,
  });
}

/**
 * Internal: fetch + cache the parsed __NEXT_DATA__ blob for a region's
 * /<region>/home-values/ page. Shared by every Tier B5 market-analytics
 * endpoint. NOT exported on the module surface — the only contract is
 * the public endpoints that consume it.
 */
async function _fetchHomeValuesPayload({ region, regionType } = {}) {
  if (!_homeValuesCachedFn) {
    _homeValuesCachedFn = _buildHomeValuesCachedFn();
  }
  return _homeValuesCachedFn({ region, regionType });
}

/**
 * Test-only: swap the DB used by the home-values cache. Pass null to reset
 * to the default. Must call `__resetHomeValuesPayloadCacheForTests()` after
 * to force the wrapper to rebuild.
 */
function __setHomeValuesPayloadCacheDbForTests(db) {
  _homeValuesCacheDb = db;
  _homeValuesCachedFn = null;
}

/** Test-only: drop the in-memory wrapper so the next call rebuilds it. */
function __resetHomeValuesPayloadCacheForTests() {
  _homeValuesCachedFn = null;
}

/**
 * Local price trends — Tier B5 endpoint #1 of 5.
 *
 * Extracts ZHVI, median sale price, and price-per-sqft time series along
 * with topline YoY and 5-year change percentages from the cached
 * /<region>/home-values/ __NEXT_DATA__ blob (Tier B5 cycle 4 co-locate).
 *
 * @param {{region: string, regionType?: 'zip'|'city'|'state'|'county'}} args
 * @returns {Promise<{
 *   regionName?: string,
 *   regionType?: string,
 *   zhviSeries: Array<{date: string, value: number}>,
 *   medianSalePriceSeries: Array<{date: string, value: number}>,
 *   pricePerSqftSeries: Array<{date: string, value: number}>,
 *   yoyChangePct?: number,
 *   fiveYearChangePct?: number,
 * }>}
 */
async function localPriceTrends(args = {}) {
  const { region, regionType } = args;
  if (!region || typeof region !== 'string' || !region.trim()) {
    throw new ZillowScrapeError('localPriceTrends requires region', {
      reason: 'bad_args',
    });
  }
  const nextData = await _fetchHomeValuesPayload({ region, regionType });
  const pp = nextData?.props?.pageProps || {};
  const odp = pp.odpMarketAnalytics || {};
  return {
    regionName: pp.zhviRegion?.name || pp.requestedRegion?.name,
    regionType: pp.zhviRegion?.regionTypeName || regionType,
    zhviSeries: findMarketTimeSeries(nextData, 'zhviSeries'),
    medianSalePriceSeries: findMarketTimeSeries(nextData, 'mrktSaleSeries'),
    pricePerSqftSeries: findMarketTimeSeries(nextData, 'pricePerSqftSeries'),
    yoyChangePct: odp.zhviLatest?.zhviYoY,
    fiveYearChangePct: odp.zhviLatest?.fiveYearChange,
  };
}

/**
 * Forecast — Tier B5 endpoint #4 of 5. ZHVF (Zillow Home Value Forecast)
 * projection: 1-month, 1-quarter, 1-year forward percent change plus the
 * monthly forecast series. Reads from `pageProps.odpMarketAnalytics
 * .zhvfForecast` on the cached home-values payload.
 *
 * @param {{region: string, regionType?: 'zip'|'city'|'state'|'county'}} args
 * @returns {Promise<{
 *   regionName?: string,
 *   regionType?: string,
 *   oneMonthForecastPct: number|null,
 *   oneQuarterForecastPct: number|null,
 *   oneYearForecastPct: number|null,
 *   forecastSeries: Array<{date: string, value: number}>,
 * }>}
 */
async function forecast(args = {}) {
  const { region, regionType } = args;
  if (!region || typeof region !== 'string' || !region.trim()) {
    throw new ZillowScrapeError('forecast requires region', {
      reason: 'bad_args',
    });
  }
  const nextData = await _fetchHomeValuesPayload({ region, regionType });
  const pp = nextData?.props?.pageProps || {};
  const f = pp.odpMarketAnalytics?.zhvfForecast || {};
  const rawSeries = Array.isArray(f.forecastSeries) ? f.forecastSeries : [];
  const forecastSeries = [];
  for (const pt of rawSeries) {
    if (!pt || typeof pt !== 'object') continue;
    const date = pt.date ?? pt.x ?? null;
    const rawValue = pt.value ?? pt.y;
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!date || typeof date !== 'string') continue;
    if (!Number.isFinite(value)) continue;
    forecastSeries.push({ date, value });
  }
  const coerce = (v) => {
    if (v == null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    regionName: pp.zhviRegion?.name || pp.requestedRegion?.name,
    regionType: pp.zhviRegion?.regionTypeName || regionType,
    oneMonthForecastPct: coerce(f.oneMonth ?? f.oneMonthForecast),
    oneQuarterForecastPct: coerce(f.oneQuarter ?? f.oneQuarterForecast),
    oneYearForecastPct: coerce(f.oneYear ?? f.oneYearForecast),
    forecastSeries,
  };
}

/**
 * Region-level market stats (typical home value, MoM, YoY, etc.).
 *
 * @param {{region: string, regionType?: 'zip'|'city'|'state'|'county'}} args
 */
async function marketStats(args = {}) {
  const { region, regionType } = args;
  if (!region) {
    throw new ZillowScrapeError('marketStats requires region', { reason: 'bad_args' });
  }
  const url = marketStatsUrl(region, regionType);
  let resp;
  try {
    // /<region>/home-values/ is region-page heavy and 502s on the default
    // pool; super=true gets through (observed 2026-05).
    resp = await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      render: false,
      super: true,
      timeoutMs: 60_000,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'marketStats',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findMarketStats(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate region stats in __NEXT_DATA__', {
      action: 'marketStats',
      reason: 'no_region_in_payload',
    });
  }
  return normalizeMarketStats(record);
}

// `rentalEstimate` is the action name the frontend uses when it wants
// the rent estimate for a property. Zillow's detail page exposes both
// the sale Zestimate AND the Rent Zestimate from the same JSON blob, so
// `propertyDetails` carries both — we just re-key under the action name
// the caller expects. Without this alias the action falls through to
// the RapidAPI primary; if that quota'd out, the user saw 500s.
async function rentalEstimate(args = {}) {
  const r = await propertyDetails(args);
  return {
    zpid: r?.zpid,
    rentZestimate: r?.rentZestimate ?? null,
    rentZestimateLow: r?.rentZestimateLow ?? null,
    rentZestimateHigh: r?.rentZestimateHigh ?? null,
    // Preserve the rest so callers that read other fields don't break.
    ...r,
  };
}

// ───────────────────────── New actions: walkScore / climate / open houses ─

/**
 * Pull walk / transit / bike scores from a Property record. Zillow embeds
 * these under different keys depending on page version — accept any.
 * Returns null when the page didn't include them (suburban listings often
 * lack a transit score).
 */
function findWalkScore(record) {
  if (!record || typeof record !== 'object') return null;
  // The 2026 detail page surfaces this on the property itself
  const walk = record.walkScore?.walkscore ?? record.walkScore ?? record.walkscore;
  const transit = record.transitScore?.transit_score ?? record.transitScore ?? record.transit_score;
  const bike = record.bikeScore?.bikescore ?? record.bikeScore ?? record.bikescore;
  if (walk == null && transit == null && bike == null) return null;
  return {
    walkScore: walk != null ? Number(walk) : undefined,
    walkDescription: record.walkScore?.description ?? undefined,
    transitScore: transit != null ? Number(transit) : undefined,
    transitDescription: record.transitScore?.description ?? undefined,
    bikeScore: bike != null ? Number(bike) : undefined,
    bikeDescription: record.bikeScore?.description ?? undefined,
  };
}

/**
 * Walk Score / Transit Score / Bike Score for a property. The data lives on
 * the detail page; we reuse the existing detail-page scrape. Throws
 * 'no_data_in_payload' when Zillow stripped the scores (some listings).
 *
 * @param {{zpid?: string, address?: string}} args
 */
async function walkScore(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('walkScore requires zpid or address', { reason: 'bad_args' });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'walkScore',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate Property in __NEXT_DATA__', {
      action: 'walkScore',
      reason: 'no_property_in_payload',
    });
  }
  const scores = findWalkScore(record);
  if (!scores) {
    throw new ZillowScrapeError('No walk/transit/bike score on this listing', {
      action: 'walkScore',
      reason: 'no_data_in_payload',
    });
  }
  return {
    zpid: record.zpid != null ? String(record.zpid) : zpid,
    ...scores,
  };
}

/**
 * Pull climate-risk scores (flood/fire/heat/wind/drought) from a Property
 * record. Zillow added these in 2024 and they sit under `climate.<hazard>Sources`
 * with `riskScore.value` and `riskScore.label`.
 */
function findClimateRisk(record) {
  if (!record || typeof record !== 'object') return null;
  const c = record.climate;
  if (!c || typeof c !== 'object') return null;
  const pickRisk = (source) => {
    if (!source || typeof source !== 'object') return undefined;
    const primary = Array.isArray(source.primary) && source.primary[0]
      ? source.primary[0]
      : source;
    const value = primary.riskScore?.value ?? primary.value;
    const label = primary.riskScore?.label ?? primary.label;
    const max = primary.riskScore?.max ?? primary.max;
    if (value == null && label == null) return undefined;
    return {
      value: value != null ? Number(value) : undefined,
      label,
      max: max != null ? Number(max) : undefined,
      probability: primary.probability ?? undefined,
      insuranceRecommendation: source.insuranceRecommendation ?? undefined,
    };
  };
  const out = {
    flood: pickRisk(c.floodSources),
    fire: pickRisk(c.fireSources),
    heat: pickRisk(c.heatSources),
    wind: pickRisk(c.windSources),
    drought: pickRisk(c.droughtSources),
    air: pickRisk(c.airSources),
  };
  // Strip undefineds; bail if every hazard was missing.
  const hasAny = Object.values(out).some((v) => v !== undefined);
  return hasAny ? out : null;
}

/**
 * Climate-risk scores for a property. Returns flood, fire, heat, wind,
 * drought, and air-quality risk (each 0-10 scale with text label). Throws
 * 'no_data_in_payload' when Zillow has not surfaced the climate widget on
 * this listing (common for older detail pages).
 *
 * @param {{zpid?: string, address?: string}} args
 */
async function climateRisk(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('climateRisk requires zpid or address', { reason: 'bad_args' });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'climateRisk',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate Property in __NEXT_DATA__', {
      action: 'climateRisk',
      reason: 'no_property_in_payload',
    });
  }
  const climate = findClimateRisk(record);
  if (!climate) {
    throw new ZillowScrapeError('No climate-risk data on this listing', {
      action: 'climateRisk',
      reason: 'no_data_in_payload',
    });
  }
  return {
    zpid: record.zpid != null ? String(record.zpid) : zpid,
    climate,
  };
}

/**
 * Open-house schedule for a property. Slice of `propertyDetails` data —
 * convenience wrapper so the agent-tool layer stays one-action-one-call.
 *
 * @param {{zpid?: string, address?: string}} args
 */
async function openHouses(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    openHouses: d.openHouses || [],
    nextOpenHouse: d.nextOpenHouse,
  };
}

// ───────────────────────── Rental comps + nearby sales + coming soon ─

/**
 * Rental comps near a property. Reuses the detail-page scrape and pulls
 * `comparableRentals` if present, falling back to filtering the existing
 * `comps` by rental-status. Different from `comps` which returns sale comps.
 *
 * @param {{zpid?: string, address?: string}} args
 */
async function rentalComps(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('rentalComps requires zpid or address', { reason: 'bad_args' });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'rentalComps',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  const rentals =
    record?.comparableRentals ||
    record?.rentalComparables ||
    (Array.isArray(record?.homeRecommendations?.homes)
      ? record.homeRecommendations.homes.filter(
          (h) => h && (h.homeStatus === 'FOR_RENT' || h.rentZestimate != null)
        )
      : []);
  if (!Array.isArray(rentals) || rentals.length === 0) {
    throw new ZillowScrapeError('No rental comps on this listing', {
      action: 'rentalComps',
      reason: 'no_data_in_payload',
    });
  }
  return {
    zpid: record?.zpid != null ? String(record.zpid) : zpid,
    rentZestimate: record?.rentZestimate,
    comps: rentals.map(mapListingToSummary).filter(Boolean),
  };
}

/**
 * Recently sold listings in a N-mile radius of a property. Different from
 * `comps` (Zillow's algorithmic "similar homes") — this is a pure geographic
 * radius search. Useful for ARV when Zillow's own algo is conservative.
 *
 * Internally: fetch the detail page to get lat/lng, then run a coordinate
 * search with status=recentlySold. Two scrape.do calls per invocation.
 *
 * @param {{zpid?: string, address?: string, radius_mi?: number}} args
 */
async function recentlySoldNearby(args = {}) {
  const { zpid, address, radius_mi: radiusMi = 0.5 } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('recentlySoldNearby requires zpid or address', {
      reason: 'bad_args',
    });
  }
  const d = await propertyDetails({ zpid, address });
  const lat = d.latitude;
  const lng = d.longitude;
  if (lat == null || lng == null) {
    throw new ZillowScrapeError(
      'recentlySoldNearby: detail page missing lat/lng — cannot geo-search',
      { action: 'recentlySoldNearby', reason: 'no_data_in_payload' }
    );
  }
  const search = await searchByCoordinates({
    lat,
    lng,
    radius_mi: Number(radiusMi) || 0.5,
    status: 'recentlySold',
  });
  return {
    zpid: d.zpid,
    centerLat: lat,
    centerLng: lng,
    radiusMi: Number(radiusMi) || 0.5,
    totalResultCount: search.totalResultCount,
    results: search.results,
  };
}

/**
 * Coming-soon listings in a location. Zillow surfaces these on the same
 * search URL with `_csl` flag (coming-soon listings). We build the
 * searchQueryState with `isComingSoon=true` and the other isXxx flags
 * forced false so we get only coming-soon.
 *
 * @param {{location: string, page?: number}} args
 */
async function comingSoon(args = {}) {
  const { location, page } = args;
  if (!location) {
    throw new ZillowScrapeError('comingSoon requires location', { reason: 'bad_args' });
  }
  // We don't know exact bounds for the location — rely on the location-string
  // URL and append the coming-soon filter via searchQueryState. Zillow accepts
  // both forms. We use the simpler /homes/<location>_rb/ + searchQueryState
  // overlay so we don't need to geocode the location first.
  let url = `${searchUrlForLocation(location)}?searchQueryState=${encodeURIComponent(
    JSON.stringify({
      pagination: page && Number(page) > 1 ? { currentPage: Number(page) } : {},
      isMapVisible: false,
      isListVisible: true,
      filterState: {
        isComingSoon: { value: true },
        isForSaleByAgent: { value: false },
        isForSaleByOwner: { value: false },
        isNewConstruction: { value: false },
        isAuction: { value: false },
        isForSaleForeclosure: { value: false },
        isRecentlySold: { value: false },
      },
    })
  )}`;
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'comingSoon',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: 'comingSoon',
      reason: 'no_list_results',
    });
  }
  const total = findTotalResultCount(nextData);
  return {
    location,
    status: 'ComingSoon',
    page: Number(page) || 1,
    totalResultCount: total ?? listResults.length,
    results: listResults.map(mapListingToSummary).filter(Boolean),
  };
}

// ═════════════════════════ Tier B2 — property-type filters ══════════════════
// Helper that builds a /homes/<location>_rb/ URL with Zillow's
// searchQueryState filterState pre-set for a specific property type
// (multi-family, lots/land, manufactured, etc.). Exported for direct
// unit testing without hitting the network.
//
// `homeTypeFlags` is an object with the is{Type} keys to set true; all
// OTHER home-type flags are explicitly set false so Zillow doesn't fall
// back to its default SFR-weighted mix.
//
// Known home-type flags (from Zillow's searchQueryState contract):
//   isSingleFamily, isMultiFamily, isApartment, isCondo, isTownhouse,
//   isLotLand, isManufactured, isApartmentOrCondo
const HOME_TYPE_FLAGS = [
  'isSingleFamily',
  'isMultiFamily',
  'isApartment',
  'isCondo',
  'isTownhouse',
  'isLotLand',
  'isManufactured',
  'isApartmentOrCondo',
];

function buildHomeTypeSearchUrl(args = {}) {
  const { location, homeTypeFlags = {}, extraFilters = {}, page } = args;
  if (!location) {
    throw new ZillowScrapeError('buildHomeTypeSearchUrl requires location', {
      reason: 'bad_args',
    });
  }
  const filterState = {};
  // CRITICAL: only lock down home-type flags when the caller explicitly
  // names at least one. When the caller passes homeTypeFlags={} (e.g.
  // searchSeniorCommunities, searchHudHomes, searchMakeMeMove,
  // searchNewConstruction, searchTinyHomes), we leave home-type flags
  // UNSET so Zillow uses its default home-type mix. Forcing every type
  // to `false` produces empty result sets — that was the PR #383 bug.
  if (Object.keys(homeTypeFlags).length > 0) {
    for (const flag of HOME_TYPE_FLAGS) {
      filterState[flag] = { value: Boolean(homeTypeFlags[flag]) };
    }
  }
  // Layer additional filter clauses (lotSize, sqft, keywords, is55plus, etc.)
  // on top — these may include non-boolean shapes like `lotSize: {min, max}`.
  Object.assign(filterState, extraFilters);

  // TD-101 — defensive normalization of bare-string keywords.
  // Zillow's searchQueryState parser rejects `keywords: "HUD"` (bare string)
  // and expects `keywords: {value: "HUD"}` (the same {value: X} shape every
  // other filterState entry uses). Bug observed live as HTTP 400 from
  // scrape.do on searchHudHomes 2026-05-14.
  // We wrap defensively here so the bug class can't recur from a new
  // endpoint that passes a bare string.
  if (typeof filterState.keywords === 'string') {
    filterState.keywords = { value: filterState.keywords };
  }

  return `${searchUrlForLocation(location)}?searchQueryState=${encodeURIComponent(
    JSON.stringify({
      pagination: page && Number(page) > 1 ? { currentPage: Number(page) } : {},
      isMapVisible: false,
      isListVisible: true,
      filterState,
    })
  )}`;
}

/**
 * Internal runner — fetch+parse a Tier B2 search URL and return the
 * canonical `{location, status, page, totalResultCount, results}` shape.
 * Centralizes the scrape+parse so the 10 type-specific wrappers stay
 * small.
 */
async function runHomeTypeSearch(action, { location, page, url, status }) {
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action,
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action,
      reason: 'no_list_results',
    });
  }
  const total = findTotalResultCount(nextData);
  return {
    location,
    status,
    page: Number(page) || 1,
    totalResultCount: total ?? listResults.length,
    results: listResults.map(mapListingToSummary).filter(Boolean),
  };
}

/**
 * Internal factory — produces a Tier B2 search wrapper from a config.
 * Centralizes the {validate location, build URL, scrape, return shape}
 * boilerplate so each new property-type endpoint is one config entry.
 */
function makeHomeTypeSearch({ action, status, homeTypeFlags = {}, extraFilters }) {
  return async function (args = {}) {
    const { location, page } = args;
    if (!location) {
      throw new ZillowScrapeError(`${action} requires location`, { reason: 'bad_args' });
    }
    const url = buildHomeTypeSearchUrl({
      location,
      homeTypeFlags,
      extraFilters: typeof extraFilters === 'function' ? extraFilters(args) : extraFilters,
      page,
    });
    return runHomeTypeSearch(action, { location, page, url, status });
  };
}

/**
 * Multi-family search (2-4 unit duplex/triplex/quad and optionally larger).
 * Toggles `filterState.isMultiFamily=true` with all other home-type flags
 * forced false so Zillow doesn't fall back to its default SFR-weighted mix.
 *
 * @param {{location: string, page?: number}} args
 */
const searchMultiFamily = makeHomeTypeSearch({
  action: 'searchMultiFamily',
  status: 'MultiFamily',
  homeTypeFlags: { isMultiFamily: true },
});

/** Manufactured / mobile homes — `isManufactured=true`. */
const searchManufactured = makeHomeTypeSearch({
  action: 'searchManufactured',
  status: 'Manufactured',
  homeTypeFlags: { isManufactured: true },
});

/** Townhouses — `isTownhouse=true`. */
const searchTownhouses = makeHomeTypeSearch({
  action: 'searchTownhouses',
  status: 'Townhouse',
  homeTypeFlags: { isTownhouse: true },
});

/** Condos — `isCondo=true`. */
const searchCondos = makeHomeTypeSearch({
  action: 'searchCondos',
  status: 'Condo',
  homeTypeFlags: { isCondo: true },
});

/**
 * 55+ / senior communities. Zillow uses a secondary `is55plusCommunities`
 * flag (not a home-type — these are usually condos or SFR). We don't toggle
 * any home-type flags so the search remains broad within the 55+ community
 * scope.
 */
const searchSeniorCommunities = makeHomeTypeSearch({
  action: 'searchSeniorCommunities',
  status: 'SeniorCommunity',
  extraFilters: { is55plusCommunities: { value: true } },
});

/**
 * HUD homes URL builder — testable wrapper around buildHomeTypeSearchUrl
 * with the canonical HUD filterState. Exported so unit tests can verify
 * the URL shape without hitting the network (TD-101 regression: the bare-
 * string `keywords` value previously produced HTTP 400 from scrape.do).
 */
function buildHudHomesSearchUrl({ location, page } = {}) {
  return buildHomeTypeSearchUrl({
    location,
    homeTypeFlags: {},
    extraFilters: {
      isForSaleForeclosure: { value: true },
      keywords: { value: 'HUD' },
    },
    page,
  });
}

/**
 * HUD homes. Zillow has no first-class HUD flag — we filter on
 * `isForSaleForeclosure=true` plus a `keywords: {value: "HUD"}` clause that
 * matches inside listing descriptions. Real HUD inventory lives on
 * hudhomestore.gov; Zillow only surfaces the subset re-listed by HUD-
 * authorized brokers.
 */
const searchHudHomes = makeHomeTypeSearch({
  action: 'searchHudHomes',
  status: 'HudHomes',
  extraFilters: {
    isForSaleForeclosure: { value: true },
    keywords: { value: 'HUD' },
  },
});

/**
 * "Make Me Move" — owner-tagged "would sell at price X" listings.
 * Zillow retired the public MMM UI in 2021 but the searchQueryState filter
 * flag still returns matches in many markets. If `isMakeMeMove` returns
 * empty in your market, fall back to a keyword search via `searchByUrl`.
 */
const searchMakeMeMove = makeHomeTypeSearch({
  action: 'searchMakeMeMove',
  status: 'MakeMeMove',
  extraFilters: { isMakeMeMove: { value: true } },
});

// ── Parameter-bearing variants — exposed URL builders for testability ────

const SQFT_PER_ACRE = 43560;

/**
 * Validate + coerce a numeric arg. Accepts numbers and numeric strings
 * ("2"). Throws ZillowScrapeError on non-numeric input — silently
 * NaN-ifying into the URL produced Zillow 400s and silent filter-skips
 * (PR #383 review finding).
 */
function coerceNumericArg(value, paramName) {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new ZillowScrapeError(`${paramName} must be a number, got ${JSON.stringify(value)}`, {
      reason: 'bad_args',
    });
  }
  return n;
}

/**
 * Lots/land search URL — testable builder. Converts caller-friendly `acres`
 * to Zillow's native sqft unit on the way into filterState.lotSize.
 */
function buildLotsLandSearchUrl({ location, min_acres, max_acres, page }) {
  const minAcres = coerceNumericArg(min_acres, 'min_acres');
  const maxAcres = coerceNumericArg(max_acres, 'max_acres');
  const extraFilters = {};
  if (minAcres !== undefined || maxAcres !== undefined) {
    extraFilters.lotSize = {};
    if (minAcres !== undefined) extraFilters.lotSize.min = minAcres * SQFT_PER_ACRE;
    if (maxAcres !== undefined) extraFilters.lotSize.max = maxAcres * SQFT_PER_ACRE;
  }
  return buildHomeTypeSearchUrl({
    location,
    homeTypeFlags: { isLotLand: true },
    extraFilters,
    page,
  });
}

const searchLotsLand = makeHomeTypeSearch({
  action: 'searchLotsLand',
  status: 'LotsLand',
  homeTypeFlags: { isLotLand: true },
  extraFilters: (args) => {
    const minAcres = coerceNumericArg(args.min_acres, 'min_acres');
    const maxAcres = coerceNumericArg(args.max_acres, 'max_acres');
    const extra = {};
    if (minAcres !== undefined || maxAcres !== undefined) {
      extra.lotSize = {};
      if (minAcres !== undefined) extra.lotSize.min = minAcres * SQFT_PER_ACRE;
      if (maxAcres !== undefined) extra.lotSize.max = maxAcres * SQFT_PER_ACRE;
    }
    return extra;
  },
});

/**
 * New-construction search URL builder. Optionally embeds builder name as a
 * keyword (Zillow indexes builder name in listing copy: "Lennar", "DR Horton").
 */
function buildNewConstructionSearchUrl({ location, builder, page }) {
  const extraFilters = { isNewConstruction: { value: true } };
  // TD-101: keywords must be {value: X}, not bare string. See
  // buildHomeTypeSearchUrl auto-normalization for the safety net.
  if (builder) extraFilters.keywords = { value: String(builder) };
  return buildHomeTypeSearchUrl({ location, homeTypeFlags: {}, extraFilters, page });
}

const searchNewConstruction = makeHomeTypeSearch({
  action: 'searchNewConstruction',
  status: 'NewConstruction',
  extraFilters: (args) => {
    const extra = { isNewConstruction: { value: true } };
    if (args.builder) extra.keywords = { value: String(args.builder) };
    return extra;
  },
});

/**
 * Resolve the sqft.max value for tiny-homes search. Validates numeric input
 * (throws on NaN) and treats `0`/missing as "use default 600" — 0 would
 * produce an empty result set, which is rarely the caller's intent.
 */
function resolveTinyHomesMaxSqft(max_sqft) {
  const coerced = coerceNumericArg(max_sqft, 'max_sqft');
  if (coerced === undefined || coerced === 0) return 600;
  return coerced;
}

/**
 * Tiny-homes search URL builder. No first-class Zillow flag for "tiny home"
 * exists, so we constrain by max sqft (default 600) and add a keyword match
 * over listing copy.
 */
function buildTinyHomesSearchUrl({ location, max_sqft, page }) {
  return buildHomeTypeSearchUrl({
    location,
    homeTypeFlags: {},
    extraFilters: {
      sqft: { max: resolveTinyHomesMaxSqft(max_sqft) },
      keywords: { value: 'tiny home' },
    },
    page,
  });
}

const searchTinyHomes = makeHomeTypeSearch({
  action: 'searchTinyHomes',
  status: 'TinyHomes',
  extraFilters: (args) => ({
    sqft: { max: resolveTinyHomesMaxSqft(args.max_sqft) },
    keywords: { value: 'tiny home' },
  }),
});

/**
 * Auction listings in a location. Zillow exposes a `/auctions/` filter
 * sub-path that pre-filters to auction-status only.
 *
 * @param {{location: string, page?: number}} args
 */
async function auctionListings(args = {}) {
  const { location, page } = args;
  if (!location) {
    throw new ZillowScrapeError('auctionListings requires location', { reason: 'bad_args' });
  }
  // Use searchQueryState overlay; Zillow doesn't have a stable /auctions/
  // sub-path URL across all locations so the searchQueryState route is more
  // robust.
  const url = `${searchUrlForLocation(location)}?searchQueryState=${encodeURIComponent(
    JSON.stringify({
      pagination: page && Number(page) > 1 ? { currentPage: Number(page) } : {},
      isMapVisible: false,
      isListVisible: true,
      filterState: {
        isAuction: { value: true },
        isForSaleByAgent: { value: false },
        isForSaleByOwner: { value: false },
        isNewConstruction: { value: false },
        isComingSoon: { value: false },
        isRecentlySold: { value: false },
      },
    })
  )}`;
  return runSearchUrl(url, { location, status: 'Auction', page });
}

module.exports = {
  ZillowScrapeError,
  // Detail-class:
  propertyDetails,
  photos,
  taxes,
  priceHistory,
  zestimate,
  rentalEstimate,
  schools,
  comps,
  zestimateHistory,
  walkScore,
  climateRisk,
  openHouses,
  rentalComps,
  recentlySoldNearby,
  // Detail-class — Tier B1 slice wrappers:
  propertyMedia,
  propertyTaxHistory,
  propertyConstruction,
  propertyUtilities,
  propertyListingTerms,
  livabilityProfile,
  // Search-class:
  search,
  searchByAddress,
  searchByCoordinates,
  searchByBounds,
  searchByUrl,
  forSale,
  forRent,
  recentlySold,
  foreclosures,
  fsbo,
  comingSoon,
  auctionListings,
  // Search-class — Tier B2 property-type-specific:
  searchMultiFamily,
  searchManufactured,
  searchTownhouses,
  searchCondos,
  searchSeniorCommunities,
  searchHudHomes,
  searchMakeMeMove,
  searchLotsLand,
  searchNewConstruction,
  searchTinyHomes,
  buildHomeTypeSearchUrl,
  buildLotsLandSearchUrl,
  buildNewConstructionSearchUrl,
  buildTinyHomesSearchUrl,
  buildHudHomesSearchUrl,
  // Value / market / mortgage / agent:
  mortgageRates,
  mortgageCalculator,
  agentProfile,
  marketStats,
  // Market-analytics — Tier B5:
  localPriceTrends,
  forecast,
  // Test-only — co-locate cache db injection. Do NOT call from production.
  __setHomeValuesPayloadCacheDbForTests,
  __resetHomeValuesPayloadCacheForTests,
  // Exported for tests:
  extractNextData,
  findPropertyRecord,
  findListResults,
  findTotalResultCount,
  mapPropertyToRapidApiShape,
  mapListingToSummary,
  searchUrlForLocation,
  buildSearchQueryState,
  boundsFromCenterRadius,
  findZestimateHistory,
  findMortgageRates,
  normalizeMortgageRate,
  findAgentProfile,
  normalizeAgentProfile,
  findMarketStats,
  normalizeMarketStats,
  marketStatsUrl,
  findMarketTimeSeries,
  findWalkScore,
  findClimateRisk,
  derivePropertyTaxHistory,
};
