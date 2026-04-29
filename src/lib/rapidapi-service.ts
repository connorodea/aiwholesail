import { property, communications, utility } from '@/lib/api-client';

export interface RapidAPIConfig {
  key: string;
  host: string;
  baseUrl: string;
}

export interface PropertyDataResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SkipTraceResponse {
  success: boolean;
  data?: {
    phones?: string[];
    names?: string[];
    emails?: string[];
    currentAddress?: string;
    age?: number;
    [key: string]: any;
  };
  error?: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface DocumentResponse {
  success: boolean;
  pdfUrl?: string;
  data?: any;
  error?: string;
}

export class RapidAPIService {
  private static instance: RapidAPIService;
  
  // API Configurations
  private readonly apis = {
    usRealEstate: {
      key: '',
      host: 'us-real-estate.p.rapidapi.com',
      baseUrl: 'https://us-real-estate.p.rapidapi.com'
    },
    skipTracing: {
      key: '',
      host: 'skip-tracing-working-api.p.rapidapi.com',
      baseUrl: 'https://skip-tracing-working-api.p.rapidapi.com'
    },
    peopleData: {
      key: '',
      host: 'people-data-lookup.p.rapidapi.com',
      baseUrl: 'https://people-data-lookup.p.rapidapi.com'
    },
    docRaptor: {
      key: '',
      host: 'docraptor.p.rapidapi.com', 
      baseUrl: 'https://docraptor.p.rapidapi.com'
    },
    plivo: {
      key: '',
      host: 'plivo.p.rapidapi.com',
      baseUrl: 'https://plivo.p.rapidapi.com'
    }
  };

  constructor() {
    // Initialize with keys from Supabase secrets if available
    this.initializeKeys();
  }

  public static getInstance(): RapidAPIService {
    if (!RapidAPIService.instance) {
      RapidAPIService.instance = new RapidAPIService();
    }
    return RapidAPIService.instance;
  }

  private async initializeKeys() {
    // Keys will be set via Supabase secrets in edge functions
  }

  private async makeRequest(api: keyof typeof this.apis, endpoint: string, params?: any): Promise<any> {
    try {
      const config = this.apis[api];
      const url = `${config.baseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': config.key,
          'X-RapidAPI-Host': config.host,
          'Content-Type': 'application/json'
        },
        ...params
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`RapidAPI ${api} request failed:`, error);
      throw error;
    }
  }

  // Enhanced Property Data via US Real Estate API
  async getEnhancedPropertyData(address: string, city: string, state: string): Promise<PropertyDataResponse> {
    try {
      const response = await property.getIntelligence(undefined, undefined, `${address}, ${city}, ${state}`);

      if (response.error) throw new Error(response.error);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Enhanced property data failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch enhanced property data'
      };
    }
  }

  // Enhanced Skip Tracing via Skip Tracing Working API
  async getEnhancedSkipTrace(address: string, name?: string): Promise<SkipTraceResponse> {
    try {
      const response = await property.skipTrace({ address, lastName: name });

      if (response.error) throw new Error(response.error);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Enhanced skip trace failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform enhanced skip trace'
      };
    }
  }

  // People Data Lookup for additional contact info
  async lookupPersonData(query: { phone?: string; email?: string; name?: string; address?: string }): Promise<any> {
    try {
      const response = await property.skipTrace(query);

      if (response.error) throw new Error(response.error);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('People data lookup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lookup person data'
      };
    }
  }

  // Document generation via DocRaptor
  async generatePDF(htmlContent: string, options?: any): Promise<DocumentResponse> {
    try {
      const response = await utility.generatePdf('property-report', { htmlContent, ...options });

      if (response.error) throw new Error(response.error);
      return { success: true, pdfUrl: (response.data as any)?.pdfUrl, data: response.data };
    } catch (error) {
      console.error('PDF generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF document'
      };
    }
  }

  // SMS via Plivo (cost-effective alternative to Twilio)
  async sendSMS(to: string, message: string, from?: string): Promise<SMSResponse> {
    try {
      const response = await communications.sendSms(to, message);

      if (response.error) throw new Error(response.error);
      return { success: true, messageId: (response.data as any)?.messageId };
    } catch (error) {
      console.error('Plivo SMS failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS via Plivo'
      };
    }
  }

  // Batch operations for cost efficiency
  async batchSkipTrace(addresses: string[]): Promise<SkipTraceResponse[]> {
    try {
      // Process addresses sequentially through the skip trace API
      const results = await Promise.all(
        addresses.map(async (address) => {
          const response = await property.skipTrace({ address });
          if (response.error) {
            return { success: false, error: response.error };
          }
          return { success: true, data: response.data };
        })
      );
      return results;
    } catch (error) {
      console.error('Batch skip trace failed:', error);
      return addresses.map(() => ({
        success: false,
        error: 'Batch operation failed'
      }));
    }
  }

  // Cost tracking and analytics
  async getCostAnalytics(startDate: string, endDate: string): Promise<any> {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://api.aiwholesail.com';
      const response = await fetch(`${API_URL}/api/analytics/cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cost analytics');
      }

      return await response.json();
    } catch (error) {
      console.error('Cost analytics failed:', error);
      return { success: false, error: 'Failed to fetch cost analytics' };
    }
  }
}

export const rapidAPIService = RapidAPIService.getInstance();