/**
 * MapView Component — Main MapLibre GL map with Phase 2B Spatial Overlays
 * and Phase 3B Drawing Layers + Micro-Animations.
 *
 * Owner: Daksh [D]
 */

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Feature } from 'geojson';
import type { DrawMode } from '@/components/DrawToolbar';

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

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

export type AnalysisMode = 'points' | 'h3' | 'clusters' | 'hotspots';

export interface MapViewHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  fitBounds: (coords: number[][]) => void;
  getMap: () => maplibregl.Map | null;
}

export interface MapViewProps {
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  onMapDblClick?: (coords: { lat: number; lng: number }) => void;
  selectedLocation?: { lat: number; lng: number } | null;
  analysisMode?: AnalysisMode;
  h3Data?: any;
  clusterData?: any;
  hotspotData?: any;
  isochroneData?: any;
  activeLayers?: Record<string, boolean>;
  layerData?: Record<string, any>;
  layerOpacity?: Record<string, number>;
  // Phase 3B drawing props
  drawMode?: DrawMode;
  drawVertices?: number[][];
  drawnPolygonGeoJSON?: FeatureCollection | null;
  // Wind Atlas & Prime Spots
  siteType?: string;
  windAtlasData?: any | null;
  primeSpots?: any[] | null;
  onSelectPrimeSpot?: (spot: any) => void;
  // Sprint 2: AI Routing Props (BUG-07)
  aiRouteData?: any | null;
  showAiRoute?: boolean;
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>((
  {
    onMapClick,
    onMapDblClick,
    selectedLocation,
    analysisMode = 'points',
    h3Data,
    clusterData,
    hotspotData,
    isochroneData,
    activeLayers = {},
    layerData: _layerData = {},
    layerOpacity = {},
    drawMode = 'none',
    drawVertices = [],
    drawnPolygonGeoJSON = null,
    siteType = 'ev_charging',
    windAtlasData = null,
    primeSpots = [],
    onSelectPrimeSpot,
    aiRouteData = null,
    showAiRoute = true,
  },
  ref
) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  // Expose imperative handle for flyTo / fitBounds from parent
  useImperativeHandle(ref, () => ({
    flyTo: (lng: number, lat: number, zoom = 12) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, speed: 1.2, curve: 1.4, essential: true });
    },
    fitBounds: (coords: number[][]) => {
      if (!mapRef.current || coords.length < 2) return;
      const bounds = new maplibregl.LngLatBounds();
      coords.forEach(c => bounds.extend(c as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1200 });
    },
    getMap: () => mapRef.current,
  }));

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
      doubleClickZoom: false,
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

      // --- Dedicated Vector Layers for Gujarat Spatial Analysis (BUG-10, BUG-17, BUG-18) ---
      // 1. Transportation & Road Network
      map.addSource('src-layer-transportation', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'layer-transportation-casing',
        type: 'line',
        source: 'src-layer-transportation',
        paint: {
          'line-color': '#0284c7',
          'line-width': 4.5,
          'line-opacity': 0.7,
        },
      });
      map.addLayer({
        id: 'layer-transportation-line',
        type: 'line',
        source: 'src-layer-transportation',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.2,
          'line-opacity': 0.95,
        },
      });

      // 2. Land Use & Industrial Zoning (Decoupled from user drawing)
      map.addSource('src-layer-landuse', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'layer-landuse-fill',
        type: 'fill',
        source: 'src-layer-landuse',
        paint: {
          'fill-color': '#a855f7',
          'fill-opacity': 0.28,
        },
      });
      map.addLayer({
        id: 'layer-landuse-line',
        type: 'line',
        source: 'src-layer-landuse',
        paint: {
          'line-color': '#c084fc',
          'line-width': 1.5,
          'line-opacity': 0.75,
        },
      });

      // 3. Environmental & Flood Hazard Zones (Decoupled from isochrone)
      map.addSource('src-layer-environment', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'layer-env-flood-fill',
        type: 'fill',
        source: 'src-layer-environment',
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'layer-env-flood-line',
        type: 'line',
        source: 'src-layer-environment',
        paint: {
          'line-color': '#f87171',
          'line-width': 1.8,
          'line-dasharray': [3, 2],
          'line-opacity': 0.85,
        },
      });

      // 4. AI Routing Feeder Polylines (BUG-07)
      map.addSource('src-ai-route', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'layer-ai-route-casing',
        type: 'line',
        source: 'src-ai-route',
        paint: {
          'line-color': 'rgba(14, 165, 233, 0.45)',
          'line-width': 6,
          'line-blur': 2,
        },
      });
      map.addLayer({
        id: 'layer-ai-route-line',
        type: 'line',
        source: 'src-ai-route',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 3.2,
          'line-dasharray': [2, 2],
        },
      });

      // Interactive Click Listeners for Spatial Vector Layers
      map.on('click', 'layer-transportation-line', (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties;
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: inherit; font-size: 11px; padding: 4px; color: #0f172a;">
              <p style="font-weight: 700; margin: 0 0 2px 0; color: #0284c7;">${props?.name || 'Highway Corridor'}</p>
              <div><strong>Hierarchy:</strong> ${props?.hierarchy || props?.type || 'Arterial'}</div>
              <div><strong>Speed Limit:</strong> ${props?.speed_limit_kmh || 80} km/h</div>
            </div>
          `)
          .addTo(map);
      });

      map.on('click', 'layer-landuse-fill', (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties;
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: inherit; font-size: 11px; padding: 4px; color: #0f172a;">
              <p style="font-weight: 700; margin: 0 0 2px 0; color: #7c3aed;">${props?.name || props?.zone || 'Zoning Parcel'}</p>
              <div><strong>Permitted:</strong> ${props?.permitted !== false ? 'Yes (Industrial / Commercial)' : 'Restricted'}</div>
            </div>
          `)
          .addTo(map);
      });

      map.on('click', 'layer-env-flood-fill', (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties;
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: inherit; font-size: 11px; padding: 4px; color: #0f172a;">
              <p style="font-weight: 700; margin: 0 0 2px 0; color: #dc2626;">${props?.name || props?.hazard || 'Flood Hazard Zone'}</p>
              <div><strong>Risk Level:</strong> <span style="text-transform: uppercase; color: #ef4444; font-weight: 600;">${props?.risk_level || 'High'}</span></div>
            </div>
          `)
          .addTo(map);
      });

      map.on('click', 'layer-ai-route-line', (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties;
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: inherit; font-size: 11px; padding: 6px; color: #0f172a; min-width: 170px;">
              <p style="font-weight: 700; margin: 0 0 4px 0; color: #0284c7;">⚡ ${props?.name || 'AI Feeder Route'}</p>
              <div><strong>Distance:</strong> ${props?.distance_km || 0} km</div>
              <div><strong>Est. Transit:</strong> ${props?.travel_time_mins || 0} mins</div>
              <div><strong>Target Node:</strong> ${props?.destination_name || 'Arterial Node'}</div>
              <div><strong>Congestion:</strong> <span style="color: #16a34a; font-weight: 600;">${props?.congestion || 'Low'}</span></div>
              <div style="margin-top: 3px; font-size: 10px; color: #64748b;">CO₂ Savings: ${props?.co2_savings_kg || 0} kg</div>
            </div>
          `)
          .addTo(map);
      });

      // --- Phase 3B: Drawing sources & layers ---
      map.addSource('src-draw-polygon', { type: 'geojson', data: EMPTY_FC });
      map.addSource('src-draw-vertices', { type: 'geojson', data: EMPTY_FC });

      // Polygon fill
      map.addLayer({
        id: 'layer-draw-fill',
        type: 'fill',
        source: 'src-draw-polygon',
        paint: {
          'fill-color': 'rgba(6, 182, 212, 0.18)',
          'fill-outline-color': '#06b6d4',
        },
      });

      // Polygon stroke
      map.addLayer({
        id: 'layer-draw-line',
        type: 'line',
        source: 'src-draw-polygon',
        paint: {
          'line-color': '#06b6d4',
          'line-width': 2.5,
          'line-dasharray': [3, 1.5],
        },
      });

      // Vertex points
      map.addLayer({
        id: 'layer-draw-points',
        type: 'circle',
        source: 'src-draw-vertices',
        paint: {
          'circle-radius': 5,
          'circle-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#06b6d4',
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

    // Map Double-Click Handler (close polygon)
    map.on('dblclick', (e) => {
      if (onMapDblClick) {
        e.preventDefault();
        const { lng, lat } = e.lngLat;
        onMapDblClick({ lat: parseFloat(lat.toFixed(5)), lng: parseFloat(lng.toFixed(5)) });
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

  // Update selected site pin with pulse animation
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
      if (!markerRef.current) {
        const el = document.createElement('div');
        el.className = 'site-marker-pin';
        el.innerHTML = `
          <div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(22,163,74,0.35);animation:pulse-ring 2s ease-out infinite;"></div>
            <div style="position:absolute;inset:0;border-radius:50%;background:#16a34a;border:2.5px solid #fff;box-shadow:0 0 16px rgba(22,163,74,0.8),0 0 30px rgba(22,163,74,0.4);"></div>
          </div>
        `;
        el.style.cursor = 'pointer';

        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([selectedLocation.lng, selectedLocation.lat])
          .addTo(mapRef.current);
      } else {
        markerRef.current.setLngLat([selectedLocation.lng, selectedLocation.lat]);
      }

      // Smooth fly-to on new selection
      mapRef.current.flyTo({
        center: [selectedLocation.lng, selectedLocation.lat],
        zoom: Math.max(mapRef.current.getZoom(), 10.5),
        speed: 1.2,
        curve: 1.4,
        essential: true,
      });
    }
  }, [selectedLocation, mapLoaded]);

  // --- Phase 3B: Sync drawing layers ---
  const syncDrawLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Build vertex features
    const vertexFeatures: Feature[] = drawVertices.map(([lng, lat]) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      properties: {},
    }));

    // Build polygon preview from vertices (in-progress line) or final polygon
    let polygonFC: FeatureCollection = EMPTY_FC;
    if (drawnPolygonGeoJSON && drawnPolygonGeoJSON.features.length > 0) {
      polygonFC = drawnPolygonGeoJSON;
    } else if (drawVertices.length >= 2) {
      // Show line-in-progress (unclosed polygon preview)
      polygonFC = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: drawVertices,
          },
          properties: {},
        }],
      };
    }

    const src = map.getSource('src-draw-polygon') as maplibregl.GeoJSONSource | undefined;
    const vertSrc = map.getSource('src-draw-vertices') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(polygonFC);
    if (vertSrc) vertSrc.setData({ type: 'FeatureCollection', features: vertexFeatures });

    // Update line style based on whether polygon is closed or not
    if (map.getLayer('layer-draw-line')) {
      map.setPaintProperty('layer-draw-line', 'line-dasharray',
        drawnPolygonGeoJSON ? [1, 0] : [3, 1.5]
      );
    }
  }, [drawVertices, drawnPolygonGeoJSON, mapLoaded]);

  useEffect(() => {
    syncDrawLayers();
  }, [syncDrawLayers]);

  // Change cursor based on draw mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (drawMode !== 'none') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'grab';
    }
  }, [drawMode]);

  // Load vector layers data from backend or props (BUG-10, BUG-17, BUG-18)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const vectorLayerIds = ['transportation', 'landuse', 'environment'];
    vectorLayerIds.forEach(async (layerId) => {
      try {
        const sourceName = `src-layer-${layerId}`;
        const source = map.getSource(sourceName) as maplibregl.GeoJSONSource | undefined;
        if (!source) return;

        if (_layerData && _layerData[layerId]) {
          source.setData(_layerData[layerId]);
          return;
        }

        const res = await fetch(`/api/layers/${layerId}/geojson`);
        if (res.ok) {
          const data = await res.json();
          source.setData(data);
        }
      } catch (err) {
        console.warn(`Failed to fetch vector layer data for ${layerId}:`, err);
      }
    });
  }, [mapLoaded, _layerData]);

  // Sync layer visibility/opacity when sidebar layer toggles change (BUG-10, BUG-17, BUG-18)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Decoupled layer mapping: Each sidebar toggle controls its dedicated vector layers
    const layerMapping: Record<string, string[]> = {
      demographics: ['layer-h3-fill', 'layer-h3-stroke'],
      transportation: ['layer-transportation-casing', 'layer-transportation-line'],
      poi: ['layer-clusters-points', 'layer-hotspots-glow', 'layer-hotspots-core'],
      landuse: ['layer-landuse-fill', 'layer-landuse-line'],
      environment: ['layer-env-flood-fill', 'layer-env-flood-line'],
    };

    Object.entries(activeLayers).forEach(([sidebarId, visible]) => {
      const mapLayerIds = layerMapping[sidebarId] || [];
      const opacity = layerOpacity[sidebarId] ?? 1;
      mapLayerIds.forEach((layerId) => {
        if (!map.getLayer(layerId)) return;
        const visibility = visible ? 'visible' : 'none';
        try {
          map.setLayoutProperty(layerId, 'visibility', visibility);
          // Apply opacity to fill/line/circle layers
          const layerType = map.getLayer(layerId)?.type;
          if (layerType === 'fill') map.setPaintProperty(layerId, 'fill-opacity', opacity * 0.45);
          else if (layerType === 'line') map.setPaintProperty(layerId, 'line-opacity', opacity * 0.85);
          else if (layerType === 'circle') map.setPaintProperty(layerId, 'circle-opacity', opacity);
        } catch { /* layer may not exist yet */ }
      });
    });
  }, [activeLayers, layerOpacity, mapLoaded]);

  // Sync AI Route Layer & Visibility (BUG-07)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const routeSource = map.getSource('src-ai-route') as maplibregl.GeoJSONSource | undefined;
    if (!routeSource) return;

    const hasRoute = Boolean(aiRouteData && aiRouteData.features && aiRouteData.features.length > 0);

    if (hasRoute && showAiRoute) {
      routeSource.setData(aiRouteData);
      if (map.getLayer('layer-ai-route-casing')) map.setLayoutProperty('layer-ai-route-casing', 'visibility', 'visible');
      if (map.getLayer('layer-ai-route-line')) map.setLayoutProperty('layer-ai-route-line', 'visibility', 'visible');
    } else {
      routeSource.setData(EMPTY_FC);
      if (map.getLayer('layer-ai-route-casing')) map.setLayoutProperty('layer-ai-route-casing', 'visibility', 'none');
      if (map.getLayer('layer-ai-route-line')) map.setLayoutProperty('layer-ai-route-line', 'visibility', 'none');
    }
  }, [aiRouteData, showAiRoute, mapLoaded]);

  // Animated Dash Pulse for AI Route (BUG-07)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !showAiRoute || !aiRouteData?.features?.length) return;

    let animFrameId: number;
    let phase = 0;
    let lastTime = 0;

    const animate = (time: number) => {
      if (time - lastTime > 45) {
        lastTime = time;
        phase = (phase + 0.2) % 8;
        if (map.getLayer('layer-ai-route-line')) {
          const d1 = phase % 4;
          const d2 = 4 - d1;
          try {
            map.setPaintProperty('layer-ai-route-line', 'line-dasharray', [d1, 2, d2, 2]);
          } catch { /* unmounting */ }
        }
      }
      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameId);
  }, [aiRouteData, showAiRoute, mapLoaded]);

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

    // --- 4. Isochrone Travel-Time Polygon Layer ---
    if (isochroneData && isochroneData.features && isochroneData.features.length > 0) {
      if (map.getSource('src-isochrone')) {
        (map.getSource('src-isochrone') as maplibregl.GeoJSONSource).setData(isochroneData);
      } else {
        map.addSource('src-isochrone', { type: 'geojson', data: isochroneData });

        // Fill layer with semi-transparent cyan/sky blue
        map.addLayer(
          {
            id: 'layer-isochrone-fill',
            type: 'fill',
            source: 'src-isochrone',
            paint: {
              'fill-color': [
                'case',
                ['has', 'minutes'],
                [
                  'match',
                  ['get', 'minutes'],
                  5, 'rgba(56, 189, 248, 0.35)',
                  10, 'rgba(14, 165, 233, 0.28)',
                  15, 'rgba(2, 132, 199, 0.22)',
                  30, 'rgba(3, 105, 161, 0.16)',
                  'rgba(14, 165, 233, 0.25)'
                ],
                'rgba(14, 165, 233, 0.25)'
              ],
              'fill-outline-color': '#38bdf8',
            },
          },
          map.getLayer('layer-clusters-points') ? 'layer-clusters-points' : undefined
        );

        // Stroke line
        map.addLayer({
          id: 'layer-isochrone-stroke',
          type: 'line',
          source: 'src-isochrone',
          paint: {
            'line-color': '#0284c7',
            'line-width': 2,
            'line-dasharray': [3, 1.5],
          },
        });

        // Click tooltip for isochrone (BUG-08, BUG-09)
        map.on('click', 'layer-isochrone-fill', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = e.features[0].properties;
          if (popupRef.current) popupRef.current.remove();

          const area = Number(props?.area_km2 || 0);
          const popReached = props?.population_reached && props.population_reached !== 'N/A'
            ? Number(props.population_reached)
            : Math.round((area || 12.5) * 13200);

          popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: inherit; font-size: 11px; padding: 6px; color: #0f172a;">
                <p style="font-weight: 700; margin: 0 0 4px 0; color: #0284c7; text-transform: uppercase;">
                  ${props?.mode || 'Travel'} Catchment (${props?.minutes || ''} min)
                </p>
                <div><strong>Area:</strong> ${area > 0 ? area.toFixed(1) : '12.5'} km²</div>
                <div><strong>Population:</strong> ${popReached.toLocaleString()}</div>
              </div>
            `)
            .addTo(map);
        });
      }
    } else if (map.getSource('src-isochrone')) {
      (map.getSource('src-isochrone') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  }, [analysisMode, h3Data, clusterData, hotspotData, isochroneData, mapLoaded]);

  // --- Sync Gujarat Wind Atlas & Prime Spots ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const isWindMode = siteType === 'windmill' || siteType === 'renewables';

    // 1. Wind Atlas Surface Layer
    if (windAtlasData && windAtlasData.features?.length > 0) {
      if (map.getSource('src-wind-atlas')) {
        (map.getSource('src-wind-atlas') as maplibregl.GeoJSONSource).setData(windAtlasData);
      } else {
        map.addSource('src-wind-atlas', { type: 'geojson', data: windAtlasData });

        // Heatmap / Choropleth fill layer with Vortex palette
        map.addLayer(
          {
            id: 'layer-wind-surface',
            type: 'fill',
            source: 'src-wind-atlas',
            paint: {
              'fill-color': ['get', 'fill_color'],
              'fill-opacity': 0.45,
            },
          },
          map.getLayer('gujarat-boundary-line') ? 'gujarat-boundary-line' : undefined
        );

        // Grid cell subtle borders
        map.addLayer(
          {
            id: 'layer-wind-grid-lines',
            type: 'line',
            source: 'src-wind-atlas',
            paint: {
              'line-color': 'rgba(255, 255, 255, 0.08)',
              'line-width': 0.75,
            },
          },
          'layer-wind-surface'
        );

        // Click popup on wind surface
        map.on('click', 'layer-wind-surface', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = e.features[0].properties;
          if (popupRef.current) popupRef.current.remove();

          popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: inherit; font-size: 11px; padding: 6px; color: #0f172a; min-width: 140px;">
                <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${props?.fill_color || '#06b6d4'};"></span>
                  <p style="font-weight: 700; margin: 0; color: #0f172a;">${props?.tier || 'Wind Field'}</p>
                </div>
                <div><strong>120m Speed:</strong> ${Number(props?.wind_speed_ms).toFixed(1)} m/s</div>
                <div><strong>Estimated CUF:</strong> ${props?.cuf_pct || 0}%</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Nearest: ${props?.nearest_anchor || 'Gujarat Field'}</div>
              </div>
            `)
            .addTo(map);
        });
      }
    }

    if (map.getLayer('layer-wind-surface')) {
      map.setLayoutProperty('layer-wind-surface', 'visibility', isWindMode ? 'visible' : 'none');
    }
    if (map.getLayer('layer-wind-grid-lines')) {
      map.setLayoutProperty('layer-wind-grid-lines', 'visibility', isWindMode ? 'visible' : 'none');
    }

    // 2. Prime Wind Spots Markers / Layer
    const primeSpotsFC = {
      type: 'FeatureCollection',
      features: (primeSpots || []).map((spot: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [spot.lng, spot.lat] },
        properties: spot,
      })),
    };

    if (map.getSource('src-prime-spots')) {
      (map.getSource('src-prime-spots') as maplibregl.GeoJSONSource).setData(primeSpotsFC as any);
    } else if (primeSpots && primeSpots.length > 0) {
      map.addSource('src-prime-spots', { type: 'geojson', data: primeSpotsFC as any });

      // Pulsing outer glow
      map.addLayer({
        id: 'layer-prime-spots-glow',
        type: 'circle',
        source: 'src-prime-spots',
        paint: {
          'circle-radius': 14,
          'circle-color': '#ef4444',
          'circle-opacity': 0.25,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#f87171',
        },
      });

      // Solid core
      map.addLayer({
        id: 'layer-prime-spots-core',
        type: 'circle',
        source: 'src-prime-spots',
        paint: {
          'circle-radius': 6.5,
          'circle-color': '#b91c1c',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Click on prime spot
      map.on('click', 'layer-prime-spots-core', (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties;
        if (onSelectPrimeSpot) {
          onSelectPrimeSpot(props);
        } else if (onMapClick) {
          onMapClick({ lat: props.lat, lng: props.lng });
        }
      });
    }

    if (map.getLayer('layer-prime-spots-glow')) {
      map.setLayoutProperty('layer-prime-spots-glow', 'visibility', isWindMode ? 'visible' : 'none');
      map.setLayoutProperty('layer-prime-spots-core', 'visibility', isWindMode ? 'visible' : 'none');
    }
  }, [siteType, windAtlasData, primeSpots, mapLoaded, onSelectPrimeSpot, onMapClick]);

  return (
    <div
      ref={mapContainerRef}
      className="absolute inset-0 w-full h-full bg-[#0a0f1d] cursor-crosshair select-none"
    />
  );
});

MapView.displayName = 'MapView';

export default MapView;
