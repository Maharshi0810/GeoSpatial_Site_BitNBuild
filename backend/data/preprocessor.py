"""Geospatial Preprocessing and Validation Utilities.

Owner: Maharshi [R]
"""

from typing import Dict, Any, List, Optional

GUJARAT_BBOX = [68.1, 20.1, 74.5, 24.7]  # [min_lng, min_lat, max_lng, max_lat]


def validate_geojson(data: Dict[str, Any]) -> bool:
    """Validate standard FeatureCollection geometry and coordinates structure."""
    if not isinstance(data, dict):
        return False
    if data.get("type") != "FeatureCollection":
        return False
    features = data.get("features")
    if not isinstance(features, list):
        return False

    for feat in features:
        if feat.get("type") != "Feature":
            return False
        geom = feat.get("geometry")
        if not geom or not isinstance(geom, dict):
            return False
        if "type" not in geom or "coordinates" not in geom:
            return False
    return True


def is_coordinate_in_bbox(lng: float, lat: float, bbox: List[float] = GUJARAT_BBOX) -> bool:
    """Check if point [lng, lat] falls within the Gujarat regional bounding box."""
    min_lng, min_lat, max_lng, max_lat = bbox
    return min_lng <= lng <= max_lng and min_lat <= lat <= max_lat


def normalize_crs(gdf, target_crs: str = "EPSG:4326"):
    """Reproject a GeoPandas GeoDataFrame to target CRS."""
    if hasattr(gdf, "crs") and gdf.crs is not None:
        if str(gdf.crs) != target_crs:
            return gdf.to_crs(target_crs)
    return gdf
