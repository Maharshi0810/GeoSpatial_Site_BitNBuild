"""High-Fidelity Synthetic Geospatial Data Generator for Gujarat.

Owner: Maharshi [R]
Generates schema-compliant, geographically calibrated GeoJSON datasets per DATA_SCHEMA.md.
"""

import math
import random
from typing import Dict, Any, List

# Anchor cities in Gujarat [lat, lng, base_population, district]
GUJARAT_CITIES = [
    {"name": "Ahmedabad", "lat": 23.0225, "lng": 72.5714, "pop": 8500000, "district": "Ahmedabad", "radius_km": 18},
    {"name": "Surat", "lat": 21.1702, "lng": 72.8311, "pop": 6500000, "district": "Surat", "radius_km": 14},
    {"name": "Vadodara", "lat": 22.3072, "lng": 73.1812, "pop": 2300000, "district": "Vadodara", "radius_km": 10},
    {"name": "Rajkot", "lat": 22.3039, "lng": 70.8022, "pop": 1900000, "district": "Rajkot", "radius_km": 9},
    {"name": "Gandhinagar", "lat": 23.2156, "lng": 72.6369, "pop": 450000, "district": "Gandhinagar", "radius_km": 6},
    {"name": "Bhavnagar", "lat": 21.7645, "lng": 72.1519, "pop": 700000, "district": "Bhavnagar", "radius_km": 7},
    {"name": "Jamnagar", "lat": 22.4707, "lng": 70.0577, "pop": 650000, "district": "Jamnagar", "radius_km": 6},
    {"name": "Anand", "lat": 22.5645, "lng": 72.9289, "pop": 350000, "district": "Anand", "radius_km": 5},
    {"name": "Bharuch", "lat": 21.7051, "lng": 72.9959, "pop": 400000, "district": "Bharuch", "radius_km": 5},
    {"name": "Mehsana", "lat": 23.5880, "lng": 72.3693, "pop": 300000, "district": "Mehsana", "radius_km": 5},
]


def _km_to_deg(lat: float, km: float) -> tuple[float, float]:
    """Approximate conversion from km to degrees (lat_deg, lng_deg)."""
    d_lat = km / 111.0
    d_lng = km / (111.0 * math.cos(math.radians(lat)))
    return d_lat, d_lng


def generate_boundary() -> Dict[str, Any]:
    """Generate high-level perimeter polygon representing the State of Gujarat."""
    coordinates = [[
        [68.10, 23.75], [68.80, 24.50], [70.50, 24.70], [71.80, 24.50],
        [72.50, 24.40], [73.50, 24.20], [74.30, 23.00], [74.50, 22.00],
        [73.80, 21.10], [73.30, 20.30], [72.85, 20.10], [72.60, 20.90],
        [72.10, 21.60], [71.00, 20.70], [69.20, 22.20], [68.95, 22.50],
        [70.10, 22.90], [68.50, 23.50], [68.10, 23.75]
    ]]
    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": coordinates},
            "properties": {
                "name": "Gujarat",
                "state_code": "GJ",
                "area_sq_km": 196024,
                "capital": "Gandhinagar"
            }
        }]
    }


def generate_demographics(target_points: int = 500) -> Dict[str, Any]:
    """Generate demographic centroid points across Gujarat cities."""
    random.seed(42)  # Deterministic repeatability
    features = []
    points_per_city = target_points // len(GUJARAT_CITIES)

    for city in GUJARAT_CITIES:
        c_lat, c_lng = city["lat"], city["lng"]
        radius = city["radius_km"]

        # Core city cluster center
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(c_lng, 5), round(c_lat, 5)]},
            "properties": {
                "name": f"{city['name']} Core",
                "population": int(city["pop"] * 0.15),
                "density_per_sq_km": round(18000 + random.uniform(0, 4000), 1),
                "city": city["name"],
                "district": city["district"],
                "income_index": round(0.75 + random.uniform(0, 0.2), 2),
                "value": round(0.85 + random.uniform(0, 0.15), 2),
            }
        })

        # Distributed neighborhood centroids
        for i in range(points_per_city - 1):
            angle = random.uniform(0, 2 * math.pi)
            dist_km = random.triangular(0.5, radius, radius * 0.4)
            d_lat, d_lng = _km_to_deg(c_lat, dist_km)
            p_lat = c_lat + dist_km * math.cos(angle) / 111.0
            p_lng = c_lng + dist_km * math.sin(angle) / (111.0 * math.cos(math.radians(c_lat)))

            factor = max(0.1, 1.0 - (dist_km / radius))
            pop = int((city["pop"] / 200.0) * factor * random.uniform(0.7, 1.4))
            density = round(pop / 1.2, 1)

            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(p_lng, 5), round(p_lat, 5)]},
                "properties": {
                    "name": f"{city['name']} Sector {i + 1}",
                    "population": max(450, pop),
                    "density_per_sq_km": max(300.0, density),
                    "city": city["name"],
                    "district": city["district"],
                    "income_index": round(0.4 + factor * 0.5, 2),
                    "value": round(max(0.1, min(1.0, factor * 0.9 + random.uniform(-0.1, 0.1))), 3),
                }
            })

    return {"type": "FeatureCollection", "features": features}


