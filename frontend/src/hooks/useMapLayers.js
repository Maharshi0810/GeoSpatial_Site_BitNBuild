/**
 * React hook to fetch layer definitions, cache GeoJSON data, and manage visibility/opacity.
 *
 * Owner: Daksh [D]
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env?.VITE_API_URL || (import.meta.env?.PROD ? '' : 'http://localhost:8000');

export function useMapLayers() {
  const [layers, setLayers] = useState([]);
  const [activeLayers, setActiveLayers] = useState({});
  const [layerOpacity, setLayerOpacity] = useState({});
  const [layerData, setLayerData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch available layers on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchLayers() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/layers`);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching layers`);
        const json = await res.json();
        const layerList = json.data || [];

        if (isMounted) {
          setLayers(layerList);
          // Default: enable first 2 layers
          const initialActive = {};
          const initialOpacity = {};
          layerList.forEach((l, idx) => {
            initialActive[l.id] = idx < 2;
            initialOpacity[l.id] = 0.8;
          });
          setActiveLayers(initialActive);
          setLayerOpacity(initialOpacity);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching layers:', err);
        if (isMounted) {
          setError(err.message);
          // Fallback defaults
          const defaults = [
            { id: 'demographics', name: 'Population Density', type: 'heatmap', color: '#ff7043' },
            { id: 'transportation', name: 'Road Network', type: 'line', color: '#29b6f6' },
            { id: 'poi', name: 'Points of Interest', type: 'point', color: '#66bb6a' },
            { id: 'landuse', name: 'Land Use & Zoning', type: 'fill', color: '#ab47bc' },
            { id: 'environment', name: 'Environmental Risk', type: 'fill', color: '#ef5350' }
          ];
          setLayers(defaults);
          setActiveLayers({ demographics: true, transportation: true });
          setLayerOpacity({ demographics: 0.8, transportation: 0.8, poi: 0.8, landuse: 0.8, environment: 0.8 });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchLayers();
    return () => { isMounted = false; };
  }, []);

  // Fetch GeoJSON for an active layer if not already cached
  const fetchLayerData = useCallback(async (layerId) => {
    if (layerData[layerId]) return layerData[layerId];

    try {
      const res = await fetch(`${API_BASE}/api/layers/${layerId}/geojson`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geojson = await res.json();
      setLayerData((prev) => ({ ...prev, [layerId]: geojson }));
      return geojson;
    } catch (err) {
      console.error(`Failed to fetch GeoJSON for ${layerId}:`, err);
      return null;
    }
  }, [layerData]);

  // Load GeoJSON whenever activeLayers change
  useEffect(() => {
    Object.keys(activeLayers).forEach((layerId) => {
      if (activeLayers[layerId] && !layerData[layerId]) {
        fetchLayerData(layerId);
      }
    });
  }, [activeLayers, layerData, fetchLayerData]);

  const toggleLayer = useCallback((layerId) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  }, []);

  const updateOpacity = useCallback((layerId, opacity) => {
    setLayerOpacity((prev) => ({
      ...prev,
      [layerId]: Math.max(0, Math.min(1, opacity))
    }));
  }, []);

  return {
    layers,
    activeLayers,
    layerOpacity,
    layerData,
    loading,
    error,
    toggleLayer,
    updateOpacity,
    fetchLayerData
  };
}
