const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { attachSubscription, checkSearchLimit } = require('../middleware/subscription');

const router = express.Router();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

/**
 * POST /api/property/zillow/search
 * Search for properties on Zillow
 */
router.post('/zillow/search', authenticate, attachSubscription, checkSearchLimit, asyncHandler(async (req, res) => {
  const {
    location,
    page = 1,
    status = 'forSale',
    bedrooms,
    bathrooms,
    minPrice,
    maxPrice,
    propertyType,
    sortBy,
    fsbo
  } = req.body;

  if (!location) {
    return res.status(400).json({ error: 'Location required' });
  }

  // Rate limiting
  const identifier = req.user?.id || req.ip;
  const rateLimit = await checkDatabaseRateLimit(identifier, 'zillow-search', 60, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const params = {
    location,
    page: String(page),
    status_type: status
  };

  if (bedrooms) params.bedsMin = bedrooms;
  if (bathrooms) params.bathsMin = bathrooms;
  if (minPrice) params.minPrice = minPrice;
  if (maxPrice) params.maxPrice = maxPrice;
  if (propertyType) params.home_type = propertyType;
  if (sortBy) params.sort = sortBy;
  if (fsbo) params.isForSaleByOwner = 'true';

  try {
    const response = await axios.get(
      'https://zillow-working-api.p.rapidapi.com/search/byaddress',
      {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('[Property] Zillow search error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search properties' });
  }
}));

/**
 * POST /api/property/zillow/details
 * Get property details from Zillow
 */
router.post('/zillow/details', optionalAuth, asyncHandler(async (req, res) => {
  const { zpid, address } = req.body;

  if (!zpid && !address) {
    return res.status(400).json({ error: 'ZPID or address required' });
  }

  const identifier = req.user?.id || req.ip;
  const rateLimit = await checkDatabaseRateLimit(identifier, 'zillow-details', 60, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    const params = {};
    if (zpid) params.zpid = zpid;
    if (address) params.propertyaddress = address;

    const response = await axios.get(
      'https://zillow-working-api.p.rapidapi.com/pro/byaddress',
      {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('[Property] Zillow details error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get property details' });
  }
}));

/**
 * POST /api/property/intelligence
 * Get property intelligence data
 */
router.post('/intelligence', authenticate, asyncHandler(async (req, res) => {
  const { propertyId, zpid, address } = req.body;

  if (!propertyId && !zpid && !address) {
    return res.status(400).json({ error: 'Property identifier required' });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'property-intelligence', 30, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Check if we have cached data
  const cached = await query(
    `SELECT * FROM property_intelligence
     WHERE (property_id = $1 OR zpid = $2)
     AND updated_at > NOW() - INTERVAL '7 days'`,
    [propertyId || '', zpid || '']
  );

  if (cached.rows.length > 0) {
    return res.json(cached.rows[0]);
  }

  try {
    // Fetch fresh data from APIs
    const params = {};
    if (zpid) params.zpid = zpid;
    if (address) params.propertyaddress = address;

    const [propertyData, taxData] = await Promise.all([
      axios.get('https://zillow-working-api.p.rapidapi.com/pro/byaddress', {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
        }
      }).catch(() => ({ data: {} })),
      axios.get('https://zillow-working-api.p.rapidapi.com/tax', {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
        }
      }).catch(() => ({ data: {} }))
    ]);

    const data = propertyData.data || {};
    const tax = taxData.data || {};

    // Build property intelligence record
    const intelligence = {
      property_id: propertyId || zpid || address,
      zpid: zpid || data.zpid,
      user_id: req.user.id,
      owner_name: data.ownerName || null,
      owner_address: data.ownerAddress ? JSON.stringify(data.ownerAddress) : null,
      tax_amount: tax.taxAnnualAmount || data.taxAssessedValue || null,
      tax_year: tax.taxYear || null,
      tax_history: tax.taxHistory ? JSON.stringify(tax.taxHistory) : null,
      assessed_value: data.taxAssessedValue || null,
      market_value: data.zestimate || data.price || null,
      year_built: data.yearBuilt || null,
      square_footage: data.livingArea || null,
      lot_size: data.lotSize || null,
      absentee_owner: data.isAbsenteeOwner || false,
      estimated_equity: data.equity || null,
      foreclosure_risk: data.isForeclosure || false,
      tax_delinquent: data.isTaxDelinquent || false
    };

    // Store in database
    const result = await query(
      `INSERT INTO property_intelligence (
        property_id, zpid, user_id, owner_name, owner_address,
        tax_amount, tax_year, tax_history, assessed_value, market_value,
        year_built, square_footage, lot_size, absentee_owner,
        estimated_equity, foreclosure_risk, tax_delinquent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (property_id) DO UPDATE SET
        owner_name = EXCLUDED.owner_name,
        tax_amount = EXCLUDED.tax_amount,
        market_value = EXCLUDED.market_value,
        updated_at = NOW()
      RETURNING *`,
      [
        intelligence.property_id, intelligence.zpid, intelligence.user_id,
        intelligence.owner_name, intelligence.owner_address, intelligence.tax_amount,
        intelligence.tax_year, intelligence.tax_history, intelligence.assessed_value,
        intelligence.market_value, intelligence.year_built, intelligence.square_footage,
        intelligence.lot_size, intelligence.absentee_owner, intelligence.estimated_equity,
        intelligence.foreclosure_risk, intelligence.tax_delinquent
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Property] Intelligence error:', error);
    res.status(500).json({ error: 'Failed to get property intelligence' });
  }
}));

/**
 * POST /api/property/skip-trace
 * Skip trace owner information
 */
router.post('/skip-trace', authenticate, [
  body('firstName').optional(),
  body('lastName').optional(),
  body('address').optional(),
  body('city').optional(),
  body('state').optional()
], asyncHandler(async (req, res) => {
  const { firstName, lastName, address, city, state, zipcode } = req.body;

  if (!firstName && !lastName && !address) {
    return res.status(400).json({ error: 'Name or address required for skip trace' });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'skip-trace', 20, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    // Build search query
    const params = {};
    if (firstName) params.first_name = firstName;
    if (lastName) params.last_name = lastName;
    if (address) params.street_address = address;
    if (city) params.city = city;
    if (state) params.state = state;
    if (zipcode) params.zipcode = zipcode;

    const response = await axios.get(
      'https://skip-tracing-working-api.p.rapidapi.com/search',
      {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'skip-tracing-working-api.p.rapidapi.com'
        }
      }
    );

    const data = response.data || {};

    // Format response
    const result = {
      success: true,
      data: {
        phones: data.phones || [],
        emails: data.emails || [],
        names: data.names || [],
        addresses: data.addresses || [],
        relatives: data.relatives || [],
        age: data.age || null
      },
      cost: 0.05 // Estimated cost per query
    };

    res.json(result);
  } catch (error) {
    console.error('[Property] Skip trace error:', error.response?.data || error.message);

    // Return fallback guidance
    res.json({
      success: false,
      error: 'Skip trace API unavailable',
      fallbackGuidance: [
        'Try county assessor records',
        'Check public records databases',
        'Search social media platforms',
        'Use white pages or people finder sites'
      ]
    });
  }
}));

/**
 * POST /api/property/off-market
 * Discover off-market properties
 */
router.post('/off-market', authenticate, asyncHandler(async (req, res) => {
  const { location, radius = 5, filters = {} } = req.body;

  if (!location) {
    return res.status(400).json({ error: 'Location required' });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'off-market', 15, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    // Search for properties with distress indicators
    const params = {
      location,
      radius: String(radius),
      include_foreclosures: 'true',
      include_pre_foreclosures: 'true',
      include_auctions: 'true'
    };

    if (filters.minBeds) params.beds_min = filters.minBeds;
    if (filters.maxPrice) params.price_max = filters.maxPrice;
    if (filters.propertyType) params.home_type = filters.propertyType;

    const response = await axios.get(
      'https://zillow-working-api.p.rapidapi.com/search/foreclosures',
      {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
        }
      }
    );

    res.json({
      properties: response.data?.results || [],
      count: response.data?.totalResultCount || 0,
      filters: {
        location,
        radius,
        ...filters
      }
    });
  } catch (error) {
    console.error('[Property] Off-market error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search off-market properties' });
  }
}));

/**
 * POST /api/property/comps
 * Get comparable sales
 */
router.post('/comps', authenticate, asyncHandler(async (req, res) => {
  const { zpid, address } = req.body;

  if (!zpid && !address) {
    return res.status(400).json({ error: 'ZPID or address required' });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'property-comps', 30, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    const params = {};
    if (zpid) params.byzpid = zpid;
    if (address) params.byaddress = address;

    const response = await axios.get(
      'https://zillow-working-api.p.rapidapi.com/comparable_homes',
      {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('[Property] Comps error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get comparable sales' });
  }
}));

/**
 * POST /api/property/photos
 * Get property photos
 */
router.post('/photos', optionalAuth, asyncHandler(async (req, res) => {
  const { zpid, address } = req.body;

  if (!zpid && !address) {
    return res.status(400).json({ error: 'ZPID or address required' });
  }

  try {
    const params = {};
    if (zpid) params.zpid = zpid;
    if (address) params.propertyaddress = address;

    const response = await axios.get(
      'https://zillow-working-api.p.rapidapi.com/photos',
      {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('[Property] Photos error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get property photos' });
  }
}));

module.exports = router;
