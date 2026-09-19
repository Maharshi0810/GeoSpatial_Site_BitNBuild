"""Geospatial helper utilities for coordinate transforms, distance calculations,
bounding boxes, and spatial predicates.

Owner: Daksh [D]
"""

import math
from typing import List, Tuple, Dict, Any, Optional

# Earth radius in kilometers
EARTH_RADIUS_KM = 6371.0
EARTH_RADIUS_M = 6371000.0

# Gujarat standard bounding box [min_lon, min_lat, max_lon, max_lat]
GUJARAT_BBOX = [68.16, 20.12, 74.48, 24.71]
GUJARAT_CENTER = {"lat": 23.0225, "lng": 72.5714}  # Ahmedabad center


def haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float, unit: str = "km"
) -> float:
    """Compute great-circle distance between two points on a sphere using Haversine formula.

    Args:
        lat1, lon1: Coordinate 1 in decimal degrees
        lat2, lon2: Coordinate 2 in decimal degrees
        unit: 'km' or 'm' (default 'km')

    Returns:
        Distance in requested unit
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    radius = EARTH_RADIUS_M if unit == "m" else EARTH_RADIUS_KM
    return radius * c


def point_in_polygon(lat: float, lon: float, polygon_coords: List[List[float]]) -> bool:
    """Ray casting algorithm to determine if a point (lat, lon) is inside a polygon.

    Args:
        lat: Latitude of point
        lon: Longitude of point
        polygon_coords: List of [lon, lat] coordinates defining the polygon exterior ring

    Returns:
        True if point is strictly inside polygon
    """
    inside = False
    n = len(polygon_coords)
    if n < 3:
        return False

    p1x, p1y = polygon_coords[0][0], polygon_coords[0][1]
    for i in range(1, n + 1):
        p2x, p2y = polygon_coords[i % n][0], polygon_coords[i % n][1]
        if lat > min(p1y, p2y):
            if lat <= max(p1y, p2y):
                if lon <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or lon <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y

    return inside


def is_in_gujarat_bbox(lat: float, lon: float) -> bool:
    """Quick check if a coordinate falls within the Gujarat bounding box."""
    min_lon, min_lat, max_lon, max_lat = GUJARAT_BBOX
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


def calculate_bbox(coordinates: List[Tuple[float, float]]) -> List[float]:
    """Calculate [min_lon, min_lat, max_lon, max_lat] for a list of (lon, lat) tuples."""
    if not coordinates:
        return [0.0, 0.0, 0.0, 0.0]

    lons = [c[0] for c in coordinates]
    lats = [c[1] for c in coordinates]
    return [min(lons), min(lats), max(lons), max(lats)]


def buffer_point_circle(
    lat: float, lon: float, radius_km: float, num_points: int = 32
) -> List[List[float]]:
    """Generate polygon coordinates approximating a circular buffer around a point.

    Returns:
        List of [lon, lat] coordinate pairs forming a closed ring.
    """
    coords = []
    angular_dist = radius_km / EARTH_RADIUS_KM
    lat_r = math.radians(lat)
    lon_r = math.radians(lon)

    for i in range(num_points):
        bearing = 2.0 * math.pi * i / num_points
        b_lat = math.asin(
            math.sin(lat_r) * math.cos(angular_dist)
            + math.cos(lat_r) * math.sin(angular_dist) * math.cos(bearing)
        )
        b_lon = lon_r + math.atan2(
            math.sin(bearing) * math.sin(angular_dist) * math.cos(lat_r),
            math.cos(angular_dist) - math.sin(lat_r) * math.sin(b_lat),
        )
        coords.append([math.degrees(b_lon), math.degrees(b_lat)])

    # Close the ring
    coords.append(coords[0])
    return coords
