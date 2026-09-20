/**
 * Geocoding and Reverse Geocoding Service for GeoVista.
 * Resolves GPS coordinates into human-readable place, ward, or taluk names.
 */

export interface GeocodedLocation {
  name: string;
  subTitle?: string;
  district?: string;
  lat: number;
  lng: number;
}

// In-memory cache for client-side instant lookups
const clientReverseCache = new Map<string, GeocodedLocation>();

// Curated Gujarat Regional Centers for fast offline fallback
const GUJARAT_REGION_CENTERS = [
  { name: "SG Highway Corridor, Ahmedabad", district: "Ahmedabad", lat: 23.0378, lng: 72.5112 },
  { name: "Bodakdev - Vastrapur, Ahmedabad", district: "Ahmedabad", lat: 23.0373, lng: 72.5074 },
  { name: "GIFT City, Gandhinagar", district: "Gandhinagar", lat: 23.1601, lng: 72.6841 },
  { name: "Gandhinagar Central", district: "Gandhinagar", lat: 23.2156, lng: 72.6369 },
  { name: "Dehgam, Gandhinagar", district: "Gandhinagar", lat: 23.2584, lng: 72.9817 },
  { name: "Sanand Industrial Zone, Ahmedabad", district: "Ahmedabad Rural", lat: 22.9868, lng: 72.3814 },
  { name: "Vadodara Central", district: "Vadodara", lat: 22.3072, lng: 73.1812 },
  { name: "Surat Central & Ring Road", district: "Surat", lat: 21.1959, lng: 72.8302 },
  { name: "Rajkot Central", district: "Rajkot", lat: 22.3039, lng: 70.8022 },
  { name: "Bhavnagar Urban", district: "Bhavnagar", lat: 21.7645, lng: 72.1519 },
  { name: "Jamnagar Urban", district: "Jamnagar", lat: 22.4707, lng: 70.0724 },
  { name: "Mundra Port Zone, Kutch", district: "Kutch", lat: 22.8394, lng: 69.7214 },
  { name: "Bhuj, Kutch", district: "Kutch", lat: 23.2420, lng: 69.6669 },
  { name: "Ankleshwar GIDC, Bharuch", district: "Bharuch", lat: 21.6264, lng: 73.0031 },
  { name: "Vapi GIDC, Valsad", district: "Valsad", lat: 20.3893, lng: 72.9106 },
  { name: "Morbi Industrial Cluster", district: "Morbi", lat: 22.8120, lng: 70.8380 },
  { name: "Dholera SIR, Ahmedabad Rural", district: "Ahmedabad Rural", lat: 22.2472, lng: 72.1908 },
];

/**
 * Checks if a string looks like raw coordinates or coordinate fallback placeholder.
 */
export function isCoordinateString(text?: string | null): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  return (
    trimmed.startsWith("Custom Site (") ||
    trimmed.startsWith("Candidate Site (") ||
    trimmed.startsWith("Site at ") ||
    trimmed.startsWith("Water Body at ") ||
    trimmed.startsWith("Coordinates:") ||
    /^\s*[-+]?\d+(\.\d+)?\s*,\s*[-+]?\d+(\.\d+)?\s*$/.test(trimmed)
  );
}

/**
 * Reverse geocodes latitude and longitude into a clean, human-readable Gujarat place name.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation> {
  const roundedLat = Number(lat.toFixed(4));
  const roundedLng = Number(lng.toFixed(4));
  const cacheKey = `${roundedLat},${roundedLng}`;

  if (clientReverseCache.has(cacheKey)) {
    return clientReverseCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(`/api/reverse-geocode?lat=${roundedLat}&lng=${roundedLng}`);
    if (res.ok) {
      const json = await res.json();
      const data = json.data;
      if (data && data.name && !isCoordinateString(data.name)) {
        const result: GeocodedLocation = {
          name: data.name,
          subTitle: data.subTitle || `${data.district || "Gujarat"}, India`,
          district: data.district,
          lat: roundedLat,
          lng: roundedLng,
        };
        clientReverseCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Network or backend unavailable; fallback to offline heuristic below
  }

  // Offline Heuristic: Find closest known Gujarat landmark or district
  let bestDist = Infinity;
  let nearest = GUJARAT_REGION_CENTERS[0];
  for (const center of GUJARAT_REGION_CENTERS) {
    const d = Math.hypot(center.lat - roundedLat, center.lng - roundedLng);
    if (d < bestDist) {
      bestDist = d;
      nearest = center;
    }
  }

  let resolvedName: string;
  if (bestDist < 0.08) {
    // Within ~8km
    resolvedName = nearest.name;
  } else if (bestDist < 0.25) {
    // Within ~25km
    resolvedName = `Near ${nearest.name}`;
  } else {
    resolvedName = `${nearest.district} District Region`;
  }

  const fallbackResult: GeocodedLocation = {
    name: resolvedName,
    subTitle: `GPS: ${roundedLat}° N, ${roundedLng}° E • ${nearest.district}, Gujarat`,
    district: nearest.district,
    lat: roundedLat,
    lng: roundedLng,
  };

  clientReverseCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}
