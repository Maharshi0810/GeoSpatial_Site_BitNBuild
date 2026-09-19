/**
 * Color palettes and scale utilities for GeoSpatial map rendering.
 *
 * Owner: Daksh [D]
 */

export const PALETTES = {
  // Heatmap sequential gradient (Cold to Hot)
  heatmapRamp: [
    'rgba(0, 229, 255, 0)',     // Transparent cyan
    '#00e5ff',                  // Cyan
    '#00e676',                  // Bright Green
    '#ffd600',                  // Amber Yellow
    '#ff9100',                  // Orange
    '#ff1744'                   // Vivid Red
  ],

  // Getis-Ord Gi* Diverging Palette (Cold Spot -> Neutral -> Hot Spot)
  hotspotDiverging: {
    cold99: '#0d47a1',          // 99% Cold spot
    cold95: '#1e88e5',          // 95% Cold spot
    cold90: '#64b5f6',          // 90% Cold spot
    neutral: '#455a64',         // Not significant
    hot90: '#ffb74d',           // 90% Hot spot
    hot95: '#f57c00',           // 95% Hot spot
    hot99: '#d50000'            // 99% Hot spot
  },

  // DBSCAN Cluster Categorical Colors
  clusters: [
    '#00f5d4',
    '#7b2cbf',
    '#ff007f',
    '#fee440',
    '#00bbf9',
    '#9b5de5',
    '#f15bb5',
    '#38b000'
  ],

  // Layer default theme accents
  layerColors: {
    demographics: '#ff7043',
    transportation: '#29b6f6',
    poi: '#66bb6a',
    landuse: '#ab47bc',
    environment: '#ef5350'
  },

  // Isochrone time-band ramps (drive-time intervals)
  isochrone: {
    '10': 'rgba(0, 230, 118, 0.35)',   // 10 min - Green
    '20': 'rgba(255, 214, 0, 0.30)',   // 20 min - Yellow
    '30': 'rgba(255, 61, 0, 0.25)'     // 30 min - Red
  }
};

/**
 * Returns an interpolated MapLibre GL color expression for heatmap density.
 */
export function getHeatmapColorExpression() {
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(0, 229, 255, 0)',
    0.2, '#00e5ff',
    0.4, '#00e676',
    0.6, '#ffd600',
    0.8, '#ff9100',
    1.0, '#ff1744'
  ];
}
