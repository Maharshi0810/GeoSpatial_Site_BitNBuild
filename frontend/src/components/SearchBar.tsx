import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  MapPin,
  X,
  Loader2,
  Navigation,
  Building2,
  Factory,
  Landmark,
  Anchor,
  Store,
  Compass,
} from 'lucide-react';

export interface SearchResultItem {
  id: string;
  name: string;
  subTitle: string;
  lat: number;
  lng: number;
  category: 'benchmark' | 'ward' | 'city' | 'industrial' | 'geocoded' | 'coordinate';
  district?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Curated Gujarat local presets for immediate fallback & zero-latency initial list
const LOCAL_FALLBACK_PRESETS: SearchResultItem[] = [
  {
    id: 'loc-sg-highway',
    name: 'SG Highway Commercial Corridor',
    subTitle: 'Bodakdev - Thaltej - Sola Arterial Axis, Ahmedabad',
    lat: 23.0378,
    lng: 72.5112,
    category: 'benchmark',
    district: 'Ahmedabad',
    icon: Building2,
  },
  {
    id: 'loc-gift-city',
    name: 'GIFT City International FinTech Zone',
    subTitle: "India's Flagship IFSC Smart City, Gandhinagar",
    lat: 23.1601,
    lng: 72.6841,
    category: 'benchmark',
    district: 'Gandhinagar',
    icon: Landmark,
  },
  {
    id: 'loc-sanand-gidc',
    name: 'Sanand GIDC Mega Automotive Corridor',
    subTitle: 'Heavy Industrial & Auto OEM Cluster, Ahmedabad Rural',
    lat: 22.9868,
    lng: 72.3814,
    category: 'benchmark',
    district: 'Ahmedabad Rural',
    icon: Factory,
  },
  {
    id: 'loc-mundra-port',
    name: 'Mundra Port & SEZ Logistics Hub',
    subTitle: 'Deep-Water Container Terminal & Freight Corridor, Kutch',
    lat: 22.8394,
    lng: 69.7214,
    category: 'benchmark',
    district: 'Kutch',
    icon: Anchor,
  },
  {
    id: 'loc-vadodara-alkapuri',
    name: 'Alkapuri Central Commercial Hub',
    subTitle: 'R.C. Dutt Road Premier Business District, Vadodara',
    lat: 22.3106,
    lng: 73.1812,
    category: 'benchmark',
    district: 'Vadodara',
    icon: Store,
  },
  {
    id: 'loc-bodakdev',
    name: 'Bodakdev Urban Ward',
    subTitle: 'SG Highway & Judges Bungalow Precinct, Ahmedabad',
    lat: 23.0373,
    lng: 72.5074,
    category: 'ward',
    district: 'Ahmedabad',
    icon: MapPin,
  },
  {
    id: 'loc-sbr',
    name: 'Sindhu Bhavan Road (SBR)',
    subTitle: 'High-Street Retail & Corporate Corridor, Ahmedabad',
    lat: 23.0450,
    lng: 72.4980,
    category: 'ward',
    district: 'Ahmedabad',
    icon: Store,
  },
  {
    id: 'loc-prahladnagar',
    name: 'Prahlad Nagar Corporate Road',
    subTitle: 'Makarba - Vejalpur Commercial Zone, Ahmedabad',
    lat: 23.0125,
    lng: 72.5085,
    category: 'ward',
    district: 'Ahmedabad',
    icon: Building2,
  },
  {
    id: 'loc-satellite',
    name: 'Satellite & Shivranjani',
    subTitle: 'Dense Mixed Commercial & Residential Hub, Ahmedabad',
    lat: 23.0305,
    lng: 72.5178,
    category: 'ward',
    district: 'Ahmedabad',
    icon: MapPin,
  },
  {
    id: 'loc-vastrapur',
    name: 'Vastrapur Lake & IIM Ahmedabad',
    subTitle: 'Institutional & Premium Retail District, Ahmedabad',
    lat: 23.0350,
    lng: 72.5293,
    category: 'ward',
    district: 'Ahmedabad',
    icon: Landmark,
  },
  {
    id: 'loc-navrangpura',
    name: 'Navrangpura Commercial District',
    subTitle: 'CG Road, Municipal Market & Law Garden, Ahmedabad',
    lat: 23.0365,
    lng: 72.5611,
    category: 'ward',
    district: 'Ahmedabad',
    icon: Store,
  },
  {
    id: 'loc-surat-vesu',
    name: 'Vesu Commercial & Luxury Retail Hub',
    subTitle: 'South Surat High-Density Premium Corridor, Surat',
    lat: 21.1442,
    lng: 72.7712,
    category: 'city',
    district: 'Surat',
    icon: Store,
  },
  {
    id: 'loc-surat-hazira',
    name: 'Hazira Port & Industrial Belt',
    subTitle: 'Deep-Water LNG, Steel & Heavy Petrochemical Terminal, Surat',
    lat: 21.1158,
    lng: 72.6482,
    category: 'industrial',
    district: 'Surat',
    icon: Anchor,
  },
  {
    id: 'loc-rajkot-ringroad',
    name: '150 Feet Ring Road Commercial Axis',
    subTitle: 'West Rajkot Retail, Hospitality & Healthcare Corridor, Rajkot',
    lat: 22.2850,
    lng: 70.7680,
    category: 'city',
    district: 'Rajkot',
    icon: Building2,
  },
];

interface SearchBarProps {
  currentAddress?: string;
  onSelectLocation: (result: {
    name: string;
    lat: number;
    lng: number;
    category?: string;
    subTitle?: string;
  }) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  currentAddress = 'SG Highway, Bodakdev, Ahmedabad',
  onSelectLocation,
}) => {
  const [query, setQuery] = useState(currentAddress);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>(LOCAL_FALLBACK_PRESETS.slice(0, 6));
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync prop when external site changes
  useEffect(() => {
    if (currentAddress && currentAddress !== query) {
      setQuery(currentAddress);
    }
  }, [currentAddress]);

  // Coordinate Parser Helper (e.g. 23.0378, 72.5112)
  const coordinateMatch = useMemo(() => {
    const trimmed = query.trim();
    const coordRegex = /^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/;
    const m = trimmed.match(coordRegex);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
    return null;
  }, [query]);

  // Query Backend Search API (/api/search?q=...)
  const fetchSearchResults = useCallback(async (searchQuery: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=8`, {
        signal: controller.signal,
      });

      if (!resp.ok) throw new Error('Search API returned non-200');
      const data = await resp.json();

      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        const mapped: SearchResultItem[] = data.results.map((r: any) => {
          let icon = MapPin;
          if (r.category === 'benchmark') icon = Building2;
          else if (r.category === 'coordinate') icon = Compass;
          else if (r.category === 'industrial') icon = Factory;
          else if (r.category === 'city') icon = Landmark;
          else if (r.category === 'geocoded') icon = Navigation;

          return {
            id: r.id || `res-${r.lat}-${r.lng}`,
            name: r.name,
            subTitle: r.subTitle || `${r.district || 'Gujarat'} (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})`,
            lat: r.lat,
            lng: r.lng,
            category: r.category || 'ward',
            district: r.district,
            icon,
          };
        });
        setSearchResults(mapped);
        return mapped;
      } else {
        // Fallback to local filtering
        const qLower = searchQuery.toLowerCase();
        const filtered = LOCAL_FALLBACK_PRESETS.filter(
          (p) =>
            p.name.toLowerCase().includes(qLower) ||
            p.subTitle.toLowerCase().includes(qLower) ||
            (p.district && p.district.toLowerCase().includes(qLower))
        );
        setSearchResults(filtered);
        return filtered;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Fallback gracefully to local presets
        const qLower = searchQuery.toLowerCase();
        const filtered = LOCAL_FALLBACK_PRESETS.filter(
          (p) =>
            p.name.toLowerCase().includes(qLower) ||
            p.subTitle.toLowerCase().includes(qLower) ||
            (p.district && p.district.toLowerCase().includes(qLower))
        );
        setSearchResults(filtered.length > 0 ? filtered : LOCAL_FALLBACK_PRESETS.slice(0, 5));
      }
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search on input change
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(LOCAL_FALLBACK_PRESETS.slice(0, 6));
      return;
    }

    const timer = setTimeout(() => {
      fetchSearchResults(q);
    }, 280);

    return () => clearTimeout(timer);
  }, [query, fetchSearchResults]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: SearchResultItem) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelectLocation({
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      category: item.category,
      subTitle: item.subTitle,
    });
  };

  // Immediate Search Execution (via Search button or Enter)
  const handleExecuteSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // If direct coordinates entered
    if (coordinateMatch) {
      handleSelect({
        id: 'coord-custom',
        name: `Coordinates: ${coordinateMatch.lat.toFixed(4)}° N, ${coordinateMatch.lng.toFixed(4)}° E`,
        subTitle: 'Direct GPS Coordinates in Gujarat',
        lat: coordinateMatch.lat,
        lng: coordinateMatch.lng,
        category: 'coordinate',
        icon: Compass,
      });
      return;
    }

    // If an item in dropdown is currently selected by arrow keys
    if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
      handleSelect(searchResults[selectedIndex]);
      return;
    }

    // If we already have search results displayed, pick the top match
    if (searchResults.length > 0) {
      handleSelect(searchResults[0]);
      return;
    }

    // Otherwise trigger immediate fetch
    const fetched = await fetchSearchResults(query.trim());
    if (fetched && fetched.length > 0) {
      handleSelect(fetched[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteSearch();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(true);
    setSearchResults(LOCAL_FALLBACK_PRESETS.slice(0, 6));
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar with right-side Search Button */}
      <form
        onSubmit={handleExecuteSearch}
        className="h-10 bg-surface border border-slate-200 dark:border-slate-700 rounded-panel shadow-float px-3 flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-brand-600/40 focus-within:border-brand-600"
      >
        <Search className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.75} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search Gujarat address, ward, or coordinates (e.g. 23.0378, 72.5112)"
          className="w-full bg-transparent text-xs text-ink placeholder:text-slate-500 outline-none"
        />

        {/* Loading Spinner */}
        {isSearching && (
          <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin shrink-0" />
        )}

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-ink transition-colors shrink-0"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dedicated Right-Side Search Action Button */}
        <button
          type="submit"
          className="h-7 px-3 bg-brand-600 hover:bg-brand-700 active:scale-95 text-surface text-xs font-semibold rounded-chip flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer select-none"
          title="Search this location"
        >
          <Search className="w-3.5 h-3.5" strokeWidth={2} />
          <span>Search</span>
        </button>
      </form>

      {/* Autocomplete Dropdown Menu */}
      {isOpen && searchResults.length > 0 && (
        <div className="absolute left-0 right-0 top-11 mt-1 bg-surface/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-panel shadow-2xl z-50 max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Coordinates detected notice */}
          {coordinateMatch && (
            <div
              onClick={() =>
                handleSelect({
                  id: 'coord-custom',
                  name: `Coordinates: ${coordinateMatch.lat.toFixed(4)}° N, ${coordinateMatch.lng.toFixed(4)}° E`,
                  subTitle: 'Direct GPS Coordinates in Gujarat',
                  lat: coordinateMatch.lat,
                  lng: coordinateMatch.lng,
                  category: 'coordinate',
                  icon: Compass,
                })
              }
              className="p-2.5 bg-brand-50/80 dark:bg-brand-950/40 border-b border-brand-100 dark:border-brand-900/50 flex items-center justify-between cursor-pointer hover:bg-brand-100/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <div>
                  <span className="text-xs font-medium text-brand-900 dark:text-brand-200">
                    Jump to Coordinates: {coordinateMatch.lat.toFixed(4)}, {coordinateMatch.lng.toFixed(4)}
                  </span>
                  <p className="text-[10px] text-slate-500">Press Enter or click to evaluate site</p>
                </div>
              </div>
              <span className="text-[10px] bg-brand-600 text-white px-2 py-0.5 rounded font-mono font-medium">↵ Go</span>
            </div>
          )}

          {/* List of matched items */}
          <div className="py-1">
            {searchResults.map((item, idx) => {
              const Icon = item.icon || MapPin;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-brand-50/80 dark:bg-brand-950/50 text-brand-900 dark:text-brand-200'
                      : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-ink'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                      item.category === 'benchmark'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : item.category === 'coordinate'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : item.category === 'industrial'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{item.name}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded font-mono font-medium shrink-0 ${
                          item.category === 'benchmark'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : item.category === 'coordinate'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                            : item.category === 'industrial'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {item.category === 'geocoded' ? 'OSM Result' : item.category}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.subTitle}
                    </p>

                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {item.lat.toFixed(4)}° N, {item.lng.toFixed(4)}° E
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dropdown Footer */}
          <div className="px-3 py-1.5 bg-canvas/60 dark:bg-slate-900/60 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              {searchResults.length} locations found in Gujarat
            </span>
            <div className="flex items-center gap-2">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>Esc Close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
