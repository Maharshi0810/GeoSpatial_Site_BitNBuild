"""Isochrone Travel-Time Polygon Generator.

Owner: Maharshi [R]
Role: Generates multi-modal travel time envelopes (drive, walk, cycle)
      using OpenRouteService API when configured, with high-fidelity
      network-attenuated spatial approximation fallback.
"""

import math
import os
import random
from typing import Dict, Any, List, Optional, Tuple

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

try:
    from backend.config import DATA_DIR
    from backend.utils.geo_helpers import haversine_distance, EARTH_RADIUS_KM
except ImportError:
    from config import DATA_DIR
    from utils.geo_helpers import haversine_distance, EARTH_RADIUS_KM

# Travel mode average speeds in km/h
SPEED_PROFILES = {
    "driving": 42.0,       # Urban/suburban blended traffic speed in Gujarat
    "walking": 4.5,        # Pedestrian average walking speed
    "cycling": 15.0,       # Urban bicycle speed
}

# ORS API mapping
ORS_PROFILE_MAP = {
    "driving": "driving-car",
    "walking": "foot-walking",
    "cycling": "cycling-regular"
}

# Band colors for progressive multi-ring visualization
BAND_COLORS = {
    5: "#38bdf8",    # Light cyan / 5 min
    10: "#0284c7",   # Sky blue / 10 min
    15: "#0369a1",   # Deep blue / 15 min
    30: "#075985",   # Navy / 30 min
    45: "#1e3a8a",   # Dark navy / 45 min
    60: "#172554",   # Midnight blue / 60 min
}

# In-memory cache for repeated coordinate evaluations
_ISOCHRONE_CACHE: Dict[str, Dict[str, Any]] = {}


def _get_cache_key(lat: float, lng: float, minutes: int, mode: str) -> str:
    return f"{round(lat, 4)}_{round(lng, 4)}_{minutes}_{mode}"


def _approximate_polygon_area_km2(coordinates: List[List[float]]) -> float:
    """Calculate approximate spherical polygon area in square kilometers."""
    if len(coordinates) < 3:
        return 0.0

    # Project coordinates to meters using equirectangular projection centered at mean lat
    lats = [pt[1] for pt in coordinates]
    lons = [pt[0] for pt in coordinates]
    mean_lat = math.radians(sum(lats) / len(lats))
    
    # 1 deg lat ~ 111.139 km, 1 deg lon ~ 111.139 * cos(mean_lat) km
    kx = 111.139 * math.cos(mean_lat)
    ky = 111.139

    area = 0.0
    n = len(coordinates)
    for i in range(n - 1):
        x1 = coordinates[i][0] * kx
        y1 = coordinates[i][1] * ky
        x2 = coordinates[i + 1][0] * kx
        y2 = coordinates[i + 1][1] * ky
        area += (x1 * y2) - (x2 * y1)

    return round(abs(area) * 0.5, 2)


def generate_network_attenuated_polygon(
    lat: float,
    lng: float,
    minutes: int,
    mode: str = "driving",
    num_vertices: int = 48
) -> List[List[float]]:
    """Generate a realistic, non-circular road-network biased polygon.
    
    In Gujarat's arterial network (SG Highway, NH-48, Ring Roads), travel stretches
    predominantly along North-East / South-West and North / South axes, while
    lateral movement through dense local streets experiences network impedance.
    """
    speed_kmh = SPEED_PROFILES.get(mode, 40.0)
    nominal_radius_km = speed_kmh * (minutes / 60.0)

    # Road network orientation bias (SG Highway runs ~30 degrees NE)
    arterial_angle = math.radians(35.0)

    # Seed pseudorandomness deterministically per coordinate for repeatable shapes
    seed = int(abs(lat * 10000) + abs(lng * 10000) + minutes * 17)
    rng = random.Random(seed)

    coords: List[List[float]] = []
    
    # Sample around the 360 degree circle
    for i in range(num_vertices):
        theta = (2.0 * math.pi * i) / num_vertices

        # Arterial elongation along primary road axes (two perpendicular axes)
        arterial_boost = 1.0 + 0.32 * math.cos(2.0 * (theta - arterial_angle))

        # Secondary urban density variance
        density_drag = 0.90 + 0.12 * math.sin(3.0 * theta)

        # Micro road turn impedance (deterministic jitter)
        jitter = rng.uniform(0.92, 1.08)

        # Walking is more isotropic; driving is highly directional
        mode_anisotropy = 1.0 if mode == "driving" else (0.4 if mode == "cycling" else 0.15)
        effective_radius = nominal_radius_km * (1.0 + (arterial_boost * density_drag - 1.0) * mode_anisotropy) * jitter

        # Convert radius in km to delta degrees
        delta_lat = (effective_radius / EARTH_RADIUS_KM) * (180.0 / math.pi)
        delta_lng = delta_lat / math.cos(math.radians(lat))

        pt_lat = lat + delta_lat * math.sin(theta)
        pt_lng = lng + delta_lng * math.cos(theta)

        coords.append([round(pt_lng, 6), round(pt_lat, 6)])

    # Close polygon ring
    coords.append(coords[0])
    return coords


