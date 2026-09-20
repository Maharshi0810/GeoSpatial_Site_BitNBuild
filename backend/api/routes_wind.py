"""Gujarat Wind Atlas & Prime Spots API Routes.

Owner: Daksh [D]
Endpoints:
  GET /api/wind/atlas       - Pre-computed spatial grid/cells across Gujarat with 120m wind speeds
  GET /api/wind/prime-spots - Curated high-yield Tier-1 wind corridors with coordinates and CUF
"""

import math
from typing import Dict, Any, List
from fastapi import APIRouter

try:
    from backend.spatial.wind_resource import (
        GUJARAT_WIND_EPICENTERS,
        estimate_wind_speed,
        get_wind_resource_score
    )
except ImportError:
    from spatial.wind_resource import (
        GUJARAT_WIND_EPICENTERS,
        estimate_wind_speed,
        get_wind_resource_score
    )

router = APIRouter(prefix="/wind", tags=["Wind Resource"])

# Curated High-Yield Prime Spots across Gujarat
PRIME_WIND_SPOTS = [
    {
        "id": "jakhau-kutch",
        "name": "Jakhau Wind Corridor, Kutch",
        "short_name": "Jakhau Coast",
        "lat": 23.238,
        "lng": 68.705,
        "speed_ms": 8.4,
        "tier": "Tier 1 — High-Yield Coastal Belt",
        "cuf_pct": 39.5,
        "wpd_wm2": 345.2,
        "highlight": "Highest wind yield zone in Western India"
    },
    {
        "id": "mandvi-kutch",
        "name": "Mandvi Coastal Strip, Kutch",
        "short_name": "Mandvi Coast",
        "lat": 22.833,
        "lng": 69.355,
        "speed_ms": 8.1,
        "tier": "Tier 1 — Commercial Wind Corridor",
        "cuf_pct": 37.1,
        "wpd_wm2": 307.3,
        "highlight": "Active utility wind park cluster with 220kV GETCO substation"
    },
    {
        "id": "dwarka-saurashtra",
        "name": "Devbhumi Dwarka Belt, Saurashtra",
        "short_name": "Devbhumi Dwarka",
        "lat": 22.240,
        "lng": 68.968,
        "speed_ms": 8.3,
        "tier": "Tier 1 — High-Yield Coastal Belt",
        "cuf_pct": 38.8,
        "wpd_wm2": 332.8,
        "highlight": "Consistent monsoon Arabian Sea wind funnel"
    },
    {
        "id": "porbandar-coast",
        "name": "Porbandar Coastal Corridor",
        "short_name": "Porbandar Belt",
        "lat": 21.642,
        "lng": 69.609,
        "speed_ms": 8.0,
        "tier": "Tier 1 — Commercial Wind Corridor",
        "cuf_pct": 36.5,
        "wpd_wm2": 298.2,
        "highlight": "Excellent heavy transport access via NH-51"
    },
    {
        "id": "mahuva-jafrabad",
        "name": "Mahuva / Jafrabad Coastal Ridgeline",
        "short_name": "Jafrabad Coast",
        "lat": 21.090,
        "lng": 71.770,
        "speed_ms": 7.7,
        "tier": "Tier 1 — Commercial Wind Corridor",
        "cuf_pct": 34.4,
        "wpd_wm2": 265.4,
        "highlight": "Southern Saurashtra coastal uplift corridor"
    },
    {
        "id": "rajkot-ridge",
        "name": "Rajkot Elevated Plateau, Central Saurashtra",
        "short_name": "Rajkot Ridge",
        "lat": 22.300,
        "lng": 70.800,
        "speed_ms": 6.8,
        "tier": "Tier 2 — Elevated Saurashtra Plateau",
        "cuf_pct": 28.0,
        "wpd_wm2": 184.5,
        "highlight": "Inland elevated plateau with moderate year-round winds"
    }
]


