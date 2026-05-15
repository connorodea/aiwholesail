/**
 * Thin client for the aiwholesail-offmarket-api Python service.
 *
 * The Python service owns all the heavy lifting (auth, rate limit,
 * usage recording, scoring). This module just builds the HTTP request
 * shape — URL + bearer header + JSON body. The route handlers do the
 * actual fetch and response forwarding.
 *
 * Env:
 *   OFFMARKET_API_URL  — defaults to http://127.0.0.1:8002 (co-located VPS)
 *   OFFMARKET_API_KEY  — provisioned via mint_api_key on the Python service
 */

'use strict';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8002';

function getOffmarketBaseUrl() {
  const raw = process.env.OFFMARKET_API_URL || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');  // strip trailing slashes
}

function buildRequest({ apiKey, baseUrl, method, path, body, query }) {
  if (!apiKey) throw new Error('offmarket-client: apiKey is required');
  if (!baseUrl) throw new Error('offmarket-client: baseUrl is required');
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error('offmarket-client: path must start with /');
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

module.exports = { buildRequest, getOffmarketBaseUrl };
