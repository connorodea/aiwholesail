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
      
      const data = await zillowAPI.getSkipTrace(streetAddress, cityStateZip);
      
      if (data) {
        const result: SkipTraceResult = {
          address: streetAddress,
          location: cityStateZip,
          ...data
        };
        
        setResults(prev => {
          const filtered = prev.filter(r => r.address !== streetAddress);
          return [result, ...filtered];
        });
        
        toast.success('Skip trace completed successfully');
        return result;
      } else {
        toast.warning('No skip trace data found for this property');
        return null;
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