import { useState, useEffect } from 'react';

export interface SpatialDataState {
  h3Data: any | null;
  clusterData: any | null;
  hotspotData: any | null;
  isLoading: boolean;
  error: string | null;
}

// Fallback synthetic data for standalone frontend mode
const MOCK_H3 = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.54, 23.00], [72.57, 23.02], [72.60, 23.00], [72.60, 22.96], [72.57, 22.94], [72.54, 22.96], [72.54, 23.00]]]
      },
      properties: { hex_id: '876092461ffffff', avg_value: 0.88, count: 18 }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.57, 23.02], [72.60, 23.04], [72.63, 23.02], [72.63, 22.98], [72.60, 22.96], [72.57, 22.98], [72.57, 23.02]]]
      },
      properties: { hex_id: '876092463ffffff', avg_value: 0.94, count: 24 }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.51, 23.02], [72.54, 23.04], [72.57, 23.02], [72.57, 22.98], [72.54, 22.96], [72.51, 22.98], [72.51, 23.02]]]
      },
      properties: { hex_id: '876092465ffffff', avg_value: 0.65, count: 11 }
    }
  ]
};

const MOCK_CLUSTERS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [72.5714, 23.0225] },
      properties: { name: 'Ahmedabad Retail Hub', cluster_id: 0, cluster_label: 'Cluster 1', is_noise: false }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [72.5810, 23.0310] },
      properties: { name: 'CG Road Commercial', cluster_id: 0, cluster_label: 'Cluster 1', is_noise: false }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [72.5110, 23.0410] },
      properties: { name: 'SG Highway Corridor', cluster_id: 1, cluster_label: 'Cluster 2', is_noise: false }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [72.5220, 23.0520] },
      properties: { name: 'Thaltej Commercial Arc', cluster_id: 1, cluster_label: 'Cluster 2', is_noise: false }
    }
  ]
};

const MOCK_HOTSPOTS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [72.5714, 23.0225] },
      properties: { name: 'Central Ahmedabad', z_score: 2.85, p_value: 0.004, classification: 'hot', confidence: 99 }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [72.8311, 21.1702] },
      properties: { name: 'Surat Diamond Center', z_score: 2.15, p_value: 0.031, classification: 'hot', confidence: 95 }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [73.1812, 22.3072] },
      properties: { name: 'Vadodara Hub', z_score: 0.42, p_value: 0.674, classification: 'neutral', confidence: 0 }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [70.8022, 22.3039] },
      properties: { name: 'Rajkot Zone', z_score: -2.05, p_value: 0.040, classification: 'cold', confidence: 95 }
    }
  ]
};

export function useSpatialAnalytics() {
  const [data, setData] = useState<SpatialDataState>({
    h3Data: null,
    clusterData: null,
    hotspotData: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchAll() {
      try {
        const [h3Res, clusterRes, hotspotRes] = await Promise.allSettled([
          fetch('/api/h3?resolution=7').then((r) => (r.ok ? r.json() : Promise.reject())),
          fetch('/api/clusters?layer=poi').then((r) => (r.ok ? r.json() : Promise.reject())),
          fetch('/api/hotspots?layer=demographics').then((r) => (r.ok ? r.json() : Promise.reject())),
        ]);

        if (!isMounted) return;

        setData({
          h3Data: h3Res.status === 'fulfilled' ? h3Res.value : MOCK_H3,
          clusterData: clusterRes.status === 'fulfilled' ? clusterRes.value : MOCK_CLUSTERS,
          hotspotData: hotspotRes.status === 'fulfilled' ? hotspotRes.value : MOCK_HOTSPOTS,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        if (!isMounted) return;
        setData({
          h3Data: MOCK_H3,
          clusterData: MOCK_CLUSTERS,
          hotspotData: MOCK_HOTSPOTS,
          isLoading: false,
          error: err.message || 'Failed to load spatial analytics',
        });
      }
    }

    fetchAll();

    return () => {
      isMounted = false;
    };
  }, []);

  return data;
}
