import { useState, useEffect, useCallback, useRef } from 'react';

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

// Visual toast banner for catchment errors / 422 fallback (BUG-22)
function showCatchmentToast(message: string, isWarning = true) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('geovista-catchment-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'geovista-catchment-toast';
  toast.className = `fixed top-20 right-6 z-50 px-4 py-2.5 rounded-lg shadow-2xl text-xs font-semibold flex items-center gap-2 border transition-all pointer-events-auto ${
    isWarning ? 'bg-amber-500/95 text-slate-950 border-amber-300' : 'bg-rose-600 text-white border-rose-400'
  }`;
  toast.innerHTML = `<span>⚠️ ${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Fallback synthetic polygon generator for standalone frontend mode
function generateFallbackIsochrone(lat: number, lng: number, minutes: number, mode: TravelMode, populationReached?: number) {
  const speed = mode === 'walking' ? 4.5 : mode === 'cycling' ? 15.0 : 36.6;
  const radiusKm = speed * (minutes / 60.0);
  const deltaLat = (radiusKm / 6371.0) * (180.0 / Math.PI);
  const deltaLng = deltaLat / Math.cos((lat * Math.PI) / 180.0);

  const coords: [number, number][] = [];
  const vertices = 48;
  for (let i = 0; i < vertices; i++) {
    const theta = (2 * Math.PI * i) / vertices;
    const stretch = 1.0 + (mode === 'driving' ? 0.28 * Math.cos(2 * (theta - 0.6)) : 0.05);
    const rLat = deltaLat * stretch;
    const rLng = deltaLng * stretch;
    coords.push([Number((lng + rLng * Math.cos(theta)).toFixed(6)), Number((lat + rLat * Math.sin(theta)).toFixed(6))]);
  }
  coords.push(coords[0]);

  const approxArea = Number((Math.PI * radiusKm * radiusKm * (mode === 'driving' ? 0.85 : 0.95)).toFixed(2));
  const popEst = populationReached ?? Math.round(approxArea * 14250 * 0.68);

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
          population_reached: popEst,
          provider: 'client_fallback',
          color: minutes <= 10 ? '#38bdf8' : minutes <= 20 ? '#0284c7' : '#0369a1',
        },
      },
    ],
  };
}

function generateFallbackCatchment(lat: number, lng: number, minutes: number, mode: TravelMode): CatchmentData {
  const speed = mode === 'walking' ? 4.5 : mode === 'cycling' ? 15.0 : 36.6;
  const radiusKm = speed * (minutes / 60.0);
  const area = Number((Math.PI * radiusKm * radiusKm * (mode === 'driving' ? 0.85 : 0.95)).toFixed(2));
  const avgDensity = 14250;
  const pop = Math.round(area * avgDensity * 0.68);

  const timeBands: TimeBandStat[] = [5, 10, 15, 30].map((m) => {
    const r = speed * (m / 60.0);
    const a = Number((Math.PI * r * r * (mode === 'driving' ? 0.85 : 0.95)).toFixed(2));
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

  const activeRequestRef = useRef<AbortController | null>(null);

  const fetchIsochrone = useCallback(async () => {
    if (!location) {
      setIsochroneData(null);
      setCatchmentData(null);
      setIsLoading(false);
      return;
    }

    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setIsLoading(true);
    setError(null);

    // 1. Instantly generate client-side fallback geometry so map polygon resizes immediately on mode/minutes/location switch (BUG-08)
    const instantFallback = generateFallbackIsochrone(location.lat, location.lng, minutes, mode);
    setIsochroneData(instantFallback);

    try {
      // 2. Fetch Isochrone Polygon
      const isoUrl = `/api/isochrones?lat=${location.lat}&lng=${location.lng}&minutes=${minutes}&mode=${mode}`;
      const isoRes = await fetch(isoUrl, { signal: controller.signal });

      let isoJson: any = null;
      if (isoRes.ok) {
        isoJson = await isoRes.json();
      } else {
        const isoErr = `Isochrone API returned status ${isoRes.status}`;
        setError(isoErr);
      }

      // 3. Fetch Catchment Demographics
      const catchRes = await fetch('/api/catchment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          minutes,
          mode,
        }),
        signal: controller.signal,
      });

      let catchJson: CatchmentData | null = null;
      if (catchRes.ok) {
        const payload = await catchRes.json();
        if (payload.status === 'ok' && payload.data) {
          catchJson = payload.data;
        }
      } else {
        // Handle 422 or other errors (BUG-22)
        let errorMsg = `Catchment Analysis: Coordinate outside evaluation bounds (${catchRes.status})`;
        try {
          const errBody = await catchRes.json();
          if (errBody.detail) {
            errorMsg = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
          }
        } catch {}
        setError(errorMsg);
        showCatchmentToast(errorMsg, true);
      }

      // 4. Update catchment data
      if (catchJson) {
        setCatchmentData(catchJson);
      } else {
        // Fallback catchment estimation
        setCatchmentData(generateFallbackCatchment(location.lat, location.lng, minutes, mode));
      }

      // 5. Inject population_reached from catchment into each feature's properties (BUG-09)
      const popValue = catchJson?.population_reached ?? Math.round((instantFallback.features[0].properties.area_km2 || 10) * 14250 * 0.68);

      if (isoJson && isoJson.features && isoJson.features.length > 0) {
        isoJson.features = isoJson.features.map((f: any) => ({
          ...f,
          properties: {
            ...f.properties,
            mode: f.properties?.mode || mode,
            minutes: f.properties?.minutes || minutes,
            population_reached: f.properties?.population_reached ?? popValue,
          },
        }));
        setIsochroneData(isoJson);
      } else {
        // Inject into instant fallback
        instantFallback.features[0].properties.population_reached = popValue;
        setIsochroneData({ ...instantFallback });
      }

      setIsLoading(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const networkError = err?.message || 'Network error fetching catchment analysis; offline fallback active';
        setError(networkError);
        showCatchmentToast(networkError, true);
        setIsLoading(false);
      }
    }
  }, [location?.lat, location?.lng, minutes, mode]);

  useEffect(() => {
    fetchIsochrone();
    return () => {
      if (activeRequestRef.current) activeRequestRef.current.abort();
    };
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

