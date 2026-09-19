/**
 * MapView Component — Main MapLibre GL map instance for GeoSpatial Site Readiness Analyzer.
 *
 * Owner: Daksh [D]
 */

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getHeatmapColorExpression, PALETTES } from '../utils/colors';

// Gujarat center coordinate & default bounds
const GUJARAT_CENTER = [72.5714, 23.0225]; // [lng, lat]
const DEFAULT_ZOOM = 6.8;

// Approximate Gujarat boundary polygon to frame the analysis zone
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

export default function MapView({
  onMapClick,
  activeLayers = {},
  layerData = {},
  layerOpacity = {},
  isochrone = null,
  hotspots = null,
  selectedLocation = null
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: GUJARAT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 5.5,
      maxZoom: 18,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      setMapLoaded(true);

      // Add Gujarat boundary highlight
      map.addSource('gujarat-boundary', {
        type: 'geojson',
        data: GUJARAT_OUTLINE_GEOJSON
      });

      map.addLayer({
        id: 'gujarat-boundary-line',
        type: 'line',
        source: 'gujarat-boundary',
        paint: {
          'line-color': '#00e5ff',
          'line-width': 1.5,
          'line-opacity': 0.6,
          'line-dasharray': [2, 2]
        }
      });
    });

    // Map click handler → emits lat/lng to parent
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
  }, [onMapClick]);

  // Update selected site marker on map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
      if (!markerRef.current) {
        // Create custom pulsating marker element
        const el = document.createElement('div');
        el.className = 'site-selection-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#00e5ff';
        el.style.border = '3px solid #ffffff';
        el.style.boxShadow = '0 0 15px #00e5ff, 0 0 30px #00e5ff';
        el.style.cursor = 'pointer';

        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([selectedLocation.lng, selectedLocation.lat])
          .addTo(mapRef.current);
      } else {
        markerRef.current.setLngLat([selectedLocation.lng, selectedLocation.lat]);
      }
    }
  }, [selectedLocation, mapLoaded]);

  // Sync GeoJSON layers with MapLibre sources and layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Standard layer rendering configurations
    const layerConfigs = [
      {
        id: 'demographics',
        type: 'heatmap',
        sourceId: 'src-demographics',
        layerId: 'layer-demographics',
        paint: (opacity) => ({
          'heatmap-opacity': opacity,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 10, 15, 30],
          'heatmap-color': getHeatmapColorExpression()
        })
      },
      {
        id: 'transportation',
        type: 'line',
        sourceId: 'src-transportation',
        layerId: 'layer-transportation',
        paint: (opacity) => ({
          'line-color': PALETTES.layerColors.transportation,
          'line-width': 2.5,
          'line-opacity': opacity
        })
      },
      {
        id: 'poi',
        type: 'circle',
        sourceId: 'src-poi',
        layerId: 'layer-poi',
        paint: (opacity) => ({
          'circle-radius': 6,
          'circle-color': PALETTES.layerColors.poi,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': opacity
        })
      },
      {
        id: 'landuse',
        type: 'fill',
        sourceId: 'src-landuse',
        layerId: 'layer-landuse',
        paint: (opacity) => ({
          'fill-color': PALETTES.layerColors.landuse,
          'fill-opacity': opacity * 0.5,
          'fill-outline-color': PALETTES.layerColors.landuse
        })
      },
      {
        id: 'environment',
        type: 'fill',
        sourceId: 'src-environment',
        layerId: 'layer-environment',
        paint: (opacity) => ({
          'fill-color': PALETTES.layerColors.environment,
          'fill-opacity': opacity * 0.45,
          'fill-outline-color': '#ff1744'
        })
      }
    ];

    layerConfigs.forEach((cfg) => {
      const isVisible = !!activeLayers[cfg.id];
      const data = layerData[cfg.id];
      const opacity = layerOpacity[cfg.id] ?? 0.8;

      // Check if source exists
      if (data && map.getSource(cfg.sourceId)) {
        map.getSource(cfg.sourceId).setData(data);
      } else if (data && !map.getSource(cfg.sourceId)) {
        map.addSource(cfg.sourceId, { type: 'geojson', data });
      }

      // Add layer if source exists and layer is missing
      if (map.getSource(cfg.sourceId) && !map.getLayer(cfg.layerId)) {
        map.addLayer({
          id: cfg.layerId,
          type: cfg.type,
          source: cfg.sourceId,
          layout: { visibility: isVisible ? 'visible' : 'none' },
          paint: cfg.paint(opacity)
        });
      }

      // Update visibility & opacity dynamically
      if (map.getLayer(cfg.layerId)) {
        map.setLayoutProperty(cfg.layerId, 'visibility', isVisible ? 'visible' : 'none');
        // Update opacity property
        const opacityProp = `${cfg.type}-opacity`;
        if (map.getPaintProperty(cfg.layerId, opacityProp) !== undefined) {
          map.setPaintProperty(cfg.layerId, opacityProp, opacity);
        }
      }
    });
  }, [activeLayers, layerData, layerOpacity, mapLoaded]);

  // Sync Isochrone polygons (from Maharshi)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (isochrone) {
      if (map.getSource('src-isochrone')) {
        map.getSource('src-isochrone').setData(isochrone);
      } else {
        map.addSource('src-isochrone', { type: 'geojson', data: isochrone });
        map.addLayer({
          id: 'layer-isochrone-fill',
          type: 'fill',
          source: 'src-isochrone',
          paint: {
            'fill-color': '#00e676',
            'fill-opacity': 0.25
          }
        });
        map.addLayer({
          id: 'layer-isochrone-line',
          type: 'line',
          source: 'src-isochrone',
          paint: {
            'line-color': '#00e676',
            'line-width': 2,
            'line-dasharray': [2, 1]
          }
        });
      }
    }
  }, [isochrone, mapLoaded]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#0f172a'
      }}
    />
  );
}
