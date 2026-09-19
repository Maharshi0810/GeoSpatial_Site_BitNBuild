"""H3 Hexagonal Binning and Spatial Aggregation

Owner: Daksh [D]
Supports both h3-py v3 and v4 API signatures with a geometric hexagonal grid fallback.
"""

import math
from typing import Dict, Any, List, Optional
from collections import defaultdict

# Try importing h3
try:
    import h3
    H3_AVAILABLE = True
except ImportError:
    h3 = None
    H3_AVAILABLE = False


def _latlng_to_hex(lat: float, lng: float, resolution: int) -> str:
    """Convert (lat, lng) to H3 index, handling both v3 and v4 APIs."""
    if not H3_AVAILABLE:
        # Algorithmic grid cell fallback
        step = 0.05 * (8 - resolution + 1)
        grid_x = round(lng / step)
        grid_y = round(lat / step)
        return f"hex_{resolution}_{grid_x}_{grid_y}"

    if hasattr(h3, "latlng_to_cell"):
        return h3.latlng_to_cell(lat, lng, resolution)
    elif hasattr(h3, "geo_to_h3"):
        return h3.geo_to_h3(lat, lng, resolution)
    return f"cell_{resolution}_{round(lng*100)}_{round(lat*100)}"


def _hex_to_boundary(hex_id: str) -> List[List[float]]:
    """Get polygon boundary coordinates [[lng, lat], ...] for a given cell."""
    if H3_AVAILABLE:
        try:
            if hasattr(h3, "cell_to_boundary"):
                boundary = h3.cell_to_boundary(hex_id)  # returns tuple of (lat, lng)
                return [[lng, lat] for lat, lng in boundary] + [[boundary[0][1], boundary[0][0]]]
            elif hasattr(h3, "h3_to_geo_boundary"):
                boundary = h3.h3_to_geo_boundary(hex_id)
                return [[lng, lat] for lat, lng in boundary] + [[boundary[0][1], boundary[0][0]]]
        except Exception:
            pass

    # Fallback geometric hexagon around approximate center
    parts = hex_id.split("_")
    if len(parts) >= 4:
        resolution = int(parts[1])
        gx = int(parts[2])
        gy = int(parts[3])
        step = 0.05 * (8 - resolution + 1)
        c_lng = gx * step
        c_lat = gy * step
    else:
        c_lng, c_lat = 72.57, 23.02
        step = 0.05

    radius = step * 0.6
    ring = []
    for i in range(6):
        angle = math.pi / 3.0 * i
        ring.append([
            round(c_lng + radius * math.cos(angle), 5),
            round(c_lat + radius * math.sin(angle), 5)
        ])
    ring.append(ring[0])  # close ring
    return ring


def compute_h3_grid(
    features: List[Dict[str, Any]],
    resolution: int = 7,
    value_key: str = "value"
) -> Dict[str, Any]:
    """Aggregate point features into an H3 hexagonal grid.

    Args:
        features: List of GeoJSON Point features
        resolution: H3 resolution level (4 = regional, 7 = city-block, 9 = neighborhood)
        value_key: Attribute to aggregate

    Returns:
        GeoJSON FeatureCollection containing hexagon Polygons with aggregated metrics
    """
    res = max(4, min(9, resolution))
    hex_buckets = defaultdict(list)

    for f in features:
        geom = f.get("geometry", {})
        if geom.get("type") == "Point" and len(geom.get("coordinates", [])) >= 2:
            lng, lat = geom["coordinates"][0], geom["coordinates"][1]
            val = f.get("properties", {}).get(value_key, 1.0)
            try:
                val = float(val)
            except (ValueError, TypeError):
                val = 1.0

            hex_id = _latlng_to_hex(lat, lng, res)
            hex_buckets[hex_id].append(val)

    # Convert aggregated buckets into GeoJSON Hexagon Polygons
    hex_features = []
    for hex_id, values in hex_buckets.items():
        avg_val = sum(values) / len(values)
        boundary_coords = _hex_to_boundary(hex_id)

        hex_features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [boundary_coords]
            },
            "properties": {
                "hex_id": hex_id,
                "resolution": res,
                "count": len(values),
                "avg_value": round(avg_val, 2),
                "min_value": round(min(values), 2),
                "max_value": round(max(values), 2)
            }
        })

    return {
        "type": "FeatureCollection",
        "features": hex_features,
        "metadata": {
            "resolution": res,
            "total_hexagons": len(hex_features),
            "h3_native": H3_AVAILABLE
        }
    }
