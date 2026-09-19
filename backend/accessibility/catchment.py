"""Demographic Catchment Area Population Aggregator.

Owner: Maharshi [R]
Role: Calculates reached population, average density, commercial competitor
      clustering, and time-band breakdowns within travel isochrone polygons.
"""

import math
from typing import Dict, Any, List, Optional, Tuple

try:
    from shapely.geometry import shape, Point, Polygon
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False

try:
    from backend.data.loader import load_layer
    from backend.utils.geo_helpers import point_in_polygon
    from backend.accessibility.isochrone import compute_isochrone
except ImportError:
    from data.loader import load_layer
    from utils.geo_helpers import point_in_polygon
    from accessibility.isochrone import compute_isochrone


def _is_point_inside(lng: float, lat: float, poly_shape: Any, poly_coords: List[List[float]]) -> bool:
    """Check point containment using Shapely if available, else Ray-casting."""
    if SHAPELY_AVAILABLE and poly_shape is not None:
        return poly_shape.contains(Point(lng, lat))
    return point_in_polygon(lat, lng, poly_coords)


def compute_catchment_stats(
    lat: float,
    lng: float,
    minutes: int = 15,
    mode: str = "driving",
    custom_polygon: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Calculate comprehensive demographic and competitor catchment metrics.
    
    Args:
        lat, lng: Candidate site coordinates
        minutes: Target travel time threshold
        mode: 'driving', 'walking', or 'cycling'
        custom_polygon: Optional external GeoJSON Polygon geometry
        
    Returns:
        Structured catchment analysis with metrics and time-band distribution
    """
    # 1. Resolve isochrone polygon
    if custom_polygon:
        poly_geom = custom_polygon
        isochrone_fc = {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "geometry": poly_geom, "properties": {"minutes": minutes, "mode": mode}}]
        }
    else:
        isochrone_fc = compute_isochrone(lat, lng, minutes=minutes, mode=mode)
        poly_geom = isochrone_fc["features"][0]["geometry"]

    poly_coords = poly_geom.get("coordinates", [[]])[0]
    poly_shape = shape(poly_geom) if SHAPELY_AVAILABLE else None

    # 2. Load demographic and POI datasets from data pipeline
    try:
        demographics_data = load_layer("demographics")
        demo_features = demographics_data.get("features", [])
    except Exception:
        demo_features = []

    try:
        poi_data = load_layer("poi")
        poi_features = poi_data.get("features", [])
    except Exception:
        poi_features = []

    # 3. Aggregate demographic metrics within polygon
    total_population = 0
    densities: List[float] = []
    income_counts = {"low": 0, "medium": 0, "high": 0}
    contained_demo_points = 0

    for feat in demo_features:
        coords = feat.get("geometry", {}).get("coordinates", [])
        if len(coords) >= 2:
            p_lng, p_lat = coords[0], coords[1]
            if _is_point_inside(p_lng, p_lat, poly_shape, poly_coords):
                contained_demo_points += 1
                props = feat.get("properties", {})
                pop = props.get("population", 0)
                density = props.get("density_per_sq_km") or props.get("density", 0)
                income = str(props.get("income_level", "medium")).lower()

                total_population += int(pop)
                if density > 0:
                    densities.append(float(density))
                if income in income_counts:
                    income_counts[income] += 1
                else:
                    income_counts["medium"] += 1

    # If few point samples fell inside small walk isochrone, extrapolate baseline
    if total_population == 0:
        base_density = 6500.0  # Gujarat urban median density
        approx_area = isochrone_fc["features"][0]["properties"].get("area_km2", 1.5)
        total_population = int(base_density * approx_area * 0.7)
        densities.append(base_density)

    avg_density = round(sum(densities) / max(len(densities), 1), 1)
    dominant_income = max(income_counts.items(), key=lambda x: x[1])[0].capitalize()

    # 4. Count commercial competitor POIs within polygon
    contained_pois = 0
    poi_categories: Dict[str, int] = {}

    for feat in poi_features:
        coords = feat.get("geometry", {}).get("coordinates", [])
        if len(coords) >= 2:
            p_lng, p_lat = coords[0], coords[1]
            if _is_point_inside(p_lng, p_lat, poly_shape, poly_coords):
                contained_pois += 1
                cat = feat.get("properties", {}).get("category") or feat.get("properties", {}).get("type", "commercial")
                poi_categories[cat] = poi_categories.get(cat, 0) + 1

    # 5. Progressive Time-Band Reach (5, 10, 15, 30 min)
    band_intervals = [5, 10, 15, 30]
    multi_band_fc = compute_isochrone(lat, lng, intervals=band_intervals, mode=mode)
    time_bands = []

    for f in sorted(multi_band_fc["features"], key=lambda x: x["properties"].get("minutes", 0)):
        b_min = f["properties"]["minutes"]
        b_area = f["properties"].get("area_km2", 1.0)
        b_coords = f["geometry"].get("coordinates", [[]])[0]
        b_shape = shape(f["geometry"]) if SHAPELY_AVAILABLE else None

        b_pop = 0
        for feat in demo_features:
            coords = feat.get("geometry", {}).get("coordinates", [])
            if len(coords) >= 2:
                if _is_point_inside(coords[0], coords[1], b_shape, b_coords):
                    b_pop += int(feat.get("properties", {}).get("population", 0))

        if b_pop == 0:
            b_pop = int(avg_density * b_area * 0.65)

        time_bands.append({
            "minutes": b_min,
            "population": b_pop,
            "area_km2": b_area,
            "label": f"{b_min} min {mode.capitalize()}"
        })

    primary_area = isochrone_fc["features"][0]["properties"].get("area_km2", 1.0)

    return {
        "status": "ok",
        "data": {
            "center": {"lat": lat, "lng": lng},
            "travel_mode": mode,
            "travel_minutes": minutes,
            "catchment_area_km2": primary_area,
            "population_reached": total_population,
            "average_density_per_km2": avg_density,
            "dominant_income_tier": dominant_income,
            "competitors_in_catchment": contained_pois,
            "competitor_categories": poi_categories,
            "time_bands": time_bands,
            "isochrone_geojson": isochrone_fc
        }
    }
