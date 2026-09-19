/**
 * MapView Component — Main MapLibre GL map instance with Phase 2B Spatial Analytics Overlays.
 *
 * Owner: Daksh [D]
 */

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Gujarat center coordinate & default bounds
const GUJARAT_CENTER: [number, number] = [72.5714, 23.0225]; // [lng, lat]
const DEFAULT_ZOOM = 6.8;

// Gujarat boundary polygon outline
const GUJARAT_OUTLINE_GEOJSON = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [68.16, 23.71], [68.80, 24.50], [70.50, 24.60], [71.50, 24.70],
      [72.80, 24.50], [73.50, 24.00], [74.40, 23.50], [74.48, 22.00],
      [73.80, 21.30], [73.00, 20.30], [72.80, 20.12], [72.40, 21.00],
      [72.20, 21.70], [71.50, 20.80], [70.80, 20.70], [69.60, 21.50],
      [68.90, 22.30], [69.40, 22.80], [70.20, 23.00], [69.80, 23.40],
      [68.16, 23.71]
    ]]
  }
};

export type AnalysisMode = 'points' | 'h3' | 'clusters' | 'hotspots';

export interface MapViewProps {
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  selectedLocation?: { lat: number; lng: number } | null;
  analysisMode?: AnalysisMode;
  h3Data?: any;
  clusterData?: any;
  hotspotData?: any;
  activeLayers?: Record<string, boolean>;
  layerData?: Record<string, any>;
  layerOpacity?: Record<string, number>;
}

