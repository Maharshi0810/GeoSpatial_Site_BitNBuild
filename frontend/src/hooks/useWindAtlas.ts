import { useState, useEffect } from 'react';
import type { PrimeSpotItem } from '@/components/WindPrimeSpotsBar';

export interface WindAtlasState {
  windAtlasData: any | null;
  primeSpots: PrimeSpotItem[];
  isLoading: boolean;
  error: string | null;
}

export function useWindAtlas(enabled: boolean = true) {
  const [state, setState] = useState<WindAtlasState>({
    windAtlasData: null,
    primeSpots: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    async function fetchWindData() {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const [atlasRes, spotsRes] = await Promise.all([
          fetch('/api/wind/atlas').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/wind/prime-spots').then((r) => (r.ok ? r.json() : null)),
        ]);

        if (!isMounted) return;

        setState({
          windAtlasData: atlasRes,
          primeSpots: spotsRes?.data || [],
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message || 'Failed to load wind atlas',
        }));
      }
    }

    fetchWindData();

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  return state;
}
