/**
 * Client for the auctions feed.
 *
 * The frontend hits the Node `aiwholesail-api` at `/api/auctions/*`, which
 * proxies to the Python `aiwholesail-auctions-api` service. Same posture as
 * `/api/offmarket-iq/*` — single origin, auth + rate-limit at the Node layer.
 *
 * We reuse the existing `apiFetch` from `api-client` so auth tokens, refresh
 * logic, and error normalization flow through one code path.
 */

import { apiFetch } from '@/lib/api-client';
import type { AuctionFilters, AuctionListResponse } from '@/types/auction';

export class AuctionsApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'AuctionsApiError';
  }
}

function buildQuery(filters: AuctionFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listAuctions(filters: AuctionFilters = {}): Promise<AuctionListResponse> {
  const res = await apiFetch<AuctionListResponse>(`/api/auctions${buildQuery(filters)}`, {
    method: 'GET',
  });
  if (res.error || !res.data) {
    throw new AuctionsApiError(res.error || 'Auctions API returned no data', 0);
  }
  return res.data;
}
