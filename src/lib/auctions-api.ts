/**
 * Client for the aiwholesail-auctions-api Python service.
 *
 * Reads VITE_AUCTIONS_API_URL — defaults to the production host. In dev,
 * point it at a local uvicorn instance via `.env.local`:
 *   VITE_AUCTIONS_API_URL=http://localhost:8000
 *
 * The Node `aiwholesail-api` may later proxy this so the browser only ever
 * talks to one origin; for now the frontend calls the auctions API directly.
 */

import type { AuctionFilters, AuctionListResponse } from '@/types/auction';

const AUCTIONS_API_URL =
  (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
    ?.VITE_AUCTIONS_API_URL || 'https://auctions-api.aiwholesail.com';

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
  const res = await fetch(`${AUCTIONS_API_URL}/api/v1/auctions${buildQuery(filters)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AuctionsApiError(
      `Auctions API ${res.status}: ${text.slice(0, 200) || res.statusText}`,
      res.status,
    );
  }
  return res.json();
}