def query_openrouteservice(
    lat: float,
    lng: float,
    minutes: int,
    mode: str = "driving",
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Attempt live isochrone fetch via OpenRouteService API."""
    key = api_key or os.getenv("ORS_API_KEY")
    if not key or not REQUESTS_AVAILABLE:
        return None

    profile = ORS_PROFILE_MAP.get(mode, "driving-car")
    url = f"https://api.openrouteservice.org/v2/isochrones/{profile}"
    
    body = {
        "locations": [[lng, lat]],
        "range": [minutes * 60],
        "range_type": "time",
        "attributes": ["area", "reachfactor"]
    }
    headers = {
        "Authorization": key,
        "Content-Type": "application/json"
    }

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass

    return None


def compute_isochrone(
    lat: float,
    lng: float,
    minutes: int = 15,
    mode: str = "driving",
    intervals: Optional[List[int]] = None
) -> Dict[str, Any]:
    """Compute travel-time isochrone FeatureCollection.
    
    Args:
        lat, lng: Candidate point coordinates
        minutes: Target travel time threshold (e.g. 15 min)
        mode: 'driving', 'walking', or 'cycling'
        intervals: Optional multi-band intervals (e.g. [5, 10, 15])
        
    Returns:
        GeoJSON FeatureCollection of contour Polygons with metadata
    """
    mins = max(5, min(minutes, 60))
    mode_clean = mode.lower() if mode in SPEED_PROFILES else "driving"
    
    # Check cache for single band
    cache_key = _get_cache_key(lat, lng, mins, mode_clean)
    if not intervals and cache_key in _ISOCHRONE_CACHE:
        return _ISOCHRONE_CACHE[cache_key]

    target_intervals = sorted(intervals) if intervals else [mins]
    features = []

    # Try live OpenRouteService for outer interval if configured
    live_ors_result = None
    if len(target_intervals) == 1:
        live_ors_result = query_openrouteservice(lat, lng, mins, mode_clean)

    if live_ors_result and "features" in live_ors_result:
        for f in live_ors_result["features"]:
            coords = f.get("geometry", {}).get("coordinates", [[]])[0]
            area_val = _approximate_polygon_area_km2(coords)
            f["properties"] = {
                **f.get("properties", {}),
                "minutes": mins,
                "mode": mode_clean,
                "area_km2": area_val,
                "provider": "openrouteservice",
                "color": BAND_COLORS.get(mins, "#0284c7")
            }
            features.append(f)
    else:
        # High-fidelity network-attenuated polygon approximation
        for interval in target_intervals:
            coords = generate_network_attenuated_polygon(lat, lng, interval, mode=mode_clean)
            area_km2 = _approximate_polygon_area_km2(coords)
            nominal_r = round(SPEED_PROFILES.get(mode_clean, 40.0) * (interval / 60.0), 2)

            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords]
                },
                "properties": {
                    "minutes": interval,
                    "mode": mode_clean,
                    "center": {"lat": lat, "lng": lng},
                    "area_km2": area_km2,
                    "nominal_radius_km": nominal_r,
                    "population_reached": round(area_km2 * 14250 * 0.68),
                    "provider": "network_attenuation_model",
                    "color": BAND_COLORS.get(interval, "#0284c7")
                }
            }
            features.append(feature)

    # Sort largest to smallest for proper visual stacking
    features.sort(key=lambda x: x["properties"].get("minutes", 0), reverse=True)

    result = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "center": {"lat": lat, "lng": lng},
            "mode": mode_clean,
            "minutes": mins,
            "bands_count": len(features),
            "source": features[0]["properties"].get("provider", "network_attenuation_model")
        }
    }

    if not intervals:
        _ISOCHRONE_CACHE[cache_key] = result

    return result
