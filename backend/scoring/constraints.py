"""Threshold constraint validations for site scoring (flood zones, road proximity, etc.)."""

from typing import Dict, Any, Tuple, Optional
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


# In-memory OSM reverse water cache
_WATER_CACHE: Dict[str, Tuple[bool, Optional[str], Optional[str], Optional[str]]] = {}


def water_body_check(lat: float, lng: float, layers: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """Check if candidate point intersects a recognized water body (lake, reservoir, riverbed, ocean, wetland).

    Returns: (is_water, name, water_type, disqualification_reason)
    """
    # 1. Check dedicated water_bodies layer
    wb_layer = layers.get("water_bodies") or {}
    for feature in wb_layer.get("features", []):
        geom = feature.get("geometry", {})
        if geom.get("type") in ("Polygon", "MultiPolygon"):
            if check_point_in_geojson_geometry(lat, lng, geom):
                props = feature.get("properties", {})
                name = props.get("name", "Water Body")
                w_type = props.get("type", "lake")
                reason = props.get("disqualification_reason") or f"Candidate location falls inside {name}. Ground construction is physically prohibited."
                return True, name, w_type, reason

    # 2. Check environment layer features with is_exclusion or water hazards
    env_layer = layers.get("environment") or {}
    for feature in env_layer.get("features", []):
        props = feature.get("properties", {})
        hazard = props.get("hazard", "").lower()
        if any(w in hazard for w in ["water", "river", "lake", "inundation", "wetland", "spillover"]):
            geom = feature.get("geometry", {})
            if geom.get("type") in ("Polygon", "MultiPolygon"):
                if check_point_in_geojson_geometry(lat, lng, geom):
                    if props.get("is_exclusion") or "river" in hazard or "lake" in hazard:
                        name = props.get("hazard", "Water Corridor Hazard")
                        return True, name, "water_hazard", f"Candidate location falls within {name}. Civil development is prohibited."

    # 3. Check landuse layer for water zones
    lu_layer = layers.get("landuse") or {}
    for feature in lu_layer.get("features", []):
        props = feature.get("properties", {})
        z_type = props.get("zone_type", "").lower()
        if z_type in ("water", "waterbody", "wetland", "river"):
            geom = feature.get("geometry", {})
            if check_point_in_geojson_geometry(lat, lng, geom):
                name = props.get("zone_name", "Water Body Zone")
                return True, name, "water_zone", f"Candidate site falls in protected water zoning ({name})."

    # 4. Fast online check via cached photon / nominatim if query not cached
    cache_key = f"{lat:.4f},{lng:.4f}"
    if cache_key in _WATER_CACHE:
        cached = _WATER_CACHE[cache_key]
        return cached[0], cached[1], cached[2], cached[3]

    # Optional fast nominatim reverse check with 1.2s timeout
    try:
        import urllib.request
        import urllib.parse
        import json
        params = urllib.parse.urlencode({"format": "json", "lat": lat, "lon": lng, "zoom": 17})
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/reverse?{params}",
            headers={"User-Agent": "GeoVistaSiteReadiness/2.0 (team@geovista.app)"}
        )
        with urllib.request.urlopen(req, timeout=1.2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            category = data.get("category", "").lower()
            osm_type = data.get("type", "").lower()
            name = data.get("name", "")
            
            # Check for water signatures
            is_water = (
                category in ("water", "waterway", "natural") and osm_type in ("water", "lake", "reservoir", "river", "pond", "canal", "basin", "dock")
            ) or (
                any(w in name.lower() for w in [" lake", "talav", "sarovar", " dam", "reservoir"]) and "road" not in name.lower() and "walkway" not in name.lower()
            )
            if is_water:
                res = (True, name or "Water Body", osm_type or "lake", f"Site is detected inside {name or 'water body'}. Construction is physically prohibited.")
                _WATER_CACHE[cache_key] = res
                return res
    except Exception:
        pass

    _WATER_CACHE[cache_key] = (False, None, None, None)
    return False, None, None, None


def apply_all_constraints(lat: float, lng: float, layers: Dict[str, Any]) -> Dict[str, Any]:
    """Execute all hard constraints and compute cumulative penalty."""
    env_layer = layers.get("environment", {})
    trans_layer = layers.get("transportation", {})

    # Check water body hard limiting parameter
    is_water, wb_name, wb_type, wb_reason = water_body_check(lat, lng, layers)

    flood_penalty, flood_risk = flood_zone_check(lat, lng, env_layer)
    road_penalty, road_dist_m = min_road_distance_check(lat, lng, trans_layer)

    if is_water:
        # Hard limiting parameter: Immediate disqualification & 100 penalty
        return {
            "total_penalty": 100.0,
            "disqualified": True,
            "limiting_parameter": "WATER_BODY_EXCLUSION",
            "disqualification_reason": wb_reason,
            "is_water_body": True,
            "water_body_name": wb_name,
            "water_body_type": wb_type,
            "in_flood_zone": True,
            "flood_risk_level": "extreme_exclusion",
            "min_road_distance_m": round(road_dist_m, 1),
        }

    total_penalty = flood_penalty + road_penalty

    return {
        "total_penalty": total_penalty,
        "disqualified": False,
        "limiting_parameter": None,
        "disqualification_reason": None,
        "is_water_body": False,
        "water_body_name": None,
        "water_body_type": None,
        "in_flood_zone": flood_risk != "none",
        "flood_risk_level": flood_risk,
        "min_road_distance_m": round(road_dist_m, 1),
    }