def generate_transportation() -> Dict[str, Any]:
    """Generate key highways, expressways, and urban ring roads in Gujarat."""
    roads = [
        {
            "name": "NH-48 Golden Corridor",
            "type": "highway",
            "lanes": 6,
            "speed": 100,
            "coords": [
                [72.5714, 23.0225], [72.6369, 23.2156], [72.9289, 22.5645],
                [73.1812, 22.3072], [72.9959, 21.7051], [72.8311, 21.1702], [72.85, 20.30]
            ]
        },
        {
            "name": "NE-1 Ahmedabad-Vadodara Expressway",
            "type": "highway",
            "lanes": 4,
            "speed": 120,
            "coords": [
                [72.6500, 23.0100], [72.7800, 22.8200], [72.9300, 22.5700],
                [73.1000, 22.4200], [73.1812, 22.3072]
            ]
        },
        {
            "name": "SG Highway (Ahmedabad Arterial)",
            "type": "primary",
            "lanes": 6,
            "speed": 80,
            "coords": [
                [72.5112, 23.0378], [72.5150, 23.0800], [72.5300, 23.1300], [72.5500, 23.1800]
            ]
        },
        {
            "name": "SP Ring Road (Ahmedabad Orbital)",
            "type": "primary",
            "lanes": 4,
            "speed": 90,
            "coords": [
                [72.4600, 23.0200], [72.4800, 23.1200], [72.6200, 23.1400],
                [72.6900, 23.0500], [72.6600, 22.9500], [72.5100, 22.9400], [72.4600, 23.0200]
            ]
        },
        {
            "name": "Surat-Dumas Commercial Corridor",
            "type": "primary",
            "lanes": 4,
            "speed": 70,
            "coords": [
                [72.8311, 21.1702], [72.7800, 21.1400], [72.7200, 21.1000]
            ]
        },
        {
            "name": "Rajkot-Ahmedabad Highway (NH-47)",
            "type": "highway",
            "lanes": 4,
            "speed": 100,
            "coords": [
                [70.8022, 22.3039], [71.3000, 22.5000], [71.8000, 22.7000], [72.5714, 23.0225]
            ]
        }
    ]

    features = []
    for r in roads:
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": r["coords"]},
            "properties": {
                "name": r["name"],
                "road_type": r["type"],
                "surface": "paved",
                "lanes": r["lanes"],
                "speed_limit_kmh": r["speed"]
            }
        })
    return {"type": "FeatureCollection", "features": features}


def generate_poi(count: int = 250) -> Dict[str, Any]:
    """Generate commercial and competitive points of interest."""
    random.seed(101)
    categories = ["retail", "restaurant", "ev_charging", "gas_station", "grocery", "bank", "hotel"]
    features = []

    for i in range(count):
        city = random.choice(GUJARAT_CITIES)
        c_lat, c_lng = city["lat"], city["lng"]
        radius = city["radius_km"] * 0.7

        angle = random.uniform(0, 2 * math.pi)
        dist_km = random.triangular(0.2, radius, 2.0)
        p_lat = c_lat + dist_km * math.cos(angle) / 111.0
        p_lng = c_lng + dist_km * math.sin(angle) / (111.0 * math.cos(math.radians(c_lat)))

        cat = random.choice(categories)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(p_lng, 5), round(p_lat, 5)]},
            "properties": {
                "name": f"{cat.replace('_', ' ').title()} #{i + 1}",
                "type": cat,
                "category": cat,
                "city": city["name"],
                "rating": round(random.uniform(3.2, 4.9), 1),
                "footfall": random.randint(150, 4500),
                "revenue_index": round(random.uniform(0.35, 0.95), 2),
                "value": round(random.uniform(0.2, 1.0), 3),
            }
        })

    return {"type": "FeatureCollection", "features": features}


