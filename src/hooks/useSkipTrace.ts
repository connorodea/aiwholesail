import { useState } from 'react';
import { zillowAPI } from '@/lib/zillow-api';
import { Property } from '@/types/zillow';
import { toast } from 'sonner';

export interface SkipTraceResult {
  address: string;
  location: string;
  phones?: string[];
  names?: string[];
  emails?: string[];
  currentAddress?: string;
  age?: number;
  fallbackMessage?: string;
  searchSuggestions?: string[];
  manualResearchTips?: string[];
  [key: string]: any;
}

export function useSkipTrace() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SkipTraceResult[]>([]);

  const skipTrace = async (property: Property): Promise<SkipTraceResult | null> => {
    setLoading(true);
    try {
      // Extract address and location from property
      const addressParts = property.address.split(',');
      const streetAddress = addressParts[0]?.trim() || '';
      const cityStateZip = addressParts.slice(1).join(',').trim() || '';

      if (!streetAddress || !cityStateZip) {
        toast.error('Unable to parse property address for skip tracing');
        return null;
      }

      console.log('Skip tracing:', { streetAddress, cityStateZip });
      
      try {
        const data = await zillowAPI.getSkipTrace(streetAddress, cityStateZip);
        
        if (data && data.success !== false) {
          const result: SkipTraceResult = {
            address: streetAddress,
            location: cityStateZip,
            phones: data.phones || [],
            names: data.names || [],
            emails: data.emails || [],
            currentAddress: data.currentAddress,
            age: data.age,
            relatives: data.relatives || [],
            previousAddresses: data.previousAddresses || [],
            associates: data.associates || [],
            source: data.source,
            timestamp: data.timestamp,
            costPerQuery: data.costPerQuery || 0,
            confidence: data.confidence
          };
          
          setResults(prev => {
            const filtered = prev.filter(r => r.address !== streetAddress);
            return [result, ...filtered];
          });
          
          toast.success('Skip trace completed successfully');
          return result;
        } else {
          // API returned but no data - provide helpful fallback
          const fallbackResult: SkipTraceResult = {
            address: streetAddress,
            location: cityStateZip,
            names: [],
            phones: [],
            emails: [],
            fallbackMessage: 'Skip trace data not available through automatic lookup. Consider manual research methods.',
            searchSuggestions: [
              'Check public property records',
              'Search social media platforms',
              'Contact listing agent if available',
              'Use professional skip trace services',
              'Check voter registration records'
            ]
          };
          
          setResults(prev => {
            const filtered = prev.filter(r => r.address !== streetAddress);
            return [fallbackResult, ...filtered];
          });
          
          toast.warning('No skip trace data found - showing manual research suggestions');
          return fallbackResult;
        }
      } catch (apiError) {
        console.warn('Skip trace API failed, providing fallback guidance:', apiError);
        
        // Provide helpful fallback information when API fails
        const fallbackResult: SkipTraceResult = {
          address: streetAddress,
          location: cityStateZip,
          names: [],
          phones: [],
          emails: [],
          fallbackMessage: 'Skip trace service temporarily unavailable. Here are alternative research methods:',
          searchSuggestions: [
            'Visit your county\'s property record website',
            'Search the property address on social media',
            'Check voter registration databases',
            'Use LinkedIn to find property owners',
            'Contact neighbors for information',
            'Check with the local post office',
            'Search property tax records',
            'Use professional skip trace services like BeenVerified or Spokeo'
          ],
          manualResearchTips: [
            'Look for the owner\'s name in property tax records',
            'Check if the property is in a trust or LLC',
            'Search for the owner on professional networks',
            'Check local business listings if it\'s a commercial property'
          ]
        };
        
        setResults(prev => {
          const filtered = prev.filter(r => r.address !== streetAddress);
          return [fallbackResult, ...filtered];
        });
        
        toast.warning('Skip trace service unavailable - showing manual research methods');
        return fallbackResult;
      }
    } catch (error) {
      console.error('Skip trace failed:', error);
      toast.error('Skip trace failed. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const exportResults = (result: SkipTraceResult) => {
    const csvHeaders = ['Address', 'Location', 'Phone Numbers', 'Names', 'Emails', 'Current Address', 'Age'];
    const csvRow = [
      result.address,
      result.location,
      result.phones?.join('; ') || 'N/A',
      result.names?.join('; ') || 'N/A',
      result.emails?.join('; ') || 'N/A',
      result.currentAddress || 'N/A',
      result.age || 'N/A'
    ];

    const csvContent = [csvHeaders.join(','), csvRow.map(field => `"${field}"`).join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `skip_trace_${result.address.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Skip trace results exported');
  };

  return {
    skipTrace,
    loading,
    results,
    clearResults,
    exportResults
  };
}