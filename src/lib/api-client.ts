/**
 * AIWholesail API Client
 * Replaces Supabase client for self-hosted API on Hetzner
 */
import { API_BASE_URL } from './platform';

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
async function apiFetch<T>(
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
      return { error: data.error || 'Request failed', errors: data.errors };
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
  signUp: async (email: string, password: string, fullName?: string): Promise<ApiResponse<{ user: User } & AuthTokens>> => {
    const response = await apiFetch<{ user: User } & AuthTokens>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
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
    maxPrice?: number;
    alertFrequency?: string;
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
};

// ============ UTILITY API ============
export const utility = {
  geocode: async (address: string) => {
    return apiFetch('/api/geocoding', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  },

  generatePdf: async (type: 'property-report' | 'lead-export' | 'deal-analysis', data: any) => {
    return apiFetch('/api/pdf/generate', {
      method: 'POST',
      body: JSON.stringify({ type, data }),
    });
  },
};

// Default export for convenience
const apiClient = {
  auth,
  leads,
  favorites,
  alerts,
  stripe,
  ai,
  property,
  communications,
  utility,
  onAuthStateChange,
};

export default apiClient;