export const MapView: React.FC<MapViewProps> = ({
  onMapClick,
  selectedLocation,
  analysisMode = 'points',
  h3Data,
  clusterData,
  hotspotData,
  activeLayers: _activeLayers = {},
  layerData: _layerData = {},
  layerOpacity: _layerOpacity = {},
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  // Initialize MapLibre GL
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: selectedLocation ? [selectedLocation.lng, selectedLocation.lat] : GUJARAT_CENTER,
      zoom: selectedLocation ? 10.5 : DEFAULT_ZOOM,
      minZoom: 5.5,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      setMapLoaded(true);

      // Gujarat state boundary outline
      map.addSource('gujarat-boundary', {
        type: 'geojson',
        data: GUJARAT_OUTLINE_GEOJSON as any,
      });

      map.addLayer({
        id: 'gujarat-boundary-line',
        type: 'line',
        source: 'gujarat-boundary',
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 1.5,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
        },
      });
    });

    // Map Click Handler
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      if (onMapClick) {
        onMapClick({ lat: parseFloat(lat.toFixed(5)), lng: parseFloat(lng.toFixed(5)) });
      }
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update selected site pin with pulse effect
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
      if (!markerRef.current) {
        const el = document.createElement('div');
        el.className = 'site-marker-pin';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#16a34a';
        el.style.border = '2.5px solid #ffffff';
        el.style.boxShadow = '0 0 16px rgba(22, 163, 74, 0.8), 0 0 30px rgba(22, 163, 74, 0.4)';
        el.style.cursor = 'pointer';

        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([selectedLocation.lng, selectedLocation.lat])
          .addTo(mapRef.current);
      } else {
        markerRef.current.setLngLat([selectedLocation.lng, selectedLocation.lat]);
      }
    }
  }, [selectedLocation, mapLoaded]);

  // Sync Phase 2B Spatial Analysis Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // --- 1. H3 Hexagonal Grid Layer ---
    if (h3Data && h3Data.features?.length > 0) {
      if (map.getSource('src-h3')) {
        (map.getSource('src-h3') as maplibregl.GeoJSONSource).setData(h3Data);
      } else {
        map.addSource('src-h3', { type: 'geojson', data: h3Data });

        // Fill layer with choropleth gradient
        map.addLayer({
          id: 'layer-h3-fill',
          type: 'fill',
          source: 'src-h3',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'avg_value'],
              0, 'rgba(6, 182, 212, 0.25)',
              0.5, 'rgba(245, 158, 11, 0.4)',
              1.0, 'rgba(239, 68, 68, 0.65)'
            ],
            'fill-opacity': 0.75,
          },
        });

        // Hexagon border lines
        map.addLayer({
          id: 'layer-h3-stroke',
          type: 'line',
          source: 'src-h3',
          paint: {
            'line-color': '#38bdf8',
            'line-width': 1.2,
            'line-opacity': 0.8,
          },
        });

        // Interactive hover tooltip for H3
        map.on('click', 'layer-h3-fill', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = e.features[0].properties;
          if (popupRef.current) popupRef.current.remove();

          popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: inherit; font-size: 11px; padding: 4px; color: #0f172a;">
                <p style="font-weight: 700; margin: 0 0 4px 0; color: #0284c7;">H3 Hexagon ${props?.hex_id || ''}</p>
                <div><strong>Value:</strong> ${(Number(props?.avg_value) * 100).toFixed(1)}%</div>
                <div><strong>Point Count:</strong> ${props?.count || 0}</div>
              </div>
            `)
            .addTo(map);
        });
      }
    }

    // Toggle H3 visibility
    const isH3Visible = analysisMode === 'h3';
    if (map.getLayer('layer-h3-fill')) {
      map.setLayoutProperty('layer-h3-fill', 'visibility', isH3Visible ? 'visible' : 'none');
      map.setLayoutProperty('layer-h3-stroke', 'visibility', isH3Visible ? 'visible' : 'none');
    }

    // --- 2. DBSCAN Cluster Layer ---
    if (clusterData && clusterData.features?.length > 0) {
      if (map.getSource('src-clusters')) {
        (map.getSource('src-clusters') as maplibregl.GeoJSONSource).setData(clusterData);
      } else {
        map.addSource('src-clusters', { type: 'geojson', data: clusterData });

        map.addLayer({
          id: 'layer-clusters-points',
          type: 'circle',
          source: 'src-clusters',
          paint: {
            'circle-radius': 7,
            'circle-color': [
              'match',
              ['get', 'cluster_id'],
              0, '#3b82f6',
              1, '#10b981',
              2, '#f59e0b',
              3, '#8b5cf6',
              '#64748b' // noise color
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Hover tooltip for clusters
        map.on('click', 'layer-clusters-points', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = e.features[0].properties;
          if (popupRef.current) popupRef.current.remove();

          popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: inherit; font-size: 11px; padding: 4px; color: #0f172a;">
                <p style="font-weight: 700; margin: 0 0 2px 0;">${props?.name || 'POI Cluster'}</p>
                <div style="color: #64748b;">${props?.cluster_label || 'Cluster'}</div>
              </div>
            `)
            .addTo(map);
        });
      }
    }

    const isClustersVisible = analysisMode === 'clusters';
    if (map.getLayer('layer-clusters-points')) {
      map.setLayoutProperty('layer-clusters-points', 'visibility', isClustersVisible ? 'visible' : 'none');
    }

    // --- 3. Getis-Ord Gi* Hotspot Layer ---
    if (hotspotData && hotspotData.features?.length > 0) {
      if (map.getSource('src-hotspots')) {
        (map.getSource('src-hotspots') as maplibregl.GeoJSONSource).setData(hotspotData);
      } else {
        map.addSource('src-hotspots', { type: 'geojson', data: hotspotData });

        // Glowing outer circle for hotspot significance
        map.addLayer({
          id: 'layer-hotspots-glow',
          type: 'circle',
          source: 'src-hotspots',
          paint: {
            'circle-radius': 14,
            'circle-color': [
              'match',
              ['get', 'classification'],
              'hot', 'rgba(239, 68, 68, 0.3)',
              'cold', 'rgba(59, 130, 246, 0.3)',
              'rgba(148, 163, 184, 0.15)'
            ],
            'circle-blur': 0.6,
          },
        });

        // Crisp inner circle
        map.addLayer({
          id: 'layer-hotspots-core',
          type: 'circle',
          source: 'src-hotspots',
          paint: {
            'circle-radius': 6.5,
            'circle-color': [
              'match',
              ['get', 'classification'],
              'hot', '#ef4444',
              'cold', '#3b82f6',
              '#94a3b8'
            ],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Hover tooltip for hotspots
        map.on('click', 'layer-hotspots-core', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = e.features[0].properties;
          if (popupRef.current) popupRef.current.remove();

          popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: inherit; font-size: 11px; padding: 4px; color: #0f172a;">
                <p style="font-weight: 700; margin: 0 0 2px 0;">${props?.name || 'Spot'}</p>
                <div><strong>Classification:</strong> <span style="text-transform: uppercase; color: ${props?.classification === 'hot' ? '#ef4444' : props?.classification === 'cold' ? '#3b82f6' : '#64748b'}; font-weight: 600;">${props?.classification}</span></div>
                <div><strong>Z-Score:</strong> ${props?.z_score} (p=${props?.p_value})</div>
                <div><strong>Confidence:</strong> ${props?.confidence}%</div>
              </div>
            `)
            .addTo(map);
        });
      }
    }

    const isHotspotsVisible = analysisMode === 'hotspots';
    if (map.getLayer('layer-hotspots-glow')) {
      map.setLayoutProperty('layer-hotspots-glow', 'visibility', isHotspotsVisible ? 'visible' : 'none');
      map.setLayoutProperty('layer-hotspots-core', 'visibility', isHotspotsVisible ? 'visible' : 'none');
    }
  }, [analysisMode, h3Data, clusterData, hotspotData, mapLoaded]);

  return (
    <div
      ref={mapContainerRef}
      className="absolute inset-0 w-full h-full bg-[#0a0f1d] cursor-crosshair select-none"
    />
  );
};

export default MapView;