def _speed_to_color(speed: float) -> str:
    """Map wind speed (m/s) to Vortex-style color gradient."""
    if speed >= 8.2:
        return "#b91c1c"  # Deep Crimson
    elif speed >= 7.8:
        return "#ef4444"  # Bright Red
    elif speed >= 7.2:
        return "#f97316"  # Orange
    elif speed >= 6.5:
        return "#facc15"  # Amber / Yellow
    elif speed >= 5.5:
        return "#22c55e"  # Green
    elif speed >= 4.8:
        return "#06b6d4"  # Cyan
    else:
        return "#3b82f6"  # Sky Blue


def _generate_wind_atlas_grid() -> Dict[str, Any]:
    """Generate a high-density polygon grid across Gujarat with NIWE wind speeds."""
    features = []
    
    # Gujarat bounding box approximately [68.2 to 74.3 lng, 20.2 to 24.6 lat]
    # Grid step: ~0.22 degrees (~24km resolution matching ERA5 reanalysis)
    lat_start, lat_end, lat_step = 20.3, 24.6, 0.22
    lng_start, lng_end, lng_step = 68.3, 74.0, 0.22
    
    curr_lat = lat_start
    while curr_lat < lat_end:
        curr_lng = lng_start
        while curr_lng < lng_end:
            # Cell center
            c_lat = round(curr_lat + lat_step / 2.0, 4)
            c_lng = round(curr_lng + lng_step / 2.0, 4)
            
            # Estimate speed
            speed, anchor = estimate_wind_speed(c_lat, c_lng)
            color = _speed_to_color(speed)
            
            # Cell polygon
            poly_coords = [[
                [round(curr_lng, 4), round(curr_lat, 4)],
                [round(curr_lng + lng_step, 4), round(curr_lat, 4)],
                [round(curr_lng + lng_step, 4), round(curr_lat + lat_step, 4)],
                [round(curr_lng, 4), round(curr_lat + lat_step, 4)],
                [round(curr_lng, 4), round(curr_lat, 4)]
            ]]
            
            # Approximate capacity utilization factor
            if speed >= 8.2:
                cuf = round(38.0 + (speed - 8.2) * 5.0, 1)
            elif speed >= 7.2:
                cuf = round(32.0 + (speed - 7.2) / 1.0 * 6.0, 1)
            elif speed >= 6.0:
                cuf = round(24.0 + (speed - 6.0) / 1.2 * 8.0, 1)
            else:
                cuf = round(max(10.0, 14.0 + (speed - 4.5) * 6.0), 1)
            
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": poly_coords
                },
                "properties": {
                    "center_lat": c_lat,
                    "center_lng": c_lng,
                    "wind_speed_ms": speed,
                    "cuf_pct": cuf,
                    "fill_color": color,
                    "nearest_anchor": anchor,
                    "tier": "Tier 1" if speed >= 7.5 else ("Tier 2" if speed >= 6.5 else "Tier 3")
                }
            })
            curr_lng += lng_step
        curr_lat += lat_step
        
    return {
        "type": "FeatureCollection",
        "metadata": {
            "title": "Vortex / NIWE Gujarat Wind Mean Speed Atlas",
            "hub_height_m": 120,
            "resolution": "0.22° x 0.22°",
            "feature_count": len(features)
        },
        "features": features
    }


# Cache grid in memory for fast retrieval
_CACHED_WIND_ATLAS = _generate_wind_atlas_grid()


@router.get("/atlas")
def get_wind_atlas() -> Dict[str, Any]:
    """Retrieve Gujarat 120m Wind Mean Speed surface grid."""
    return _CACHED_WIND_ATLAS


@router.get("/prime-spots")
def get_prime_spots() -> Dict[str, Any]:
    """Retrieve list of curated high-yield prime wind spots across Gujarat."""
    return {
        "status": "ok",
        "count": len(PRIME_WIND_SPOTS),
        "data": PRIME_WIND_SPOTS
    }
