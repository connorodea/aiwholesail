import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { utility } from '@/lib/api-client';

interface LocationSuggestion {
  place_name: string;
  center: [number, number];
  place_type: string[];
  context?: Array<{ id: string; text: string }>;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, message?: string) => void;
  placeholder?: string;
  required?: boolean;
}

// List of US state names and abbreviations
const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY'
};

const STATE_ABBREVIATIONS = Object.values(US_STATES);

// Check if a value is just a state name or abbreviation
function isStateOnly(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  // Check if it's a full state name
  if (US_STATES[trimmed]) return true;
  // Check if it's a state abbreviation (2 letters, no other content)
  if (trimmed.length === 2 && STATE_ABBREVIATIONS.includes(trimmed.toUpperCase())) return true;
  return false;
}

// Check if it's a county search without a state
function isCountyWithoutState(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  // Check if it contains "county" but no state identifier
  if (!trimmed.includes('county')) return false;

  // Check if it has a comma (indicating state might be included)
  const parts = trimmed.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // Check if second part is a state
    const possibleState = parts[1].toLowerCase();
    if (US_STATES[possibleState] || STATE_ABBREVIATIONS.includes(possibleState.toUpperCase())) {
      return false; // Has a valid state
    }
    // Check if it ends with "united states" or similar
    if (possibleState === 'united states' || possibleState === 'usa' || possibleState === 'us') {
      // Check if there's a state before that
      if (parts.length >= 3) {
        const stateCheck = parts[1].toLowerCase();
        if (US_STATES[stateCheck] || STATE_ABBREVIATIONS.includes(stateCheck.toUpperCase())) {
          return false;
        }
      }
    }
  }

  // No valid state found with county
  return true;
}

// Validation result type
interface LocationValidation {
  isValid: boolean;
  warning: 'state-only' | 'county-no-state' | null;
  message?: string;
}

function validateLocation(value: string): LocationValidation {
  if (isStateOnly(value)) {
    return {
      isValid: false,
      warning: 'state-only',
      message: 'State-wide searches are not supported. Please enter a city, ZIP code, or county with state.'
    };
  }
  if (isCountyWithoutState(value)) {
    return {
      isValid: false,
      warning: 'county-no-state',
      message: 'Please include a state with county searches (e.g., "Oakland County, MI").'
    };
  }
  return { isValid: true, warning: null };
}

export function LocationAutocomplete({
  value,
  onChange,
  onValidationChange,
  placeholder = "e.g., Charlotte, NC or Oakland County, MI or 90210",
  required = false
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validationState, setValidationState] = useState<LocationValidation>({ isValid: true, warning: null });
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Check for invalid input patterns
  useEffect(() => {
    const validation = validateLocation(value);
    setValidationState(validation);
    if (onValidationChange) {
      onValidationChange(validation.isValid, validation.message);
    }
  }, [value, onValidationChange]);

  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await utility.geocode(query);

      if (response.error) {
        console.error('Geocoding error:', response.error);
        setSuggestions([]);
        return;
      }

      setSuggestions((response.data as any)?.features || []);
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
    // For state-level searches, warn the user that this won't work
    if (suggestion.place_type.includes('region')) {
      // Don't allow selecting just a state - show the full name to indicate it's a state
      onChange(suggestion.place_name);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // For counties, extract state from context if available
    if (suggestion.place_type.includes('district') || suggestion.place_name.toLowerCase().includes('county')) {
      // The place_name should already include state from Mapbox
      // Format: "Oakland County, Michigan, United States"
      // Extract just "Oakland County, Michigan" or "Oakland County, MI"
      const parts = suggestion.place_name.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        // Find the state part (should be second element, before "United States")
        let countyWithState = parts[0];
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].toLowerCase();
          if (part === 'united states' || part === 'usa') break;
          // Check if this is a state name
          if (US_STATES[part] || STATE_ABBREVIATIONS.includes(parts[i].toUpperCase())) {
            countyWithState = `${parts[0]}, ${parts[i]}`;
            break;
          }
        }
        onChange(countyWithState);
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
    }

    // For cities and other specific locations, use the full place name but simplify it
    // "Detroit, Michigan, United States" -> "Detroit, MI" or "Detroit, Michigan"
    const parts = suggestion.place_name.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Find city + state
      const city = parts[0];
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].toLowerCase();
        if (part === 'united states' || part === 'usa') break;
        if (US_STATES[part] || STATE_ABBREVIATIONS.includes(parts[i].toUpperCase())) {
          onChange(`${city}, ${parts[i]}`);
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }
      }
    }

    // Fallback: use full place name
    onChange(suggestion.place_name);
    setSuggestions([]);
    setShowSuggestions(false);
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

      {validationState.warning === 'state-only' && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>State-wide searches are not supported.</strong> Please enter a specific city (e.g., "Detroit, MI"), ZIP code, or county name with state.
          </AlertDescription>
        </Alert>
      )}

      {validationState.warning === 'county-no-state' && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Please include a state with county searches.</strong> Example: "Oakland County, MI" or "Oakland County, Michigan"
          </AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        Search by city, ZIP code, or county <span className="font-medium">with state</span>. Examples: "Detroit, MI" or "Oakland County, MI"
      </p>
    </div>
  );
}