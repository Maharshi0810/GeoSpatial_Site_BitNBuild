import { useState, useEffect, useCallback } from 'react';

export type TravelMode = 'driving' | 'walking' | 'cycling';

export interface TimeBandStat {
  minutes: number;
  population: number;
  area_km2: number;
  label: string;
}

export interface CatchmentData {
  center: { lat: number; lng: number };
  travel_mode: TravelMode;
  travel_minutes: number;
  catchment_area_km2: number;
  population_reached: number;
  average_density_per_km2: number;
  dominant_income_tier: string;
  competitors_in_catchment: number;
  competitor_categories: Record<string, number>;
  time_bands: TimeBandStat[];
}

export interface IsochroneState {
  isochroneData: any | null;
  catchmentData: CatchmentData | null;
  isLoading: boolean;
  error: string | null;
  minutes: number;
  mode: TravelMode;
  setMinutes: (mins: number) => void;
  setMode: (mode: TravelMode) => void;
  refresh: () => void;
}

// Fallback synthetic polygon generator for standalone frontend mode
function generateFallbackIsochrone(lat: number, lng: number, minutes: number, mode: TravelMode) {
  const speed = mode === 'walking' ? 4.5 : mode === 'cycling' ? 15.0 : 42.0;
  const radiusKm = speed * (minutes / 60.0);
  const deltaLat = (radiusKm / 6371.0) * (180.0 / Math.PI);
  const deltaLng = deltaLat / Math.cos((lat * Math.PI) / 180.0);

  const coords: [number, number][] = [];
  const vertices = 36;
  for (let i = 0; i < vertices; i++) {
    const theta = (2 * Math.PI * i) / vertices;
    const stretch = 1.0 + (mode === 'driving' ? 0.28 * Math.cos(2 * (theta - 0.6)) : 0.05);
    const rLat = deltaLat * stretch;
    const rLng = deltaLng * stretch;
    coords.push([Number((lng + rLng * Math.cos(theta)).toFixed(6)), Number((lat + rLat * Math.sin(theta)).toFixed(6))]);
  }
  coords.push(coords[0]);

  const approxArea = Number((Math.PI * radiusKm * radiusKm * 0.9).toFixed(2));
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
        properties: {
          minutes,
          mode,
          area_km2: approxArea,
          nominal_radius_km: Number(radiusKm.toFixed(2)),
          provider: 'client_fallback',
          color: minutes <= 10 ? '#38bdf8' : minutes <= 20 ? '#0284c7' : '#0369a1',
        },
      },
    ],
  };
}

function generateFallbackCatchment(lat: number, lng: number, minutes: number, mode: TravelMode): CatchmentData {
  const speed = mode === 'walking' ? 4.5 : mode === 'cycling' ? 15.0 : 42.0;
  const radiusKm = speed * (minutes / 60.0);
  const area = Number((Math.PI * radiusKm * radiusKm * 0.85).toFixed(2));
  const avgDensity = 14250;
  const pop = Math.round(area * avgDensity * 0.68);

  const timeBands: TimeBandStat[] = [5, 10, 15, 30].map((m) => {
    const r = speed * (m / 60.0);
    const a = Number((Math.PI * r * r * 0.85).toFixed(2));
    return {
      minutes: m,
      population: Math.round(a * avgDensity * 0.68),
      area_km2: a,
      label: `${m} min ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
    };
  });

  return {
    center: { lat, lng },
    travel_mode: mode,
    travel_minutes: minutes,
    catchment_area_km2: area,
    population_reached: pop,
    average_density_per_km2: avgDensity,
    dominant_income_tier: 'Medium',
    competitors_in_catchment: Math.max(2, Math.round(area * 0.08)),
    competitor_categories: {
      ev_charging: Math.max(1, Math.round(area * 0.03)),
      retail: Math.max(1, Math.round(area * 0.04)),
      grocery: Math.max(1, Math.round(area * 0.02)),
    },
    time_bands: timeBands,
  };
}

export function useIsochrone(location: { lat: number; lng: number } | null): IsochroneState {
  const [minutes, setMinutes] = useState<number>(15);
  const [mode, setMode] = useState<TravelMode>('driving');
  const [isochroneData, setIsochroneData] = useState<any | null>(() =>
    location ? generateFallbackIsochrone(location.lat, location.lng, 15, 'driving') : null
  );
  const [catchmentData, setCatchmentData] = useState<CatchmentData | null>(() =>
    location ? generateFallbackCatchment(location.lat, location.lng, 15, 'driving') : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIsochrone = useCallback(async () => {
    if (!location) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch Isochrone Polygon
      const isoUrl = `/api/isochrones?lat=${location.lat}&lng=${location.lng}&minutes=${minutes}&mode=${mode}`;
      const isoRes = await fetch(isoUrl);

      let isoJson = null;
      if (isoRes.ok) {
        isoJson = await isoRes.json();
      }

      // 2. Fetch Catchment Demographics
      const catchRes = await fetch('/api/catchment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          minutes,
          mode,
        }),
      });

      let catchJson = null;
      if (catchRes.ok) {
        const payload = await catchRes.json();
        if (payload.status === 'ok' && payload.data) {
          catchJson = payload.data;
        }
      }

      // If backend returned live results, set state
      if (isoJson && catchJson) {
        setIsochroneData(isoJson);
        setCatchmentData(catchJson);
        setIsLoading(false);
        return;
      }
    } catch {
      // Graceful fallback on network/backend offline
    }

    // Client-side deterministic fallback
    const fallbackIso = generateFallbackIsochrone(location.lat, location.lng, minutes, mode);
    const fallbackCatch = generateFallbackCatchment(location.lat, location.lng, minutes, mode);
    setIsochroneData(fallbackIso);
    setCatchmentData(fallbackCatch);
    setIsLoading(false);
  }, [location?.lat, location?.lng, minutes, mode]);

  useEffect(() => {
    fetchIsochrone();
  }, [fetchIsochrone]);

  return {
    isochroneData,
    catchmentData,
    isLoading,
    error,
    minutes,
    mode,
    setMinutes,
    setMode,
    refresh: fetchIsochrone,
  };
}
