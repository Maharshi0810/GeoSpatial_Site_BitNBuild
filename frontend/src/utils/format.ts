/**
 * Type-safe formatting utilities for coordinates, scores, population, and metrics.
 * Uses tabular mono formatting rules defined in the Section 4 design system.
 */

/**
 * Formats latitude and longitude coordinates to 5 decimal places.
 * Example: "23.02250° N, 72.57140° E"
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDirection = lat >= 0 ? 'N' : 'S';
  const lngDirection = lng >= 0 ? 'E' : 'W';
  const absLat = Math.abs(lat).toFixed(5);
  const absLng = Math.abs(lng).toFixed(5);
  return `${absLat}° ${latDirection}, ${absLng}° ${lngDirection}`;
}

/**
 * Returns plain coordinates with 5 decimal places.
 * Example: "23.02250, 72.57140"
 */
export function formatLatLngPlain(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Formats a score between 0 and 100 as an integer string.
 */
export function formatScore(score: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return clamped.toString();
}

/**
 * Formats a population count with standard thousands grouping.
 * Example: 45000 -> "45,000"
 */
export function formatPopulation(count: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(count));
}

/**
 * Formats distances in meters or kilometers.
 * Under 1000m: "450 m", 1000m and above: "2.4 km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

/**
 * Formats percentage value.
 * Example: 0.784 -> "78.4%"
 */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Formats duration in minutes.
 * Example: 15 -> "15 min"
 */
export function formatMinutes(minutes: number): string {
  return `${Math.round(minutes)} min`;
}

/**
 * Formats signed score contribution.
 * Example: 14.2 -> "+14.2", -6.8 -> "-6.8"
 */
export function formatContribution(val: number): string {
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
}