def generate_landuse() -> Dict[str, Any]:
    """Generate land use and zoning polygons across Gujarat metropolitan hubs."""
    zones = [
        # Ahmedabad Commercial C-1, C-2
        {"name": "SG Highway Commercial Corridor", "type": "commercial", "coords": [[72.50, 23.02], [72.53, 23.02], [72.53, 23.08], [72.50, 23.08], [72.50, 23.02]], "far": 2.7},
        {"name": "Ashram Road Central Business District", "type": "commercial", "coords": [[72.56, 23.02], [72.59, 23.02], [72.59, 23.05], [72.56, 23.05], [72.56, 23.02]], "far": 3.0},
        # Sanand GIDC Industrial
        {"name": "Sanand Industrial Cluster GIDC", "type": "industrial", "coords": [[72.35, 22.97], [72.42, 22.97], [72.42, 23.01], [72.35, 23.01], [72.35, 22.97]], "far": 1.5},
        # Naroda Industrial
        {"name": "Naroda GIDC Manufacturing Area", "type": "industrial", "coords": [[72.65, 23.06], [72.70, 23.06], [72.70, 23.10], [72.65, 23.10], [72.65, 23.06]], "far": 1.4},
        # Bopal Residential
        {"name": "South Bopal Urban Residential Zone", "type": "residential", "coords": [[72.45, 22.99], [72.50, 22.99], [72.50, 23.03], [72.45, 23.03], [72.45, 22.99]], "far": 2.0},
        # Surat Commercial
        {"name": "Surat Ring Road Commercial Area", "type": "commercial", "coords": [[72.81, 21.16], [72.85, 21.16], [72.85, 21.20], [72.81, 21.20], [72.81, 21.16]], "far": 2.8},
        # Vadodara Industrial
        {"name": "Makarpura GIDC Industrial Corridor", "type": "industrial", "coords": [[73.17, 22.25], [73.22, 22.25], [73.22, 22.29], [73.17, 22.29], [73.17, 22.25]], "far": 1.6},
    ]

    features = []
    for z in zones:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [z["coords"]]},
            "properties": {
                "zone_name": z["name"],
                "zone_type": z["type"],
                "area_sq_km": round(random.uniform(2.1, 7.8), 2),
                "building_density": random.randint(80, 320),
                "max_floor_area_ratio": z["far"],
                "permitted": z["type"] in ["commercial", "mixed"]
            }
        })
    return {"type": "FeatureCollection", "features": features}


def generate_environment() -> Dict[str, Any]:
    """Generate flood risk polygons and coastal buffer zones."""
    risks = [
        {
            "hazard": "Sabarmati River Lowland Spillover",
            "river": "Sabarmati",
            "risk": "high",
            "return_yrs": 25,
            "elev": 48.0,
            "coords": [
                [72.5700, 22.9800], [72.5850, 22.9800], [72.5900, 23.0400],
                [72.5750, 23.0400], [72.5700, 22.9800]
            ]
        },
        {
            "hazard": "Sabarmati Upstream Basin Buffer",
            "river": "Sabarmati",
            "risk": "medium",
            "return_yrs": 50,
            "elev": 54.0,
            "coords": [
                [72.5900, 23.0800], [72.6200, 23.0800], [72.6300, 23.1500],
                [72.6000, 23.1500], [72.5900, 23.0800]
            ]
        },
        {
            "hazard": "Gulf of Khambhat Tidal Inundation Zone",
            "river": "Tidal/Coastal",
            "risk": "high",
            "return_yrs": 10,
            "elev": 8.5,
            "coords": [
                [72.30, 21.60], [72.70, 21.60], [72.80, 21.20],
                [72.40, 21.20], [72.30, 21.60]
            ]
        },
        {
            "hazard": "Tapi River Delta Inundation",
            "river": "Tapi",
            "risk": "medium",
            "return_yrs": 30,
            "elev": 14.0,
            "coords": [
                [72.74, 21.15], [72.80, 21.15], [72.82, 21.19],
                [72.76, 21.19], [72.74, 21.15]
            ]
        }
    ]

    features = []
    for r in risks:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [r["coords"]]},
            "properties": {
                "hazard": r["hazard"],
                "risk_level": r["risk"],
                "flood_return_years": r["return_yrs"],
                "river": r["river"],
                "elevation_m": r["elev"],
                "is_exclusion": r["risk"] == "high"
            }
        })
    return {"type": "FeatureCollection", "features": features}
