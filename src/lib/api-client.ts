/**
 * AIWholesail API Client
 * Replaces Supabase client for self-hosted API on Hetzner
 */
import { API_BASE_URL } from './platform';
import type { Property } from '@/types/zillow';

const API_URL = API_BASE_URL;

// Token storage keys
const ACCESS_TOKEN_KEY = 'aiwholesail_access_token';
const REFRESH_TOKEN_KEY = 'aiwholesail_refresh_token';
const USER_KEY = 'aiwholesail_user';

// Types
export interface User {
  id: string;
  email: string;
  fullName?: string;
  emailVerified?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

// Token management
export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string): void => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  getUser: (): User | null => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },
  setUser: (user: User): void => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

// Auth state change listeners
type AuthListener = (user: User | null) => void;
const authListeners: Set<AuthListener> = new Set();

export const onAuthStateChange = (callback: AuthListener): (() => void) => {
  authListeners.add(callback);
  // Call immediately with current state
  callback(tokenStorage.getUser());
  return () => authListeners.delete(callback);
};

const notifyAuthChange = (user: User | null): void => {
  authListeners.forEach(callback => callback(user));
};

// Base fetch wrapper with auth
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;
  const accessToken = tokenStorage.getAccessToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration — only clear auth for auth-related 401s
    if (response.status === 401) {
      const data = await response.json();
      if (data.code === 'TOKEN_EXPIRED') {
        // Try to refresh token
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry original request
          (headers as Record<string, string>)['Authorization'] = `Bearer ${tokenStorage.getAccessToken()}`;
          const retryResponse = await fetch(url, { ...options, headers });
          return retryResponse.json();
        }
        // Refresh failed — clear auth
        tokenStorage.clear();
        notifyAuthChange(null);
      }
      // For non-token-expired 401s (e.g. unconfigured services), just return the error
      // without logging the user out
      return { error: data.error || 'Request failed' };
    }

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Request failed', code: data.code, errors: data.errors };
    }

    return { data };
  } catch (error) {
    console.error('[API] Request failed:', error);
    return { error: 'Network error' };
  }
}

// Refresh access token
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    tokenStorage.setAccessToken(data.accessToken);
    tokenStorage.setRefreshToken(data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ============ AUTH API ============
export const auth = {
  signUp: async (
    email: string,
    password: string,
    fullName?: string,
    phoneNumber?: string,
    attribution?: Record<string, string | undefined>,
  ): Promise<ApiResponse<{ user: User } & AuthTokens>> => {
    const response = await apiFetch<{ user: User } & AuthTokens>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, phoneNumber, attribution }),
    });

    if (response.data) {
      tokenStorage.setAccessToken(response.data.accessToken);
      tokenStorage.setRefreshToken(response.data.refreshToken);
      tokenStorage.setUser(response.data.user);
      notifyAuthChange(response.data.user);
    }

    return response;
  },

  signIn: async (email: string, password: string): Promise<ApiResponse<{ user: User } & AuthTokens>> => {
    const response = await apiFetch<{ user: User } & AuthTokens>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.data) {
      tokenStorage.setAccessToken(response.data.accessToken);
      tokenStorage.setRefreshToken(response.data.refreshToken);
      tokenStorage.setUser(response.data.user);
      notifyAuthChange(response.data.user);
    }

    return response;
  },

  signOut: async (): Promise<void> => {
    const refreshToken = tokenStorage.getRefreshToken();
    await apiFetch('/api/auth/signout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    tokenStorage.clear();
    notifyAuthChange(null);
  },

  getUser: async (): Promise<ApiResponse<User & { subscription: any }>> => {
    return apiFetch('/api/auth/me');
  },

  forgotPassword: async (email: string): Promise<ApiResponse<{ message: string }>> => {
    return apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token: string, password: string): Promise<ApiResponse<{ message: string }>> => {
    return apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  deleteAccount: async (confirmEmail: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiFetch<{ message: string }>('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirmEmail }),
    });

    if (response.data) {
      tokenStorage.clear();
      notifyAuthChange(null);
    }

    return response;
  },

  updateProfile: async (fullName: string): Promise<ApiResponse<{ message: string; user: User }>> => {
    const response = await apiFetch<{ message: string; user: User }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ fullName }),
    });

    if (response.data?.user) {
      const currentUser = tokenStorage.getUser();
      if (currentUser) {
        const updatedUser = { ...currentUser, fullName: response.data.user.fullName };
        tokenStorage.setUser(updatedUser);
        notifyAuthChange(updatedUser);
      }
    }

    return response;
  },

  getCurrentUser: (): User | null => tokenStorage.getUser(),
  getSession: () => tokenStorage.getAccessToken() ? { access_token: tokenStorage.getAccessToken() } : null,
};

