import { useState, useEffect, useRef, useId, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Loader2, AlertTriangle, Home, Building2 } from 'lucide-react';
import { property as propertyApi, type AutocompleteSuggestion } from '@/lib/api-client';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Fired when the user *commits* a suggestion (click or Enter on a
   * highlighted row). Distinct from `onChange` so callers can trigger a
   * search instead of waiting for a separate button press. Optional — if
   * not provided we only update the input value.
   */
  onSelect?: (suggestion: AutocompleteSuggestion) => void;
  onValidationChange?: (isValid: boolean, message?: string) => void;
  placeholder?: string;
  required?: boolean;
  /**
   * Suppress the built-in "Search by state, city, ZIP code…" helper text
   * below the input. Set when a parent provides its own consolidated
   * helper line (e.g. PropertySearch v3 tidied variants), so the two
   * lines don't stack and read as redundant noise.
   */
  hideHelperText?: boolean;
  /**
   * Optional `id` for the underlying input — needed when the parent
   * wires an external `<Label htmlFor=...>`. Defaults to "location" for
   * the component's own built-in label.
   */
  inputId?: string;
  /**
   * If true, hide the component's own MapPin-labelled "Location" label
   * (the parent provides its own).
   */
  hideLabel?: boolean;
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
  if (US_STATES[trimmed]) return true;
  if (trimmed.length === 2 && STATE_ABBREVIATIONS.includes(trimmed.toUpperCase())) return true;
  return false;
}

// Check if it's a county search without a state
function isCountyWithoutState(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.includes('county')) return false;

  const parts = trimmed.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const possibleState = parts[1].toLowerCase();
    if (US_STATES[possibleState] || STATE_ABBREVIATIONS.includes(possibleState.toUpperCase())) {
      return false;
    }
    if (possibleState === 'united states' || possibleState === 'usa' || possibleState === 'us') {
      if (parts.length >= 3) {
        const stateCheck = parts[1].toLowerCase();
        if (US_STATES[stateCheck] || STATE_ABBREVIATIONS.includes(stateCheck.toUpperCase())) {
          return false;
        }
      }
    }
  }

  return true;
}

interface LocationValidation {
  isValid: boolean;
  warning: 'state-only' | 'county-no-state' | null;
  message?: string;
}

function validateLocation(value: string): LocationValidation {
  if (isStateOnly(value)) {
    return { isValid: true, warning: null };
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

/**
 * Human-readable label for the row's secondary line. Region rows get the
 * specific Zillow regionType (city / zipcode / county / neighborhood);
 * address rows simply say "Address".
 */
function describeSuggestion(s: AutocompleteSuggestion): string {
  if (s.type === 'address') return 'Address';
  if (s.regionType) {
    // Zillow uses lowercase regionType strings — Title-case them for the UI.
    const map: Record<string, string> = {
      city: 'City',
      zipcode: 'ZIP code',
      county: 'County',
      neighborhood: 'Neighborhood',
      state: 'State',
      community: 'Community',
      school: 'School',
    };
    return map[s.regionType] || s.regionType;
  }
  return 'Region';
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  onValidationChange,
  placeholder = "e.g., Charlotte, NC or Oakland County, MI or 90210",
  required = false,
  hideHelperText = false,
  inputId,
  hideLabel = false,
}: LocationAutocompleteProps) {
  const reactId = useId();
  const id = inputId || `location-${reactId}`;
  const listboxId = `${id}-listbox`;

  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [validationState, setValidationState] = useState<LocationValidation>({ isValid: true, warning: null });

  // Refs for debounce, click-outside detection, request-staleness guard.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  // Bumped on every fetch so a slow earlier request can't clobber a fresh one.
  const fetchSeqRef = useRef(0);

  // Trip the parent validator on every value change.
  useEffect(() => {
    const validation = validateLocation(value);
    setValidationState(validation);
    if (onValidationChange) {
      onValidationChange(validation.isValid, validation.message);
    }
  }, [value, onValidationChange]);

  // Reset the active row whenever the suggestion list changes — otherwise
  // a stale index could land on a different suggestion after a fresh fetch.
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  const fetchSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setIsLoading(true);
    try {
      const res = await propertyApi.autocomplete(trimmed, 8);
      // Bail if a newer request already started — prevents the flicker
      // where a slow response for "aus" overwrites a fast one for "austin".
      if (seq !== fetchSeqRef.current) return;
      if (res.error) {
        setSuggestions([]);
      } else {
        const data = res.data as { suggestions?: AutocompleteSuggestion[] } | undefined;
        setSuggestions(Array.isArray(data?.suggestions) ? data!.suggestions! : []);
      }
    } catch {
      if (seq === fetchSeqRef.current) setSuggestions([]);
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const commitSuggestion = (s: AutocompleteSuggestion) => {
    onChange(s.display);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    if (onSelect) onSelect(s);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      // Even with the menu closed, hitting ArrowDown should re-open it if
      // we already have cached suggestions — matches Google Places UX.
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setShowSuggestions(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          commitSuggestion(suggestions[activeIndex]);
        }
        // If nothing is highlighted, let the form's own Enter handler run.
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setActiveIndex(-1);
        break;
      case 'Tab':
        // Closing on Tab matches WAI-ARIA combobox guidance.
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  // Close suggestions when clicking outside.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cancel any pending debounced fetch on unmount — prevents a setState
  // on an unmounted component if the parent unmounts mid-keystroke.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const open = showSuggestions && suggestions.length > 0;
  const activeOptionId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <Label htmlFor={id} className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Location
        </Label>
      )}

      <div className="relative" ref={containerRef}>
        <div
          className="relative"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-owns={listboxId}
        >
          <Input
            id={id}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="bg-background/50 pr-8"
            required={required}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
          />
          {isLoading && (
            <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        {/* Always-rendered listbox keeps the aria-controls reference valid;
            we just hide it visually when there's nothing to show. */}
        <ul
          id={listboxId}
          role="listbox"
          className={
            open
              ? 'absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-72 overflow-y-auto py-1'
              : 'sr-only'
          }
        >
          {suggestions.map((s, index) => {
            const isActive = index === activeIndex;
            const Icon = s.type === 'address' ? Home : Building2;
            return (
              <li
                key={`${s.display}-${index}`}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={isActive}
                className={`px-3 py-2 cursor-pointer flex items-center gap-2 border-b border-border last:border-b-0 ${
                  isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                }`}
                onMouseDown={(e) => {
                  // mousedown beats the input's blur — keeps focus on the input
                  // so the parent form's submit-on-enter behaviour still works
                  // after the user clicks.
                  e.preventDefault();
                  commitSuggestion(s);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{s.display}</span>
                  <span className="text-xs text-muted-foreground">{describeSuggestion(s)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {validationState.warning === 'county-no-state' && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Please include a state with county searches.</strong> Example: "Oakland County, MI" or "Oakland County, Michigan"
          </AlertDescription>
        </Alert>
      )}

      {!hideHelperText && (
        <p className="text-xs text-muted-foreground">
          Search by state, city, ZIP code, address, or county. Examples: "MI", "Detroit, MI", "1600 Pennsylvania Ave", or "90210"
        </p>
      )}
    </div>
  );
}
