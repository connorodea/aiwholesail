import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced error handling and resilience
class APIError extends Error {
  constructor(
    public service: string,
    public statusCode: number,
    public originalError: any,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class RetryableAPIClient {
  private maxRetries = 3;
  private baseDelay = 1000;

  async callWithRetry<T>(
    apiCall: () => Promise<T>,
    serviceName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1}/${this.maxRetries + 1} failed for ${serviceName}:`, error.message);
        
        if (attempt === this.maxRetries) break;
        
        // Exponential backoff
        const delay = this.baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new APIError(serviceName, 0, lastError, 
      `Failed after ${this.maxRetries + 1} attempts`);
  }
}

// Enhanced caching layer for cost optimization
class CacheManager {
  private cache = new Map<string, { data: any; expires: number }>();
  
  // Skip trace cache (30 days - contact info doesn't change often)
  private SKIP_TRACE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.SKIP_TRACE_CACHE_TTL
  ): Promise<{ data: T; cached: boolean }> {
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return { data: cached.data, cached: true };
    }
    
    const data = await fetcher();
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    });
    
    return { data, cached: false };
  }
}

// Enhanced validation and sanitization
class DataValidator {
  static validateAddress(address: string): boolean {
    // Basic address validation
    const addressRegex = /^\d+\s+[A-Za-z0-9\s,.-]+$/;
    return addressRegex.test(address.trim());
  }
  
  static sanitizePhoneNumber(phone: string): string {
    // Remove all non-digit characters and format
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    return phone; // Return original if can't sanitize
  }
  
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Multi-provider skip trace with fallbacks
class RobustSkipTraceService {
  private cache: CacheManager;
  private apiClient: RetryableAPIClient;
  private rapidApiKey: string;

  constructor() {
    this.cache = new CacheManager();
    this.apiClient = new RetryableAPIClient();
    this.rapidApiKey = Deno.env.get('RAPIDAPI_KEY') || '';
  }

  // Primary API: Skip Tracing Working API
  private async skipTraceWorkingAPI(address: string): Promise<any> {
    if (!this.rapidApiKey) {
      throw new Error('RAPIDAPI_KEY not configured');
    }

    const url = `https://skip-tracing-working-api.p.rapidapi.com/search`;
    const searchParams = new URLSearchParams({
      address: address,
      format: 'detailed'
    });

    const response = await fetch(`${url}?${searchParams}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': this.rapidApiKey,
        'X-RapidAPI-Host': 'skip-tracing-working-api.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Skip Tracing Working API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      address: address,
      phones: data.phones || data.phoneNumbers || [],
      names: data.names || data.residents || [],
      emails: data.emails || data.emailAddresses || [],
      currentAddress: data.currentAddress || data.mailingAddress,
      age: data.age || data.estimatedAge,
      relatives: data.relatives || [],
      previousAddresses: data.previousAddresses || data.addressHistory || [],
      associates: data.associates || [],
      source: 'Skip Tracing Working API',
      timestamp: new Date().toISOString(),
      costPerQuery: 0.05,
      confidence: data.confidence || 'medium'
    };
  }

  // Fallback API: People Data Labs (example)
  private async peopleDataLabsAPI(address: string): Promise<any> {
    // This would be implemented if we had People Data Labs API access
    console.log('People Data Labs API fallback not implemented yet');
    throw new Error('People Data Labs API not available');
  }

  // Fallback API: TruePeopleSearch (web scraping fallback)
  private async truePeopleSearchFallback(address: string): Promise<any> {
    console.log('TruePeopleSearch fallback not implemented yet');
    throw new Error('TruePeopleSearch fallback not available');
  }

  // Main skip trace method with multiple providers and fallbacks
  async performSkipTrace(address: string): Promise<any> {
    const cacheKey = `skip-trace:${address.toLowerCase().trim()}`;
    
    const result = await this.cache.getOrSet(
      cacheKey,
      async () => {
        // Try primary API first
        try {
          console.log(`Attempting skip trace with primary API for: ${address}`);
          const result = await this.apiClient.callWithRetry(
            () => this.skipTraceWorkingAPI(address),
            'SkipTracingWorkingAPI'
          );
          
          // Sanitize phone numbers
          if (result.phones) {
            result.phones = result.phones.map((phone: string) => 
              DataValidator.sanitizePhoneNumber(phone)
            );
          }
          
          // Validate emails
          if (result.emails) {
            result.emails = result.emails.filter((email: string) => 
              DataValidator.validateEmail(email)
            );
          }
          
          return result;
        } catch (primaryError) {
          console.warn('Primary skip trace API failed, trying fallbacks:', primaryError.message);
          
          // Try fallback APIs
          const fallbackAPIs = [
            () => this.peopleDataLabsAPI(address),
            () => this.truePeopleSearchFallback(address)
          ];
          
          for (const fallbackAPI of fallbackAPIs) {
            try {
              console.log('Trying fallback API...');
              return await this.apiClient.callWithRetry(fallbackAPI, 'FallbackAPI');
            } catch (fallbackError) {
              console.warn('Fallback API failed:', fallbackError.message);
              continue;
            }
          }
          
          // If all APIs fail, return helpful guidance
          return {
            address: address,
            phones: [],
            names: [],
            emails: [],
            fallbackMessage: 'Automated skip trace services temporarily unavailable. Here are manual research methods:',
            searchSuggestions: [
              'Visit your county\'s property record website',
              'Search the property address on social media platforms',
              'Check voter registration databases',
              'Use LinkedIn to find property owners',
              'Contact neighbors for information',
              'Check with the local post office for forwarding addresses',
              'Search property tax records for owner information',
              'Use professional skip trace services like BeenVerified or Spokeo',
              'Check local business listings if it\'s a commercial property'
            ],
            manualResearchTips: [
              'Look for the owner\'s name in property tax records',
              'Check if the property is owned by a trust or LLC',
              'Search for the owner on professional networks',
              'Check court records for the property address',
              'Search obituaries for previous owners (inheritance cases)',
              'Check social media for family members who might know current contact info'
            ],
            source: 'Fallback Guidance System',
            timestamp: new Date().toISOString(),
            costPerQuery: 0,
            confidence: 'manual_research_required'
          };
        }
      }
    );

    return {
      success: true,
      data: result.data,
      cached: result.cached,
      provider: result.data.source || 'Unknown',
      cost: result.data.costPerQuery || 0
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, name } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Address is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate address format
    if (!DataValidator.validateAddress(address)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid address format. Please provide a valid street address.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Starting robust skip trace for: ${address}`);
    
    const skipTraceService = new RobustSkipTraceService();
    const result = await skipTraceService.performSkipTrace(address);
    
    console.log(`Skip trace completed successfully for: ${address}, cached: ${result.cached}, provider: ${result.provider}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in robust-skip-trace function:', error);
    
    const sanitizedError = error instanceof Error && error.message.includes('API') 
      ? 'External service temporarily unavailable' 
      : error.message || 'Failed to perform skip trace';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: sanitizedError,
        fallbackGuidance: {
          message: 'Try manual research methods while we restore service',
          suggestions: [
            'Check county property records online',
            'Search social media for the property address',
            'Contact local real estate agents in the area'
          ]
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});