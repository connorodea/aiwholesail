import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationSuggestion {
  place_name: string;
  center: [number, number];
  place_type: string[];
  context?: Array<{ id: string; text: string }>;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function LocationAutocomplete({ 
  value, 
  onChange, 
  placeholder = "e.g., New York, NY or Michigan or Los Angeles County or 90210",
  required = false 
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Check for stored API key on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('mapbox_public_token');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (!apiKey) {
      console.warn('Mapbox API key not set - location autocomplete disabled');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${apiKey}&` +
        `country=US&` +
        `types=country,region,postcode,district,place,locality,neighborhood&` +
        `limit=5`
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.features || []);
      } else {
        console.error('Geocoding API error:', response.statusText);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    onChange(suggestion.place_name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem('mapbox_public_token', key);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor="location" className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        Location
      </Label>
      
      {!apiKey && (
        <div className="space-y-2 p-3 bg-muted/50 rounded-md border">
          <Label htmlFor="mapbox-key" className="text-sm font-medium">
            Mapbox Public Token (for location autocomplete)
          </Label>
          <Input
            id="mapbox-key"
            type="text"
            placeholder="Enter your Mapbox public token"
            onChange={handleApiKeyChange}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Get your free token at{' '}
            <a 
              href="https://mapbox.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              mapbox.com
            </a>
          </p>
        </div>
      )}

      <div className="relative" ref={inputRef}>
        <div className="relative">
          <Input
            id="location"
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="bg-background/50 pr-8"
            required={required}
            onFocus={() => setShowSuggestions(true)}
          />
          {isLoading && (
            <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none border-b border-border last:border-b-0"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{suggestion.place_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Search by city (New York, NY), state (Michigan), county (Los Angeles County), or zip code (90210)
      </p>
    </div>
  );
}