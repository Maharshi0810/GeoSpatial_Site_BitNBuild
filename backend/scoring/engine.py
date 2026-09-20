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

    def compute(
        self,
        lat: float,
        lng: float,
        site_type: str = "ev_charging",
        weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Compute readiness score, breakdown by dimension, and constraint audit tailored to facility archetype."""
        norm_type = (site_type or "ev_charging").lower().strip()
        is_renewables = norm_type in ("renewables", "windmill", "wind_farm", "solar_wind")

        # Select facility-appropriate default weights
        profile_weights = WEIGHT_PROFILES.get(norm_type, WEIGHT_PROFILES.get("balanced", DEFAULT_WEIGHTS))
        active_weights = weights or profile_weights

        if is_renewables:
            demo_score, demo_label = self._score_renewables_demographics(lat, lng)
            trans_score, trans_label = self._score_renewables_transportation(lat, lng)
            wind_info = get_wind_resource_score(lat, lng)
            poi_score = wind_info["score"]
            poi_label = f"Wind Resource (120m): {wind_info['mean_wind_speed_ms']} m/s"
            land_score, land_label = self._score_renewables_landuse(lat, lng)
            env_score = self._score_environment(lat, lng)
            env_label = "Environmental & Ecological Safety"
        else:
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

        if is_renewables:
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

        return resp
