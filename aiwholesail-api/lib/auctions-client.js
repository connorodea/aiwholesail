/**
 * Thin client for the aiwholesail-auctions-api Python service.
 *
 * The Python service owns auction-listing aggregation across HUD and
 * (pending) Hubzu / auctions.com / xome / servicelink / williams-williams.
 * This module just builds the HTTP request — URL + bearer header + JSON body.
 * Route handlers do the fetch and response forwarding.
 *
 * Mirrors lib/offmarket-client.js so the deploy posture stays consistent
 * across the two Python sister services.
 *
 * Env:
 *   AUCTIONS_API_URL  — defaults to http://127.0.0.1:8010 (co-located VPS)
 *   AUCTIONS_API_KEY  — provisioned via the Python service's api_keys table
 */

'use strict';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8010';

function getAuctionsBaseUrl() {
  const raw = process.env.AUCTIONS_API_URL || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function buildRequest({ apiKey, baseUrl, method, path, body, query }) {
  if (!apiKey) throw new Error('auctions-client: apiKey is required');
  if (!baseUrl) throw new Error('auctions-client: baseUrl is required');
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error('auctions-client: path must start with /');
  }

  let url = `${baseUrl.replace(/\/+$/, '')}${path}`;

  if (query && typeof query === 'object') {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const req = {
    url,
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined && body !== null) {
    req.body = JSON.stringify(body);
  }
  return req;
}

module.exports = { buildRequest, getAuctionsBaseUrl };
