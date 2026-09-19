"""Threshold constraint validations for site scoring (flood zones, road proximity, etc.)."""

from typing import Dict, Any, Tuple
try:
    from backend.utils.geo_helpers import haversine_distance, point_in_polygon
except ImportError:
    from utils.geo_helpers import haversine_distance, point_in_polygon

# Constraint penalties
FLOOD_HIGH_PENALTY = 35.0
FLOOD_MEDIUM_PENALTY = 15.0
FLOOD_LOW_PENALTY = 5.0
MAX_ACCEPTABLE_ROAD_DIST_M = 3000.0  # Sites further than 3km from road incur penalty
ROAD_DISTANCE_PENALTY = 25.0


def check_point_in_geojson_geometry(lat: float, lng: float, geometry: Dict[str, Any]) -> bool:
    """Helper to check if (lat, lng) is inside a Polygon or MultiPolygon GeoJSON geometry."""
    g_type = geometry.get("type")
    coords = geometry.get("coordinates", [])

    if g_type == "Polygon":
        if coords:
            exterior_ring = coords[0]
            if point_in_polygon(lat, lng, exterior_ring):
                return True
    elif g_type == "MultiPolygon":
        for poly in coords:
            if poly:
                exterior_ring = poly[0]
                if point_in_polygon(lat, lng, exterior_ring):
                    return True
    return False


def flood_zone_check(lat: float, lng: float, environment_layer: Dict[str, Any]) -> Tuple[float, str]:
    """Check if the candidate point intersects flood zone hazards."""
    if not environment_layer or not environment_layer.get("features"):
        return 0.0, "none"

    for feature in environment_layer.get("features", []):
        geom = feature.get("geometry", {})
        if geom.get("type") in ("Polygon", "MultiPolygon"):
            if check_point_in_geojson_geometry(lat, lng, geom):
                props = feature.get("properties", {})
                risk = props.get("risk_level", "medium").lower()
                if risk == "high":
                    return FLOOD_HIGH_PENALTY, "high"
                elif risk == "medium":
                    return FLOOD_MEDIUM_PENALTY, "medium"
                else:
                    return FLOOD_LOW_PENALTY, "low"

    return 0.0, "none"


def min_road_distance_check(lat: float, lng: float, transportation_layer: Dict[str, Any]) -> Tuple[float, float]:
    """Calculate distance to nearest transport network line string and apply penalty if too isolated."""
    if not transportation_layer or not transportation_layer.get("features"):
        return 0.0, 150.0  # reasonable default if layer not populated

    min_dist_m = float("inf")
    for feature in transportation_layer.get("features", []):
        geom = feature.get("geometry", {})
        g_type = geom.get("type")
        coords = geom.get("coordinates", [])

        if g_type == "LineString":
            for pt in coords:
                d_m = haversine_distance(lat, lng, pt[1], pt[0], unit="m")
                if d_m < min_dist_m:
                    min_dist_m = d_m
        elif g_type == "MultiLineString":
            for line in coords:
                for pt in line:
                    d_m = haversine_distance(lat, lng, pt[1], pt[0], unit="m")
                    if d_m < min_dist_m:
                        min_dist_m = d_m

    if min_dist_m == float("inf"):
        return 0.0, 200.0

    penalty = ROAD_DISTANCE_PENALTY if min_dist_m > MAX_ACCEPTABLE_ROAD_DIST_M else 0.0
    return penalty, min_dist_m


def apply_all_constraints(lat: float, lng: float, layers: Dict[str, Any]) -> Dict[str, Any]:
    """Execute all hard constraints and compute cumulative penalty."""
    env_layer = layers.get("environment", {})
    trans_layer = layers.get("transportation", {})

    flood_penalty, flood_risk = flood_zone_check(lat, lng, env_layer)
    road_penalty, road_dist_m = min_road_distance_check(lat, lng, trans_layer)

    total_penalty = flood_penalty + road_penalty

    return {
        "total_penalty": total_penalty,
        "in_flood_zone": flood_risk != "none",
        "flood_risk_level": flood_risk,
        "min_road_distance_m": round(road_dist_m, 1),
    }
