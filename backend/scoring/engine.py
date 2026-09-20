"""Site Readiness Scoring Engine.

Owner: Moksh [M]
Evaluates geospatial candidate locations across 5 layers with configurable weights,
distance decay attenuation, and constraint penalties.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

try:
    from backend.config import DATA_DIR
    from backend.scoring.weights import DEFAULT_WEIGHTS, WEIGHT_PROFILES
    from backend.scoring.decay import gaussian, inverse_distance
    from backend.scoring.constraints import apply_all_constraints, check_point_in_geojson_geometry
    from backend.utils.geo_helpers import haversine_distance
    from backend.api.routes_layers import _get_fallback_geojson
    from backend.spatial.wind_resource import get_wind_resource_score
except ImportError:
    from config import DATA_DIR
    from scoring.weights import DEFAULT_WEIGHTS, WEIGHT_PROFILES
    from scoring.decay import gaussian, inverse_distance
    from scoring.constraints import apply_all_constraints, check_point_in_geojson_geometry
    from utils.geo_helpers import haversine_distance
    from api.routes_layers import _get_fallback_geojson
    from spatial.wind_resource import get_wind_resource_score


def score_to_grade(score: float) -> str:
    """Map a 0-100 numerical score to letter grade."""
    if score >= 85.0:
        return "A"
    if score >= 70.0:
        return "B"
    if score >= 55.0:
        return "C"
    if score >= 40.0:
        return "D"
    return "F"


LANDUSE_SCORES = {
    "commercial": 92.0,
    "mixed": 75.0,
    "residential": 55.0,
    "industrial": 38.0,
    "agricultural": 18.0,
}

RENEWABLES_LANDUSE_SCORES = {
    "wasteland": 96.0,
    "barren": 95.0,
    "fallow": 88.0,
    "rural": 86.0,
    "agricultural": 82.0,
    "industrial": 65.0,
    "mixed": 35.0,
    "commercial": 15.0,
    "residential": 10.0,
}

WAREHOUSE_LANDUSE_SCORES = {
    "warehouse": 96.0,
    "industrial": 95.0,
    "logistics": 94.0,
    "agricultural": 70.0,     # Convertible in Gujarat Tier-2 hubs (Sanand, Bavla model)
    "rural": 65.0,
    "wasteland": 60.0,
    "mixed": 50.0,
    "commercial": 30.0,
    "residential": 15.0,
}

TELECOM_LANDUSE_SCORES = {
    "commercial": 85.0,        # Rooftop towers viable in commercial zones
    "mixed": 80.0,
    "industrial": 75.0,
    "residential": 70.0,       # Rooftop viable with permits
    "wasteland": 65.0,         # Greenfield tower
    "rural": 60.0,
    "agricultural": 55.0,
}

# Gujarat terrain elevation zones for telecom LoS scoring
# Heuristic zones based on SRTM DEM averages
GUJARAT_ELEVATION_ZONES = [
    # (lat_min, lat_max, lng_min, lng_max, avg_elevation_m, zone_name)
    (23.5, 24.2, 68.5, 70.5, 180.0, "Kutch Highlands"),
    (21.5, 23.0, 68.5, 71.5, 120.0, "Saurashtra Plateau"),
    (20.5, 22.0, 73.0, 74.5, 250.0, "Eastern Hills (Dang/Narmada)"),
    (22.5, 24.0, 71.5, 73.5, 55.0, "Central Alluvial Plain"),
    (20.5, 22.5, 72.0, 73.5, 15.0, "Southern Coastal Plain"),
]

ENVIRONMENT_SCORES = {
    "none": 95.0,
    "low": 75.0,
    "medium": 45.0,
    "high": 15.0,
}


class SiteReadinessScorer:
    """Core evaluation engine for Gujarat site suitability."""

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or DEFAULT_WEIGHTS.copy()
        self.layers: Dict[str, Any] = {}
        self.load_data()

    def load_data(self):
        """Load GeoJSON layers from disk, or use realistic fallbacks if files are not yet created."""
        layer_keys = ["demographics", "transportation", "poi", "landuse", "environment", "water_bodies"]
        data_dir = Path(DATA_DIR)

        for layer_id in layer_keys:
            candidate_paths = [
                data_dir / f"{layer_id}.geojson",
                data_dir / layer_id / f"{layer_id}.geojson",
                data_dir / "environment" / f"{layer_id}.geojson",
                data_dir / layer_id / "data.geojson",
                data_dir / f"{layer_id}.json",
            ]
            loaded = False
            for p in candidate_paths:
                if p.exists():
                    try:
                        with open(p, "r", encoding="utf-8") as f:
                            self.layers[layer_id] = json.load(f)
                            loaded = True
                            break
                    except Exception:
                        pass
            if not loaded:
                # Use Daksh's fallback data for immediate functionality
                self.layers[layer_id] = _get_fallback_geojson(layer_id)

    def _score_demographics(self, lat: float, lng: float) -> float:
        layer = self.layers.get("demographics", {})
        features = layer.get("features", [])
        if not features:
            return 50.0

        # Find closest demographic clusters and apply gaussian distance decay
        best_score = 0.0
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    decay = gaussian(d_m, sigma=5000.0)
                    pop = feat.get("properties", {}).get("population", 3000)
                    norm_pop = min(pop / 10000.0, 1.0)
                    cluster_score = (norm_pop * 0.7 + 0.3) * decay * 100.0
                    if cluster_score > best_score:
                        best_score = cluster_score

        # Minimum baseline of 35 for populated regions in Gujarat
        return round(max(35.0, min(best_score, 98.0)), 1)

    def _score_transportation(self, lat: float, lng: float) -> float:
        layer = self.layers.get("transportation", {})
        features = layer.get("features", [])
        if not features:
            return 55.0

        min_dist_m = float("inf")
        for feat in features:
            geom = feat.get("geometry", {})
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
            return 50.0

        # Score decays from 100 near roads down to 20 at 5km away
        factor = inverse_distance(min_dist_m, max_d=6000.0)
        score = 25.0 + (factor * 75.0)
        return round(min(score, 98.0), 1)

    def _score_poi(self, lat: float, lng: float) -> float:
        layer = self.layers.get("poi", {})
        features = layer.get("features", [])
        if not features:
            return 50.0

        weighted_presence = 0.0
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    # Influence within 4km radius
                    decay = gaussian(d_m, sigma=2500.0)
                    footfall = feat.get("properties", {}).get("footfall", 500)
                    norm_weight = min(footfall / 1000.0, 1.0)
                    weighted_presence += decay * norm_weight

        # Normalize score
        score = 30.0 + min(weighted_presence * 28.0, 68.0)
        return round(min(score, 98.0), 1)

    def _score_landuse(self, lat: float, lng: float) -> float:
        layer = self.layers.get("landuse", {})
        features = layer.get("features", [])
        if not features:
            return 60.0

        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") in ("Polygon", "MultiPolygon"):
                if check_point_in_geojson_geometry(lat, lng, geom):
                    zone = feat.get("properties", {}).get("zone", "").lower()
                    for k, val in LANDUSE_SCORES.items():
                        if k in zone:
                            return val
                    return 70.0
        # Default mixed/unassigned urban land
        return 65.0

    def _score_environment(self, lat: float, lng: float) -> float:
        layer = self.layers.get("environment", {})
        features = layer.get("features", [])
        if not features:
            return 85.0

        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") in ("Polygon", "MultiPolygon"):
                if check_point_in_geojson_geometry(lat, lng, geom):
                    risk = feat.get("properties", {}).get("risk_level", "medium").lower()
                    return ENVIRONMENT_SCORES.get(risk, 60.0)

        return ENVIRONMENT_SCORES["none"]

    def _score_renewables_demographics(self, lat: float, lng: float) -> Tuple[float, str]:
        """Inverted demographic scoring for wind/solar: rewards sparse/uninhabited land (500m+ buffer),
        penalizes dense settlements."""
        layer = self.layers.get("demographics", {})
        features = layer.get("features", [])
        if not features:
            return 88.0, "Settlement Buffer (Low Density Preferred)"

        nearest_pop = 0
        min_dist_m = float("inf")
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    if d_m < min_dist_m:
                        min_dist_m = d_m
                        nearest_pop = feat.get("properties", {}).get("population", 3000)

        # Buffer rule: if within 800m of dense cluster (> 2000 people), high risk / severe penalty
        if min_dist_m < 800 and nearest_pop > 2000:
            return 18.0, "Settlement Conflict (< 800m to High-Density Habitation)"
        elif min_dist_m < 2000 and nearest_pop > 4000:
            return 35.0, "Close to Urban Settlement Boundary"
        elif min_dist_m > 4000:
            return 95.0, "Optimal Habitation Buffer (> 4km from Dense Settlements)"
        else:
            return 78.0, "Adequate Settlement Buffer (> 1.5km)"

    def _score_renewables_landuse(self, lat: float, lng: float) -> Tuple[float, str]:
        """Wasteland / rural land scoring: rewards cheap revenue wasteland / open plains;
        penalizes expensive downtown commercial plots."""
        layer = self.layers.get("landuse", {})
        features = layer.get("features", [])
        if not features:
            return 88.0, "Open Rural / Non-Arable Terrain"

        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") in ("Polygon", "MultiPolygon"):
                if check_point_in_geojson_geometry(lat, lng, geom):
                    zone = feat.get("properties", {}).get("zone", "").lower()
                    for k, val in RENEWABLES_LANDUSE_SCORES.items():
                        if k in zone:
                            return val, f"Zoning: {zone.title()}"
                    return 75.0, f"Zoning: {zone.title()}"

        return 90.0, "Open Revenue Wasteland / Non-Arable Land"

    def _score_renewables_transportation(self, lat: float, lng: float) -> Tuple[float, str]:
        """Heavy logistics access: wind turbines need wide turning radius and access roads within 15km."""
        layer = self.layers.get("transportation", {})
        features = layer.get("features", [])
        if not features:
            return 75.0, "Logistics & Evacuation Access"

        min_dist_m = float("inf")
        for feat in features:
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [])
            if geom.get("type") == "LineString":
                for pt in coords:
                    d_m = haversine_distance(lat, lng, pt[1], pt[0], unit="m")
                    if d_m < min_dist_m:
                        min_dist_m = d_m
            elif geom.get("type") == "MultiLineString":
                for line in coords:
                    for pt in line:
                        d_m = haversine_distance(lat, lng, pt[1], pt[0], unit="m")
                        if d_m < min_dist_m:
                            min_dist_m = d_m

        if min_dist_m == float("inf"):
            return 70.0, "Regional Transport Corridor"

        if min_dist_m <= 4000:
            return 95.0, "Direct Heavy Haulage Access (< 4km to Arterial)"
        elif min_dist_m <= 12000:
            return 80.0, "Viable Haulage Corridor (4 - 12km to Arterial)"
        else:
            return 55.0, "Remote Access (> 12km to Paved Transport Corridor)"

    # ── EV CHARGING — Archetype-Specific Scorers ──────────────────────

    def _score_ev_demographics(self, lat: float, lng: float) -> Tuple[float, str]:
        """Income-weighted EV adoption density. Areas with higher income brackets
        and tech park proximity receive a bonus (EV ownership proxy)."""
        layer = self.layers.get("demographics", {})
        features = layer.get("features", [])
        if not features:
            return 55.0, "EV Adoption Density"

        best_score = 0.0
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    decay = gaussian(d_m, sigma=4000.0)
                    pop = feat.get("properties", {}).get("population", 3000)
                    # Income proxy: areas with higher population density tend to have more EV adoption
                    income_tier = feat.get("properties", {}).get("income_tier", "medium")
                    income_mult = {"high": 1.3, "medium": 1.0, "low": 0.6}.get(income_tier, 1.0)
                    norm_pop = min(pop / 8000.0, 1.0)
                    cluster_score = (norm_pop * 0.6 + 0.4) * decay * income_mult * 100.0
                    if cluster_score > best_score:
                        best_score = cluster_score

        score = round(max(30.0, min(best_score, 98.0)), 1)
        if score >= 80:
            return score, "High EV Adoption Zone (Dense Urban / Tech Corridor)"
        elif score >= 55:
            return score, "Moderate EV Adoption Density"
        else:
            return score, "Low EV Adoption Potential"

    def _score_ev_poi(self, lat: float, lng: float) -> Tuple[float, str]:
        """Dwell-time anchor proximity: malls (60-90 min charging), offices (8h slow),
        petrol pumps (15 min DC fast). Following MoP 3×3 km grid coverage guideline."""
        layer = self.layers.get("poi", {})
        features = layer.get("features", [])
        if not features:
            return 55.0, "Dwell-Time Anchors"

        dwell_score = 0.0
        anchor_types_found = set()
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    decay = gaussian(d_m, sigma=2000.0)
                    poi_type = feat.get("properties", {}).get("type", "").lower()
                    footfall = feat.get("properties", {}).get("footfall", 500)

                    # Weight by dwell-time suitability
                    if any(k in poi_type for k in ["mall", "shopping", "cinema"]):
                        type_mult = 1.4  # High dwell time = ideal for AC charging
                        anchor_types_found.add("mall")
                    elif any(k in poi_type for k in ["office", "it_park", "tech"]):
                        type_mult = 1.3  # 8h parking = slow charge opportunity
                        anchor_types_found.add("office")
                    elif any(k in poi_type for k in ["petrol", "fuel", "gas"]):
                        type_mult = 1.2  # Existing refueling behavior
                        anchor_types_found.add("fuel")
                    elif any(k in poi_type for k in ["hospital", "hotel"]):
                        type_mult = 1.1
                        anchor_types_found.add("other")
                    else:
                        type_mult = 0.8

                    norm_weight = min(footfall / 1000.0, 1.0)
                    dwell_score += decay * norm_weight * type_mult

        # Diversity bonus: multiple anchor types nearby
        diversity_bonus = min(len(anchor_types_found) * 5.0, 15.0)
        score = 30.0 + min(dwell_score * 25.0, 55.0) + diversity_bonus
        score = round(min(score, 98.0), 1)
        if score >= 75:
            return score, "Prime Dwell-Time Location (Mall/Office/Fuel Hub)"
        elif score >= 55:
            return score, "Viable Charging Location"
        else:
            return score, "Limited Dwell-Time Anchors"

    # ── RETAIL STORE — Archetype-Specific Scorers ─────────────────────

    def _score_retail_demographics(self, lat: float, lng: float) -> Tuple[float, str]:
        """Pure footfall catchment — high population density in 2km trade area = high score.
        Research: 70% of retail revenue comes from within 10-min drive/walk."""
        layer = self.layers.get("demographics", {})
        features = layer.get("features", [])
        if not features:
            return 50.0, "Footfall Catchment"

        # Accumulate population within 2km trade area (not just nearest)
        catchment_pop = 0
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    if d_m <= 3000:
                        pop = feat.get("properties", {}).get("population", 3000)
                        decay = gaussian(d_m, sigma=2000.0)
                        catchment_pop += pop * decay

        # Normalize: 50,000 catchment within 3km = excellent
        norm = min(catchment_pop / 50000.0, 1.0)
        score = round(30.0 + norm * 68.0, 1)
        if score >= 80:
            return score, "High-Density Trade Area (50k+ Catchment)"
        elif score >= 55:
            return score, "Moderate Footfall Catchment"
        else:
            return score, "Low Population Catchment"

    def _score_retail_poi(self, lat: float, lng: float) -> Tuple[float, str]:
        """Co-tenancy & cluster effect scoring. Complementary businesses nearby
        boost footfall. Moderate competition is healthy (cluster effect)."""
        layer = self.layers.get("poi", {})
        features = layer.get("features", [])
        if not features:
            return 50.0, "Co-Tenancy & Cluster Effect"

        co_tenancy_score = 0.0
        complementary_count = 0
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    decay = gaussian(d_m, sigma=1500.0)
                    poi_type = feat.get("properties", {}).get("type", "").lower()
                    footfall = feat.get("properties", {}).get("footfall", 500)

                    # Complementary businesses increase foot traffic
                    if any(k in poi_type for k in ["grocery", "supermarket", "gym", "cafe", "restaurant"]):
                        type_mult = 1.5  # Strong complementary draw
                        complementary_count += 1
                    elif any(k in poi_type for k in ["mall", "cinema", "transit", "metro", "bus"]):
                        type_mult = 1.3  # Traffic generators
                    elif any(k in poi_type for k in ["bank", "pharmacy", "hospital"]):
                        type_mult = 1.1  # Essential services
                    else:
                        type_mult = 0.9

                    norm_weight = min(footfall / 800.0, 1.0)
                    co_tenancy_score += decay * norm_weight * type_mult

        # Complementary diversity bonus
        diversity_bonus = min(complementary_count * 4.0, 16.0)
        score = 25.0 + min(co_tenancy_score * 22.0, 57.0) + diversity_bonus
        score = round(min(score, 98.0), 1)
        if score >= 75:
            return score, "Strong Co-Tenancy Cluster (Retail Hub)"
        elif score >= 50:
            return score, "Moderate Commercial Cluster"
        else:
            return score, "Isolated Location (Low Co-Tenancy)"

    # ── WAREHOUSE / LOGISTICS — Archetype-Specific Scorers ────────────

    def _score_warehouse_demographics(self, lat: float, lng: float) -> Tuple[float, str]:
        """INVERTED demographic scoring for warehouses: rewards sparse/low-density areas
        with cheap land and large parcels. Urban core = expensive, no scalability."""
        layer = self.layers.get("demographics", {})
        features = layer.get("features", [])
        if not features:
            return 80.0, "Settlement Buffer (Low Density Preferred)"

        nearest_pop = 0
        min_dist_m = float("inf")
        total_nearby_pop = 0
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    pop = feat.get("properties", {}).get("population", 3000)
                    if d_m < 5000:
                        total_nearby_pop += pop
                    if d_m < min_dist_m:
                        min_dist_m = d_m
                        nearest_pop = pop

        # Dense urban core (< 2km to major settlement) = poor for warehouse
        if min_dist_m < 2000 and nearest_pop > 5000:
            return 25.0, "Urban Core Conflict (High Land Cost, No Scalability)"
        elif min_dist_m < 3000 and total_nearby_pop > 20000:
            return 40.0, "Dense Suburban Zone (Limited Parcel Size)"
        elif min_dist_m > 8000 and total_nearby_pop < 5000:
            return 92.0, "Optimal Logistics Zone (Low Density, Scalable Parcels)"
        elif min_dist_m > 5000:
            return 82.0, "Viable Peripheral Zone (Tier-2 Hub Potential)"
        else:
            return 65.0, "Moderate Density — Viable with Trade-offs"

    def _score_warehouse_landuse(self, lat: float, lng: float) -> Tuple[float, str]:
        """Industrial/warehouse zoning mandatory. Agricultural land treated as
        convertible (Gujarat Tier-2 model: Sanand, Bavla, Halol)."""
        layer = self.layers.get("landuse", {})
        features = layer.get("features", [])
        if not features:
            return 70.0, "Industrial / Logistics Zoning"

        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") in ("Polygon", "MultiPolygon"):
                if check_point_in_geojson_geometry(lat, lng, geom):
                    zone = feat.get("properties", {}).get("zone", "").lower()
                    for k, val in WAREHOUSE_LANDUSE_SCORES.items():
                        if k in zone:
                            label = f"Zoning: {zone.title()}"
                            if val >= 90:
                                label = f"Industrial/Logistics Zone ({zone.title()})"
                            elif val <= 30:
                                label = f"Incompatible Zoning ({zone.title()})"
                            return val, label
                    return 60.0, f"Zoning: {zone.title()}"

        return 70.0, "Peripheral Industrial / Open Land"

    # ── TELECOM TOWER — Archetype-Specific Scorers ────────────────────

    def _score_telecom_demographics(self, lat: float, lng: float) -> Tuple[float, str]:
        """Subscriber density proxy — high population = more users per tower = better ROI.
        Coverage gap filling also needs people to serve."""
        layer = self.layers.get("demographics", {})
        features = layer.get("features", [])
        if not features:
            return 50.0, "Subscriber Density"

        # Accumulate population within 5km coverage radius
        coverage_pop = 0
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    p_lng, p_lat = coords[0], coords[1]
                    d_m = haversine_distance(lat, lng, p_lat, p_lng, unit="m")
                    if d_m <= 5000:
                        pop = feat.get("properties", {}).get("population", 3000)
                        decay = gaussian(d_m, sigma=4000.0)
                        coverage_pop += pop * decay

        # Normalize: 80,000 coverage population = excellent
        norm = min(coverage_pop / 80000.0, 1.0)
        score = round(25.0 + norm * 73.0, 1)
        if score >= 80:
            return score, "High Subscriber Density (80k+ Coverage Pop)"
        elif score >= 55:
            return score, "Moderate Coverage Demand"
        else:
            return score, "Low Subscriber Density (Rural Gap)"

    def _score_telecom_environment(self, lat: float, lng: float) -> Tuple[float, str]:
        """Elevation-aware scoring for signal propagation. Higher elevation =
        wider signal radius. Uses Gujarat terrain zone heuristic."""
        # Check standard environment constraints first
        base_env_score = self._score_environment(lat, lng)

        # Apply elevation heuristic based on Gujarat terrain zones
        elevation_m = 40.0  # Default: alluvial plain
        zone_name = "Gujarat Plain"
        for lat_min, lat_max, lng_min, lng_max, elev, name in GUJARAT_ELEVATION_ZONES:
            if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
                elevation_m = elev
                zone_name = name
                break

        # Higher elevation = better LoS for signal propagation
        if elevation_m >= 200:
            elev_bonus = 20.0
            elev_label = f"Elevated Terrain ({zone_name}, ~{int(elevation_m)}m) — Excellent LoS"
        elif elevation_m >= 100:
            elev_bonus = 12.0
            elev_label = f"Moderate Elevation ({zone_name}, ~{int(elevation_m)}m) — Good LoS"
        elif elevation_m >= 50:
            elev_bonus = 5.0
            elev_label = f"Low Plateau ({zone_name}, ~{int(elevation_m)}m)"
        else:
            elev_bonus = 0.0
            elev_label = f"Flat Terrain ({zone_name}, ~{int(elevation_m)}m) — Standard Coverage"

        # Blend base environment score with elevation advantage
        score = min(base_env_score * 0.6 + (50.0 + elev_bonus) * 0.4 + elev_bonus * 0.3, 98.0)
        score = round(max(score, 20.0), 1)
        return score, elev_label

    def _score_telecom_landuse(self, lat: float, lng: float) -> Tuple[float, str]:
        """Telecom-specific land use: both rooftop (urban) and greenfield (rural)
        are viable. More flexible zoning than other archetypes."""
        layer = self.layers.get("landuse", {})
        features = layer.get("features", [])
        if not features:
            return 70.0, "Telecom Zoning Compliance"

        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") in ("Polygon", "MultiPolygon"):
                if check_point_in_geojson_geometry(lat, lng, geom):
                    zone = feat.get("properties", {}).get("zone", "").lower()
                    for k, val in TELECOM_LANDUSE_SCORES.items():
                        if k in zone:
                            if val >= 80:
                                label = f"Rooftop Viable ({zone.title()} Zone)"
                            else:
                                label = f"Greenfield Tower ({zone.title()} Zone)"
                            return val, label
                    return 70.0, f"Zoning: {zone.title()}"

        return 65.0, "Open Land / Greenfield Tower Site"

    # ── DISPATCHER METHODS ────────────────────────────────────────────

    def _compute_ev(self, lat: float, lng: float):
        """EV Charging Station scoring dispatcher."""
        demo_score, demo_label = self._score_ev_demographics(lat, lng)
        trans_score = self._score_transportation(lat, lng)
        trans_label = "Highway & Arterial Access"
        poi_score, poi_label = self._score_ev_poi(lat, lng)
        land_score = self._score_landuse(lat, lng)
        land_label = "Commercial Zoning Suitability"
        env_score = self._score_environment(lat, lng)
        env_label = "Flood & Environmental Safety"
        return (demo_score, demo_label, trans_score, trans_label,
                poi_score, poi_label, land_score, land_label, env_score, env_label)

    def _compute_retail(self, lat: float, lng: float):
        """Retail Store scoring dispatcher."""
        demo_score, demo_label = self._score_retail_demographics(lat, lng)
        trans_score = self._score_transportation(lat, lng)
        trans_label = "Vehicular & Pedestrian Access"
        poi_score, poi_label = self._score_retail_poi(lat, lng)
        land_score = self._score_landuse(lat, lng)
        land_label = "Commercial Zoning"
        env_score = self._score_environment(lat, lng)
        env_label = "Environmental Safety"
        return (demo_score, demo_label, trans_score, trans_label,
                poi_score, poi_label, land_score, land_label, env_score, env_label)

    def _compute_warehouse(self, lat: float, lng: float):
        """Warehouse / Logistics Hub scoring dispatcher."""
        demo_score, demo_label = self._score_warehouse_demographics(lat, lng)
        trans_score = self._score_transportation(lat, lng)
        trans_label = "Multi-Modal Corridor Access"
        poi_score = self._score_poi(lat, lng)
        poi_label = "Industrial Cluster Proximity"
        land_score, land_label = self._score_warehouse_landuse(lat, lng)
        env_score = self._score_environment(lat, lng)
        env_label = "Flood Risk (Inventory Protection)"
        return (demo_score, demo_label, trans_score, trans_label,
                poi_score, poi_label, land_score, land_label, env_score, env_label)

    def _compute_telecom(self, lat: float, lng: float):
        """Telecom Tower scoring dispatcher."""
        demo_score, demo_label = self._score_telecom_demographics(lat, lng)
        trans_score = self._score_transportation(lat, lng)
        trans_label = "Maintenance Road Access"
        poi_score = self._score_poi(lat, lng)
        poi_label = "Coverage Gap Analysis"
        land_score, land_label = self._score_telecom_landuse(lat, lng)
        env_score, env_label = self._score_telecom_environment(lat, lng)
        return (demo_score, demo_label, trans_score, trans_label,
                poi_score, poi_label, land_score, land_label, env_score, env_label)

    def _score_solar_resource(self, lat: float, lng: float) -> Tuple[float, str, Dict[str, Any]]:
        """Global Horizontal Irradiance (GHI) model across Gujarat calibrated to MNRE/NREL solar atlas.
        Kutch & North Gujarat (Patan, Banaskantha) offer 5.8-6.3 kWh/m2/day; South Gujarat ~4.8-5.2."""
        ghi = 5.2 + (lat - 21.0) * 0.25 - abs(lng - 70.5) * 0.08
        if lat < 22.0 and lng > 72.5:
            ghi -= 0.3
        if lat >= 23.2 and lng <= 71.2:
            ghi += 0.35

        ghi = round(max(4.2, min(ghi, 6.4)), 2)
        score = round(max(30.0, min((ghi - 4.2) / (6.4 - 4.2) * 68.0 + 30.0, 98.0)), 1)
        if ghi >= 5.9:
            label = f"Prime Solar Belt (GHI: {ghi} kWh/m²/day)"
        elif ghi >= 5.4:
            label = f"High Solar Irradiance (GHI: {ghi} kWh/m²/day)"
        elif ghi >= 5.0:
            label = f"Moderate Solar Potential (GHI: {ghi} kWh/m²/day)"
        else:
            label = f"Sub-optimal Solar Zone (GHI: {ghi} kWh/m²/day)"

        return score, label, {
            "ghi_kwh_m2_day": ghi,
            "annual_generation_mwh_mwp": round(ghi * 365 * 0.78, 0),
            "capacity_utilization_factor_pct": round((ghi / 24.0) * 0.78 * 100, 1)
        }

    def _compute_solar(self, lat: float, lng: float):
        """Solar Farm scoring dispatcher."""
        demo_score, demo_label = self._score_renewables_demographics(lat, lng)
        trans_score, trans_label = self._score_renewables_transportation(lat, lng)
        solar_score, solar_label, _ = self._score_solar_resource(lat, lng)
        land_score, land_label = self._score_renewables_landuse(lat, lng)
        env_score = self._score_environment(lat, lng)
        env_label = "Ecological Buffer & Flood Safety"
        return (demo_score, demo_label, trans_score, trans_label,
                solar_score, solar_label, land_score, land_label, env_score, env_label)

    def _compute_default(self, lat: float, lng: float):
        """Fallback: generic balanced scoring for unknown archetypes."""
        demo_score = self._score_demographics(lat, lng)
        demo_label = "Population Density"
        trans_score = self._score_transportation(lat, lng)
        trans_label = "Road Accessibility"
        poi_score = self._score_poi(lat, lng)
        poi_label = "Points of Interest"
        land_score = self._score_landuse(lat, lng)
        land_label = "Land Use Compatibility"
        env_score = self._score_environment(lat, lng)
        env_label = "Environmental Safety"
        return (demo_score, demo_label, trans_score, trans_label,
                poi_score, poi_label, land_score, land_label, env_score, env_label)

    def compute(
        self,
        lat: float,
        lng: float,
        site_type: str = "ev_charging",
        weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Compute readiness score, breakdown by dimension, and constraint audit tailored to facility archetype."""
        norm_type = (site_type or "ev_charging").lower().strip()
        is_windmill = norm_type in ("renewables", "windmill", "wind_farm", "wind_turbine", "solar_wind")
        is_solar = norm_type in ("solar", "solar_farm")
        is_renewables = is_windmill or is_solar

        # Select facility-appropriate default weights
        profile_weights = WEIGHT_PROFILES.get(norm_type, WEIGHT_PROFILES.get("balanced", DEFAULT_WEIGHTS))
        active_weights = weights or profile_weights

        if is_windmill:
            demo_score, demo_label = self._score_renewables_demographics(lat, lng)
            trans_score, trans_label = self._score_renewables_transportation(lat, lng)
            wind_info = get_wind_resource_score(lat, lng)
            poi_score = wind_info["score"]
            poi_label = f"Wind Resource (120m): {wind_info['mean_wind_speed_ms']} m/s"
            land_score, land_label = self._score_renewables_landuse(lat, lng)
            env_score = self._score_environment(lat, lng)
            env_label = "Environmental & Ecological Safety"
        elif is_solar:
            (
                demo_score, demo_label,
                trans_score, trans_label,
                poi_score, poi_label,
                land_score, land_label,
                env_score, env_label
            ) = self._compute_solar(lat, lng)
        else:
            _ARCHETYPE_DISPATCH = {
                "ev_charging": self._compute_ev,
                "retail": self._compute_retail,
                "warehouse": self._compute_warehouse,
                "telecom": self._compute_telecom,
            }
            compute_fn = _ARCHETYPE_DISPATCH.get(norm_type, self._compute_default)
            (
                demo_score, demo_label,
                trans_score, trans_label,
                poi_score, poi_label,
                land_score, land_label,
                env_score, env_label
            ) = compute_fn(lat, lng)

        breakdown = {
            "demographics": {
                "score": demo_score,
                "label": demo_label
            },
            "transportation": {
                "score": trans_score,
                "label": trans_label
            },
            "poi": {
                "score": poi_score,
                "label": poi_label
            },
            "landuse": {
                "score": land_score,
                "label": land_label
            },
            "environment": {
                "score": env_score,
                "label": env_label
            }
        }

        # Weighted calculation
        total_w = sum(active_weights.get(k, 0.2) for k in breakdown)
        if total_w <= 0:
            total_w = 1.0

        raw_total = sum(
            breakdown[k]["score"] * (active_weights.get(k, 0.2) / total_w)
            for k in breakdown
        )

        # Apply constraint penalties & hard limiting parameters
        constraint_audit = apply_all_constraints(lat, lng, self.layers, site_type=norm_type)
        is_disqualified = constraint_audit.get("disqualified", False) or constraint_audit.get("is_water_body", False)

        if is_disqualified:
            final_score = 0.0
            grade = "F"
            breakdown["environment"]["score"] = 0.0
            wb_name = constraint_audit.get("water_body_name") or "Water Body"
            breakdown["environment"]["label"] = f"Environmental Hazard: {wb_name} Exclusion"
        else:
            penalty = constraint_audit.get("total_penalty", 0.0)
            final_score = max(0.0, min(raw_total - penalty, 100.0))
            final_score = round(final_score, 1)
            grade = score_to_grade(final_score)

        resp: Dict[str, Any] = {
            "score": final_score,
            "grade": grade,
            "lat": lat,
            "lng": lng,
            "site_type": norm_type,
            "disqualified": is_disqualified,
            "limiting_parameter": constraint_audit.get("limiting_parameter"),
            "disqualification_reason": constraint_audit.get("disqualification_reason"),
            "breakdown": breakdown,
            "constraints": {
                "disqualified": is_disqualified,
                "limiting_parameter": constraint_audit.get("limiting_parameter"),
                "disqualification_reason": constraint_audit.get("disqualification_reason"),
                "is_water_body": constraint_audit.get("is_water_body", False),
                "water_body_name": constraint_audit.get("water_body_name"),
                "water_body_type": constraint_audit.get("water_body_type"),
                "in_flood_zone": constraint_audit.get("in_flood_zone", False),
                "flood_risk_level": constraint_audit.get("flood_risk_level", "none"),
                "min_road_distance_m": constraint_audit.get("min_road_distance_m", 100.0)
            }
        }

        if is_windmill:
            wind_info = get_wind_resource_score(lat, lng)
            resp["renewable_resource"] = {
                "annual_average_ms": wind_info.get("annual_average_ms", wind_info["mean_wind_speed_ms"]),
                "mean_wind_speed_ms": wind_info["mean_wind_speed_ms"],
                "wind_power_density_wm2": wind_info["wind_power_density_wm2"],
                "hub_height_m": wind_info["hub_height_m"],
                "wind_tier": wind_info["tier"],
                "estimated_cuf_pct": wind_info.get("estimated_cuf_pct"),
                "seasonal_summary": wind_info.get("seasonal_summary"),
                "monthly_speeds_ms": wind_info.get("monthly_speeds_ms"),
                "anchor_proximity": wind_info["anchor_proximity"]
            }
        elif is_solar:
            _, _, solar_meta = self._score_solar_resource(lat, lng)
            resp["solar_resource"] = solar_meta

        return resp
