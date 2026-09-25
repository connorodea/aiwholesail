/**
 * Auction listing types — canonical shape returned by the
 * `aiwholesail-auctions-api` Python service.
 *
 * Keep in sync with app/schemas/auction.py over there. Any time a field is
 * added to the API schema, mirror it here.
 */

export type AuctionSource =
  | 'hud'
  | 'hubzu'
  | 'auctions_com'
  | 'xome'
  | 'servicelink'
  | 'williams_williams';

export type AuctionType =
  | 'reo'
  | 'foreclosure'
  | 'short_sale'
  | 'live'
  | 'online_bid'
  | 'sealed_bid'
  | 'tax_sale'
  | 'unknown';

export type AuctionStatus =
  | 'upcoming'
  | 'active'
  | 'pending'
  | 'sold'
  | 'cancelled'
  | 'unknown';

export interface AuctionPhoto {
  url: string;
  sort_order: number;
}

export interface Auction {
  id: string;
  source: AuctionSource;
  source_listing_id: string;
  source_url: string | null;

  auction_type: AuctionType;
  status: AuctionStatus;
  auction_start_at: string | null;
  auction_end_at: string | null;
  bid_deadline_at: string | null;

  starting_bid_cents: number | null;
  current_bid_cents: number | null;
  reserve_price_cents: number | null;
  minimum_bid_cents: number | null;
  deposit_required_cents: number | null;
  estimated_market_value_cents: number | null;

  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;

  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sq_ft: number | null;
  lot_sq_ft: number | null;
  year_built: number | null;

  title: string | null;
  description: string | null;

  photos: AuctionPhoto[];
}

export interface AuctionListResponse {
  items: Auction[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuctionFilters {
  state?: string;
  city?: string;
  source?: AuctionSource;
  auction_type?: AuctionType;
  status?: AuctionStatus;
  min_price_cents?: number;
  max_price_cents?: number;
  page?: number;
  page_size?: number;
}

export const AUCTION_SOURCE_LABEL: Record<AuctionSource, string> = {
  hud: 'HUD Homes',
  hubzu: 'Hubzu',
  auctions_com: 'Auction.com',
  xome: 'Xome',
  servicelink: 'ServiceLink',
  williams_williams: 'Williams & Williams',
};

export const AUCTION_TYPE_LABEL: Record<AuctionType, string> = {
  reo: 'REO',
  foreclosure: 'Foreclosure',
  short_sale: 'Short Sale',
  live: 'Live Auction',
  online_bid: 'Online Auction',
  sealed_bid: 'Sealed Bid',
  tax_sale: 'Tax Sale',
  unknown: 'Auction',
};