// ============ LEADS API ============
export const leads = {
  list: async (params?: { status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch(`/api/leads${query ? `?${query}` : ''}`);
  },

  get: async (id: string) => apiFetch(`/api/leads/${id}`),

  create: async (propertyId: string, propertyData: any, notes?: string) => {
    return apiFetch('/api/leads', {
      method: 'POST',
      body: JSON.stringify({ propertyId, propertyData, notes }),
    });
  },

  update: async (id: string, data: { notes?: string; status?: string }) => {
    return apiFetch(`/api/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return apiFetch(`/api/leads/${id}`, { method: 'DELETE' });
  },

  addContact: async (leadId: string, contact: { contactType: string; contactValue: string }) => {
    return apiFetch(`/api/leads/${leadId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },

  addScoring: async (leadId: string, scoring: any) => {
    return apiFetch(`/api/leads/${leadId}/scoring`, {
      method: 'POST',
      body: JSON.stringify(scoring),
    });
  },

  export: async (leadIds?: string[]) => {
    return apiFetch('/api/leads/export', {
      method: 'POST',
      body: JSON.stringify({ leadIds, allLeads: !leadIds }),
    });
  },
};

// ============ FAVORITES API ============
export const favorites = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch(`/api/favorites${query ? `?${query}` : ''}`);
  },

  check: async (propertyId: string) => {
    return apiFetch(`/api/favorites/check/${propertyId}`);
  },

  add: async (propertyId: string, propertyData: any) => {
    return apiFetch('/api/favorites', {
      method: 'POST',
      body: JSON.stringify({ propertyId, propertyData }),
    });
  },

  remove: async (id: string) => {
    return apiFetch(`/api/favorites/${id}`, { method: 'DELETE' });
  },

  removeByPropertyId: async (propertyId: string) => {
    return apiFetch(`/api/favorites/property/${propertyId}`, { method: 'DELETE' });
  },
};

// ============ ALERTS API ============
export const alerts = {
  list: async (params?: { active?: boolean }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch(`/api/alerts${query ? `?${query}` : ''}`);
  },

  get: async (id: string) => apiFetch(`/api/alerts/${id}`),

  getMatches: async (id: string) => apiFetch(`/api/alerts/${id}/matches`),

  create: async (alert: {
    location: string;
    propertyTypes?: string[];
    minBedrooms?: number;
    maxBedrooms?: number;
    minBathrooms?: number;
    maxBathrooms?: number;
    maxPrice?: number;
    minSqft?: number;
    maxSqft?: number;
    alertFrequency?: string;
    phoneNumber?: string;
    minSpread?: number;
  }) => {
    return apiFetch('/api/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  },

  update: async (id: string, data: any) => {
    return apiFetch(`/api/alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggle: async (id: string) => {
    return apiFetch(`/api/alerts/${id}/toggle`, { method: 'PATCH' });
  },

  delete: async (id: string) => {
    return apiFetch(`/api/alerts/${id}`, { method: 'DELETE' });
  },

  getAllMatches: async () => apiFetch('/api/alerts/matches/all'),
};

// ============ STRIPE API ============
export const stripe = {
  createCheckout: async (priceId: string, guestCheckout?: boolean) => {
    return apiFetch('/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId, guestCheckout }),
    });
  },

  createPortal: async () => {
    return apiFetch('/api/stripe/portal', { method: 'POST' });
  },

  getSubscription: async () => {
    return apiFetch('/api/stripe/subscription');
  },

  /** Self-diagnostic — returns the full tier resolution chain for the current
   *  user (subscribers row + Stripe subscriptions + resolved tier). Use when a
   *  paying customer reports they don't have Elite/Pro access. */
  debugTier: async () => {
    return apiFetch('/api/stripe/debug/tier');
  },
};

// ============ SUBSCRIPTION API ============
export const subscription = {
  getStatus: async () => apiFetch('/api/stripe/subscription'),
};

// ============ EVENTS API (activation telemetry) ============
//
// The frontend's primary search flow (zillowAPI.searchProperties) bypasses
// the express API entirely — it talks directly to the /zillow standalone
// proxy. As a result, none of the server-side logEvent() calls fired for
// real user activity, and the user_events table sat near-empty (~13 rows
// ever before this endpoint shipped).
//
// `events.log()` POSTs to /api/events so the frontend can explicitly log
// activation events (property_search, property_viewed, first_search, etc.)
// to the same vocabulary that founder-hot-list and other backend
// telemetry consume. Fire-and-forget — never surfaces errors to the user.
export const events = {
  log: (type: string, properties?: Record<string, unknown>) => {
    // No await — intentional. Telemetry must never block a UI action.
    apiFetch('/api/events', {
      method: 'POST',
      body: JSON.stringify({ type, properties }),
    }).catch(() => {
      /* swallow — the table is best-effort, not transactional */
    });
  },
};

// ============ AI API ============
export const ai = {
  propertyAnalysis: async (property: any, userMessage?: string, conversationHistory?: any[]) => {
    return apiFetch('/api/ai/property-analysis', {
      method: 'POST',
      body: JSON.stringify({ property, userMessage, conversationHistory }),
    });
  },

  leadScoring: async (property: any, leadId?: string) => {
    return apiFetch('/api/ai/lead-scoring', {
      method: 'POST',
      body: JSON.stringify({ property, leadId }),
    });
  },

  listingDescription: async (
    params: {
      property: Record<string, unknown>;
      tone?: 'wholesaler' | 'flipper' | 'rental' | 'agent';
    },
    opts?: { signal?: AbortSignal }
  ): Promise<ApiResponse<{
    headline: string;
    description: string;
    bullets: string[];
    tone: string;
    model: string;
  }>> => {
    return apiFetch('/api/ai/listing-description', {
      method: 'POST',
      body: JSON.stringify(params),
      signal: opts?.signal,
    });
  },

  rankComps: async (
    params: {
      zpid?: string;
      address?: string;
      subject: {
        sqft?: number;
        beds?: number;
        baths?: number;
        yearBuilt?: number;
        lotSize?: number;
        propertyType?: string;
        price?: number;
      };
    },
    opts?: { signal?: AbortSignal }
  ): Promise<ApiResponse<RankCompsResponse>> => {
    return apiFetch('/api/ai/rank-comps', {
      method: 'POST',
      body: JSON.stringify(params),
      signal: opts?.signal,
    });
  },

  wholesaleAnalyzer: async (data: {
    market?: string;
    csv_data?: any[];
    analysis_params?: any;
    property?: any;
    repairEstimate?: number;
    arv?: number;
  }) => {
    return apiFetch('/api/ai/wholesale-analyzer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  damageDetection: async (data: {
    photo_url?: string;
    photos?: string[];
    room_type?: string;
    zpid?: string;
    propertyData?: any;
  }) => {
    return apiFetch('/api/ai/damage-detection', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  dealAnalysis: async (propertyUrl: string) => {
    return apiFetch('/api/ai/deal-analysis', {
      method: 'POST',
      body: JSON.stringify({ property_url: propertyUrl }),
    });
  },

  rankDeals: async (properties: any[]) => {
    return apiFetch<{
      ranked_deals: Array<{
        id: string;
        ai_score: number;
        label: 'strong_buy' | 'solid' | 'caution' | 'avoid';
        rationale: string;
        red_flags: string[];
        motivated_signals: string[];
      }>;
      candidates_evaluated: number;
      model: string;
    }>('/api/ai/rank-deals', {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });
  },

  advancedPropertyAssessment: async (data: {
    property: any;
    arv?: number;
    acquisition_costs?: number;
    wholesale_fee?: number;
    analysisOptions?: {
      includePhotos?: boolean;
      includeMarketAnalysis?: boolean;
      includeInvestmentMetrics?: boolean;
      includeRiskAssessment?: boolean;
    };
  }) => {
    return apiFetch('/api/ai/advanced-property-assessment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  chat: async (message: string, context?: any, conversationHistory?: any[]) => {
    return apiFetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context, conversationHistory }),
    });
  },

  photoAnalysis: async (property: any, imageUrls: string[]) => {
    return apiFetch('/api/ai/photo-analysis', {
      method: 'POST',
      body: JSON.stringify({ property, imageUrls }),
    });
  },
};

// ============ PROPERTY API ============
export const property = {
  search: async (params: {
    location: string;
    page?: number;
    status?: string;
    bedrooms?: number;
    bathrooms?: number;
    minPrice?: number;
    maxPrice?: number;
    propertyType?: string;
    fsbo?: boolean;
  }) => {
    return apiFetch('/api/property/zillow/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getDetails: async (zpid?: string, address?: string) => {
    return apiFetch('/api/property/zillow/details', {
      method: 'POST',
      body: JSON.stringify({ zpid, address }),
    });
  },

  getIntelligence: async (propertyId?: string, zpid?: string, address?: string) => {
    return apiFetch('/api/property/intelligence', {
      method: 'POST',
      body: JSON.stringify({ propertyId, zpid, address }),
    });
  },

  skipTrace: async (data: {
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    state?: string;
  }) => {
    return apiFetch('/api/property/skip-trace', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  offMarket: async (location: string, radius?: number, filters?: any) => {
    return apiFetch('/api/property/off-market', {
      method: 'POST',
      body: JSON.stringify({ location, radius, filters }),
    });
  },

  getComps: async (zpid?: string, address?: string) => {
    return apiFetch('/api/property/comps', {
      method: 'POST',
      body: JSON.stringify({ zpid, address }),
    });
  },

  getPhotos: async (zpid?: string, address?: string) => {
    return apiFetch('/api/property/photos', {
      method: 'POST',
      body: JSON.stringify({ zpid, address }),
    });
  },

  getByZpid: async (zpid: string) => {
    return apiFetch<{ property: Property }>(
      `/api/property/by-zpid?zpid=${encodeURIComponent(zpid)}`,
      { method: 'GET' }
    );
  },
};

// ============ COMMUNICATIONS API ============
export const communications = {
  sendEmail: async (to: string, subject: string, html: string) => {
    return apiFetch('/api/communications/email/send', {
      method: 'POST',
      body: JSON.stringify({ to, subject, html }),
    });
  },

  sendSms: async (to: string, message: string) => {
    return apiFetch('/api/communications/sms/send', {
      method: 'POST',
      body: JSON.stringify({ to, message }),
    });
  },

  makeCall: async (to: string) => {
    return apiFetch('/api/communications/call/make', {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
  },

  logCampaign: async (leadId: string, campaignType: string, messageContent?: string) => {
    return apiFetch('/api/communications/campaign', {
      method: 'POST',
      body: JSON.stringify({ leadId, campaignType, messageContent }),
    });
  },

  sendSpreadAlert: async (deals: any[], location: string, phone: string) => {
    return apiFetch('/api/communications/spread-alert', {
      method: 'POST',
      body: JSON.stringify({ deals, location, phone }),
    });
  },
};

// ============ BUYERS API ============
export const buyers = {
  list: async (params?: { search?: string; tags?: string; location?: string; limit?: number; offset?: number }) => {
    const query = params ? new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return apiFetch(`/api/buyers${query ? `?${query}` : ''}`);
  },

  get: async (id: string) => apiFetch(`/api/buyers/${id}`),

  create: async (buyer: {
    firstName: string;
    lastName: string;
    company?: string;
    email?: string;
    phone?: string;
    criteria: any;
    tags?: string[];
    notes?: string;
  }) => {
    return apiFetch('/api/buyers', {
      method: 'POST',
      body: JSON.stringify(buyer),
    });
  },

  update: async (id: string, data: any) => {
    return apiFetch(`/api/buyers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return apiFetch(`/api/buyers/${id}`, { method: 'DELETE' });
  },

  match: async (propertyData: any) => {
    return apiFetch('/api/buyers/match', {
      method: 'POST',
      body: JSON.stringify({ property: propertyData }),
    });
  },

  import: async (buyerRows: any[]) => {
    return apiFetch('/api/buyers/import', {
      method: 'POST',
      body: JSON.stringify({ buyers: buyerRows }),
    });
  },

  outreach: async (buyerId: string, dealData: any, channels: ('email' | 'sms')[]) => {
    return apiFetch(`/api/buyers/${buyerId}/outreach`, {
      method: 'POST',
      body: JSON.stringify({ deal: dealData, channels }),
    });
  },
};

// ============ SEQUENCES API ============
export const sequences = {
  listTemplates: async () => apiFetch('/api/sequences/templates'),

  getTemplate: async (id: string) => apiFetch(`/api/sequences/templates/${id}`),

  createTemplate: async (data: { name: string; description?: string; category: string; steps: any[] }) => {
    return apiFetch('/api/sequences/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteTemplate: async (id: string) => {
    return apiFetch(`/api/sequences/templates/${id}`, { method: 'DELETE' });
  },

  assign: async (leadId: string, templateId: string, variables: Record<string, string>) => {
    return apiFetch('/api/sequences/assign', {
      method: 'POST',
      body: JSON.stringify({ leadId, templateId, variables }),
    });
  },

  listActive: async () => apiFetch('/api/sequences/active'),

  getLeadSequences: async (leadId: string) => apiFetch(`/api/sequences/lead/${leadId}`),

  pause: async (id: string) => {
    return apiFetch(`/api/sequences/${id}/pause`, { method: 'PATCH' });
  },

  resume: async (id: string) => {
    return apiFetch(`/api/sequences/${id}/resume`, { method: 'PATCH' });
  },

  cancel: async (id: string) => {
    return apiFetch(`/api/sequences/${id}/cancel`, { method: 'PATCH' });
  },
};

// ============ CONTRACTS API ============
export const contracts = {
  list: async () => apiFetch('/api/contracts'),

  get: async (id: string) => apiFetch(`/api/contracts/${id}`),

  generate: async (data: any) => {
    return apiFetch('/api/contracts/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getForLead: async (leadId: string) => apiFetch(`/api/contracts/lead/${leadId}`),

  delete: async (id: string) => {
    return apiFetch(`/api/contracts/${id}`, { method: 'DELETE' });
  },
};

// ============ CONTACT API ============
export const contact = {
  submit: async (data: { name: string; email: string; subject: string; message: string }): Promise<ApiResponse<{ message: string }>> => {
    return apiFetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============ AI: RANK COMPS ============
export interface RankCompsComp {
  i?: number;
  address: string;
  city?: string;
  zip?: string;
  price?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  yearBuilt?: number;
  lotSize?: number;
  propertyType?: string;
  saleDate?: string;
  daysOnZillow?: number;
  distance?: number;
  pricePerSqft?: number;
  zpid?: string;
}

export interface RankCompsAdjustment {
  factor: string;
  direction: 'up' | 'down';
  amount_estimate: number;
  reason: string;
}

export interface RankCompsEntry {
  comp_index: number;
  score: number;
  reasoning: string;
  adjustments: RankCompsAdjustment[];
  comp: RankCompsComp;
}

export interface RankCompsResponse {
  ranked: RankCompsEntry[];
  overall_confidence: 'high' | 'medium' | 'low';
  confidence_reasoning: string;
  implied_arv: number | null;
  implied_as_is_value: number | null;
  candidates_evaluated: number;
  model: string;
}

// ============ WEBHOOKS API ============
export type WebhookEventType = 'property_alert_match' | 'price_change' | 'status_change' | 'owner_update';

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEventType[];
  description: string | null;
  active: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
  secret?: string;        // only present on create response
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  attempt: number;
  response_status: number | null;
  duration_ms: number | null;
  status: 'pending' | 'success' | 'failed' | 'abandoned';
  delivered_at: string;
  response_body_truncated: string | null;
}

export const webhooks = {
  list: async () =>
    apiFetch<{ endpoints: WebhookEndpoint[]; knownEvents: WebhookEventType[]; limit: number | null }>(
      '/api/webhooks'
    ),
  create: async (params: { url: string; events: WebhookEventType[]; description?: string }) =>
    apiFetch<{ endpoint: WebhookEndpoint; note: string }>('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  update: async (id: string, params: { events?: WebhookEventType[]; active?: boolean; description?: string }) =>
    apiFetch<{ endpoint: WebhookEndpoint }>(`/api/webhooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    }),
  remove: async (id: string) =>
    apiFetch<{ deleted: string }>(`/api/webhooks/${id}`, { method: 'DELETE' }),
  test: async (id: string) =>
    apiFetch<{ ok: boolean; status: number; durationMs: number; message: string }>(
      `/api/webhooks/${id}/test`, { method: 'POST' }
    ),
  deliveries: async (id: string) =>
    apiFetch<{ deliveries: WebhookDelivery[] }>(`/api/webhooks/${id}/deliveries`),
};

// ============ SKIP TRACE API ============
export type SkipTraceSearchType = 'byname' | 'byaddress' | 'bynameaddress' | 'byphone' | 'byemail';

export interface SkipTraceSearchParams {
  searchType: SkipTraceSearchType;
  name?: string;
  street?: string;
  citystatezip?: string;
  phoneno?: string;
  email?: string;
  phone?: string;
  page?: string;
}

export interface SkipTraceSearchResponse {
  searchType: SkipTraceSearchType;
  params: Record<string, string>;
  result: unknown;
  resultCount: number;
  peoIds: string[];
  servedFromCache: boolean;
}

export interface SkipTraceQuota {
  tier: string;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  gated: boolean;
}

export const skipTrace = {
  search: async (params: SkipTraceSearchParams): Promise<ApiResponse<SkipTraceSearchResponse>> => {
    return apiFetch('/api/skip-trace/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  details: async (peoId: string) =>
    apiFetch<{ peoId: string; details: unknown; servedFromCache: boolean; fetchedAt: string }>(
      `/api/skip-trace/details/${encodeURIComponent(peoId)}`
    ),

  history: async (limit = 20) =>
    apiFetch<{ history: Array<Record<string, unknown>> }>(`/api/skip-trace/history?limit=${limit}`),

  quota: async (): Promise<ApiResponse<SkipTraceQuota>> => apiFetch('/api/skip-trace/quota'),
};

// ============ UTILITY API ============
export const utility = {
  geocode: async (address: string) => {
    return apiFetch('/api/geocoding', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  },

  generatePdf: async (type: 'property-report' | 'lead-export' | 'deal-analysis' | 'contract', data: any) => {
    return apiFetch('/api/pdf/generate', {
      method: 'POST',
      body: JSON.stringify({ type, data }),
    });
  },
};

// PropData proxy — all calls go through our backend so the RapidAPI key stays
// server-side and we get per-user rate limit + 1h LRU cache for free.
function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const propdata = {
  health: () => apiFetch('/api/propdata/health'),
  stats: () => apiFetch('/api/propdata/stats'),
  neighborhood: (zip: string) => apiFetch<any>(`/api/propdata/neighborhood${buildQuery({ zip })}`),
  market: (p: { zip?: string; state?: string; metro?: string; months?: string | number }) =>
    apiFetch<any>(`/api/propdata/market${buildQuery(p)}`),
  listing: (zip: string) => apiFetch<any>(`/api/propdata/listing${buildQuery({ zip })}`),
  rent: (p: { zip?: string; state?: string; beds?: string | number }) =>
    apiFetch<any>(`/api/propdata/rent${buildQuery(p)}`),
  estimate: (p: { zip?: string; state?: string; beds?: string | number }) =>
    apiFetch<any>(`/api/propdata/estimate${buildQuery(p)}`),
  comps: (p: { zip?: string; address?: string; limit?: number; radius?: number }) =>
    apiFetch<any>(`/api/propdata/comps${buildQuery(p)}`),
  geocode: (address: string) => apiFetch<any>(`/api/propdata/geocode${buildQuery({ address })}`),
  property: (p: {
    zip?: string;
    address?: string;
    apn?: string;
    owner?: string;
    absentee_only?: boolean;
    limit?: number;
  }) => apiFetch<any>(`/api/propdata/property${buildQuery(p)}`),
  propertyDelta: (p: { since: string; zip?: string; cursor?: string; limit?: number }) =>
    apiFetch<any>(`/api/propdata/property/delta${buildQuery(p)}`),
  preforeclosureDelta: (p: { since: string; zip?: string; cursor?: string; limit?: number }) =>
    apiFetch<any>(`/api/propdata/preforeclosure/delta${buildQuery(p)}`),
  // Interactive on-demand wrapper around /preforeclosure/delta. Backend defaults
  // `since` to 30 days ago; no cursor (UI calls aren't polling). Used by
  // off-market-search-v2 when Pre-Foreclosure or Auctions lead types are picked.
  preforeclosure: (p: { zip: string; limit?: number }) =>
    apiFetch<any>(`/api/propdata/preforeclosure${buildQuery(p)}`),
  // Zillow autocomplete via the shared RapidAPI key — also backend-proxied.
  zillowAutocomplete: (query: string) =>
    apiFetch<any>(`/api/propdata/zillow-autocomplete${buildQuery({ query })}`),
};

// Default export for convenience
const apiClient = {
  auth,
  leads,
  favorites,
  alerts,
  stripe,
  subscription,
  ai,
  property,
  communications,
  buyers,
  sequences,
  contracts,
  contact,
  skipTrace,
  webhooks,
  utility,
  propdata,
  onAuthStateChange,
};

export default apiClient;
