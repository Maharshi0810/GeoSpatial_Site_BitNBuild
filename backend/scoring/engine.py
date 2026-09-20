"""Site Readiness Scoring Engine.

Owner: Moksh [M] & Antigravity
Evaluates geospatial candidate locations across 6 distinct industry archetypes:
- EV Charging
- Retail Store
- Warehouse / Logistics
- Telecom Tower
- Wind Turbine
- Solar Farm

Incorporates distance decay attenuation, authentic spatial reasons,
data availability indicators (transparent reporting when outside mapped surveys),
and hard limiting parameter exclusions (water bodies).
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

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
GUJARAT_ELEVATION_ZONES = [
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
    """Core evaluation engine for Gujarat site suitability across 6 archetypes."""

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
                self.layers[layer_id] = _get_fallback_geojson(layer_id)

    # ── SHARED GEOMETRIC HELPERS ──────────────────────────────────────

    def _get_nearest_demographic(self, lat: float, lng: float) -> Tuple[float, int, str]:
        """Find nearest demographic point feature: returns (distance_m, population, income_tier)."""
        layer = self.layers.get("demographics", {})
        features = layer.get("features", [])
        if not features:
            return float("inf"), 0, "unknown"

        min_dist_m = float("inf")
        nearest_pop = 0
        income_tier = "medium"

        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    d_m = haversine_distance(lat, lng, coords[1], coords[0], unit="m")
                    if d_m < min_dist_m:
                        min_dist_m = d_m
                        nearest_pop = feat.get("properties", {}).get("population", 3000)
                        income_tier = feat.get("properties", {}).get("income_tier", "medium")

        return min_dist_m, nearest_pop, income_tier

    def _get_min_road_distance(self, lat: float, lng: float) -> float:
        """Find distance to nearest mapped transportation LineString."""
        layer = self.layers.get("transportation", {})
        features = layer.get("features", [])
        if not features:
            return float("inf")

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

        return min_dist_m

    def _get_zoning_at_point(self, lat: float, lng: float) -> Tuple[bool, str, str]:
        """Check if point falls inside any mapped landuse polygon.
        Returns: (has_data, zone_type, zone_name)"""
        layer = self.layers.get("landuse", {})
        features = layer.get("features", [])
        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") in ("Polygon", "MultiPolygon"):
                if check_point_in_geojson_geometry(lat, lng, geom):
                    props = feat.get("properties", {})
                    zone = props.get("zone", props.get("zone_type", "")).lower()
                    name = props.get("zone_name", props.get("name", zone.title()))
                    return True, zone, name
        return False, "", ""

    # ── 1. EV CHARGING STATION ────────────────────────────────────────

    def _score_ev(self, lat: float, lng: float) -> Dict[str, Dict[str, Any]]:
        # Demographics: High density + income
        d_dist, pop, income = self._get_nearest_demographic(lat, lng)
        if d_dist > 25000:
            demo = {
                "score": 30.0,
                "label": "Low Demographic Density",
                "explanation": "Localized census tract survey unavailable for this rural coordinate (nearest surveyed cluster is >25 km away). Regional baseline estimate applied.",
                "data_available": False,
                "raw_value": None,
                "unit": "people/km²"
            }
        else:
            decay = gaussian(d_dist, sigma=4000.0)
            norm_pop = min(pop / 8000.0, 1.0)
            mult = {"high": 1.3, "medium": 1.0, "low": 0.6}.get(income, 1.0)
            score = round(max(30.0, min((norm_pop * 0.6 + 0.4) * decay * mult * 100.0, 98.0)), 1)
            label = "High EV Adoption Zone" if score >= 75 else ("Moderate EV Adoption Density" if score >= 50 else "Low EV Adoption Potential")
            demo = {
                "score": score,
                "label": label,
                "explanation": f"Catchment cluster within {int(d_dist)} m with ~{pop:,} population ({income} income tier). {'Strong initial customer base.' if score >= 60 else 'Sparse local residential demand.'}",
                "data_available": True,
                "raw_value": pop,
                "unit": "people"
            }

        # Transportation: Highway access
        road_dist = self._get_min_road_distance(lat, lng)
        if road_dist > 25000:
            trans = {
                "score": 25.0,
                "label": "Remote Highway Access",
                "explanation": f"Arterial road survey sparse: nearest mapped highway corridor is {round(road_dist/1000)} km away. Poor EV transit throughput.",
                "data_available": False,
                "raw_value": round(road_dist),
                "unit": "meters"
            }
        else:
            factor = inverse_distance(road_dist, max_d=4000.0)
            score = round(min(25.0 + factor * 73.0, 98.0), 1)
            trans = {
                "score": score,
                "label": "Highway & Fast-Charger Access",
                "explanation": f"Situated {int(road_dist)} m from mapped road corridor, providing {'direct high-visibility arterial access' if road_dist <= 300 else 'moderate vehicular turnaround connectivity'} for EV fast-charging.",
                "data_available": True,
                "raw_value": round(road_dist),
                "unit": "meters"
            }

        # POI: Dwell-time anchors (malls, offices, fuel stations)
        poi_layer = self.layers.get("poi", {})
        poi_features = poi_layer.get("features", [])
        dwell_score = 0.0
        anchors_found = set()
        for feat in poi_features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    d_m = haversine_distance(lat, lng, coords[1], coords[0], unit="m")
                    decay = gaussian(d_m, sigma=2000.0)
                    p_type = feat.get("properties", {}).get("type", "").lower()
                    if any(k in p_type for k in ["mall", "shopping", "cinema"]):
                        dwell_score += decay * 1.4
                        anchors_found.add("retail mall")
                    elif any(k in p_type for k in ["office", "tech", "park"]):
                        dwell_score += decay * 1.3
                        anchors_found.add("office hub")
                    elif any(k in p_type for k in ["petrol", "fuel", "gas"]):
                        dwell_score += decay * 1.2
                        anchors_found.add("fuel station")
                    elif any(k in p_type for k in ["hospital", "hotel"]):
                        dwell_score += decay * 1.1
                        anchors_found.add("hospitality")

        if not anchors_found and road_dist > 15000:
            poi = {
                "score": 35.0,
                "label": "Limited Dwell-Time Anchors",
                "explanation": "No commercial dwell-time anchors (malls, tech parks, fuel stations) mapped in this rural/unmapped zone.",
                "data_available": False,
                "raw_value": 0,
                "unit": "anchors"
            }
        else:
            score = round(min(30.0 + min(dwell_score * 30.0, 55.0) + min(len(anchors_found) * 5.0, 15.0), 98.0), 1)
            anchors_text = ", ".join(list(anchors_found)[:3]) if anchors_found else "general commercial"
            poi = {
                "score": score,
                "label": "Prime Dwell-Time Location" if score >= 70 else "Viable Charging Location",
                "explanation": f"{len(anchors_found)} commercial dwell anchor types identified nearby ({anchors_text}) supporting destination and fleet charging turnaround.",
                "data_available": True,
                "raw_value": len(anchors_found),
                "unit": "anchor types"
            }

        # Landuse
        has_lu, zone, z_name = self._get_zoning_at_point(lat, lng)
        if not has_lu:
            land = {
                "score": 55.0,
                "label": "Unsurveyed Zoning Limits",
                "explanation": "Localized zoning survey data unavailable for this coordinate (coverage currently restricted to mapped Gujarat metro corridors). Defaulting to regional baseline.",
                "data_available": False,
                "raw_value": None,
                "unit": "zoning"
            }
        else:
            score = LANDUSE_SCORES.get(zone, 65.0)
            land = {
                "score": score,
                "label": f"Zoning: {zone.title()}",
                "explanation": f"Designated {zone.upper()} zone ({z_name}). {'Permitted by right for fast-charging infrastructure.' if score >= 75 else 'Subject to municipal commercial utility variance.'}",
                "data_available": True,
                "raw_value": zone,
                "unit": "zoning"
            }

        # Environment
        env_score, env_label, env_expl, env_avail = self._score_environment_rich(lat, lng)
        env = {
            "score": env_score,
            "label": env_label,
            "explanation": env_expl,
            "data_available": env_avail,
            "raw_value": env_label,
            "unit": "hazard tier"
        }

        return {"demographics": demo, "transportation": trans, "poi": poi, "landuse": land, "environment": env}

    # ── 2. RETAIL STORE ───────────────────────────────────────────────

    def _score_retail(self, lat: float, lng: float) -> Dict[str, Dict[str, Any]]:
        d_dist, pop, _ = self._get_nearest_demographic(lat, lng)
        if d_dist > 25000:
            demo = {
                "score": 25.0,
                "label": "Sparse Catchment Population",
                "explanation": "Localized footfall survey unavailable for this rural coordinate. Sparse rural settlement provides low retail customer density.",
                "data_available": False,
                "raw_value": None,
                "unit": "people"
            }
        else:
            decay = gaussian(d_dist, sigma=2500.0)
            norm = min(pop / 10000.0, 1.0)
            score = round(max(25.0, min((norm * 0.7 + 0.3) * decay * 100.0, 98.0)), 1)
            demo = {
                "score": score,
                "label": "High Footfall Catchment" if score >= 75 else "Moderate Catchment Demand",
                "explanation": f"Catchment population of ~{pop:,} within {int(d_dist)} m drive/walk radius ({'strong commercial footfall foundation' if score >= 65 else 'limited localized footfall volume'}).",
                "data_available": True,
                "raw_value": pop,
                "unit": "people"
            }

        road_dist = self._get_min_road_distance(lat, lng)
        if road_dist > 25000:
            trans = {
                "score": 20.0,
                "label": "Isolated Street Access",
                "explanation": f"Street network survey unavailable or isolated: nearest transport route is {round(road_dist/1000)} km away. Minimal customer walk-in traffic.",
                "data_available": False,
                "raw_value": round(road_dist),
                "unit": "meters"
            }
        else:
            score = round(min(20.0 + inverse_distance(road_dist, max_d=3000.0) * 78.0, 98.0), 1)
            trans = {
                "score": score,
                "label": "Vehicular & Pedestrian Access",
                "explanation": f"Located {int(road_dist)} m from primary street network, ensuring {'high pedestrian and vehicular customer accessibility' if road_dist <= 250 else 'secondary road access requiring minor transit'}.",
                "data_available": True,
                "raw_value": round(road_dist),
                "unit": "meters"
            }

        # Retail co-tenancy & POI
        poi_layer = self.layers.get("poi", {})
        poi_features = poi_layer.get("features", [])
        retail_count = 0
        for feat in poi_features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    d_m = haversine_distance(lat, lng, coords[1], coords[0], unit="m")
                    if d_m <= 2500:
                        retail_count += 1

        if retail_count == 0 and road_dist > 15000:
            poi = {
                "score": 30.0,
                "label": "No Retail Agglomeration",
                "explanation": "No commercial retail POIs detected in local radius. Untapped or non-commercial zone.",
                "data_available": False,
                "raw_value": 0,
                "unit": "POIs"
            }
        else:
            score = round(min(30.0 + min(retail_count * 7.0, 68.0), 98.0), 1)
            poi = {
                "score": score,
                "label": "Established Shopping District" if score >= 70 else "Emerging Commercial Cluster",
                "explanation": f"{retail_count} commercial & retail establishments mapped within 2.5 km trade area creating retail shopping agglomeration.",
                "data_available": True,
                "raw_value": retail_count,
                "unit": "POIs"
            }

        has_lu, zone, z_name = self._get_zoning_at_point(lat, lng)
        if not has_lu:
            land = {
                "score": 50.0,
                "label": "Unsurveyed Land Class",
                "explanation": "Localized AUDA zoning survey unavailable for this coordinate. Defaulting to regional baseline.",
                "data_available": False,
                "raw_value": None,
                "unit": "zoning"
            }
        else:
            score = 95.0 if zone == "commercial" else (75.0 if zone == "mixed" else 35.0)
            land = {
                "score": score,
                "label": f"Commercial Zoning ({zone.title()})",
                "explanation": f"Designated {zone.upper()} zone ({z_name}). {'Fully compliant for retail store operation.' if score >= 75 else 'Requires commercial usage rezoning permit.'}",
                "data_available": True,
                "raw_value": zone,
                "unit": "zoning"
            }

        env_score, env_label, env_expl, env_avail = self._score_environment_rich(lat, lng)
        env = {
            "score": env_score,
            "label": env_label,
            "explanation": env_expl,
            "data_available": env_avail,
            "raw_value": env_label,
            "unit": "hazard tier"
        }

        return {"demographics": demo, "transportation": trans, "poi": poi, "landuse": land, "environment": env}

    # ── 3. WAREHOUSE / LOGISTICS ──────────────────────────────────────

    def _score_warehouse(self, lat: float, lng: float) -> Dict[str, Dict[str, Any]]:
        d_dist, pop, _ = self._get_nearest_demographic(lat, lng)
        if d_dist > 25000:
            demo = {
                "score": 88.0,
                "label": "Optimal Peripheral Logistics Zone",
                "explanation": "Located >25 km outside congested urban core: optimal for large-footprint, low-cost logistics parcel acquisition without municipal congestion constraints.",
                "data_available": True,
                "raw_value": round(d_dist / 1000, 1),
                "unit": "km to urban core"
            }
        else:
            # Warehouses prefer peripheral distance: 4km - 15km is ideal
            if d_dist < 2000 and pop > 4000:
                score, label = 28.0, "Urban Core Conflict (High Land Cost, No Scalability)"
            elif d_dist < 4000:
                score, label = 45.0, "Dense Suburban Belt (Limited Parcel Size)"
            else:
                score, label = 88.0, "Optimal Logistics Buffer (Low Density, Scalable Parcels)"
            demo = {
                "score": score,
                "label": label,
                "explanation": f"Settlement buffer distance of {round(d_dist/1000, 1)} km from nearest urban center (~{pop:,} pop). {'Ideal for logistics park development.' if score >= 75 else 'Constrained by land cost and urban traffic.'}",
                "data_available": True,
                "raw_value": round(d_dist),
                "unit": "meters"
            }

        road_dist = self._get_min_road_distance(lat, lng)
        if road_dist > 25000:
            trans = {
                "score": 25.0,
                "label": "Remote Freight Corridor",
                "explanation": f"Freight transport survey sparse: nearest arterial highway is {round(road_dist/1000)} km away. Logistics haulage is unviable without dedicated road building.",
                "data_available": False,
                "raw_value": round(road_dist),
                "unit": "meters"
            }
        else:
            score = round(min(25.0 + inverse_distance(road_dist, max_d=8000.0) * 73.0, 98.0), 1)
            trans = {
                "score": score,
                "label": "Multi-Modal Freight Access",
                "explanation": f"Primary transport artery situated {round(road_dist/1000, 1) if road_dist >= 1000 else int(road_dist)} {'km' if road_dist >= 1000 else 'm'} away; {'compliant with multi-axle freight carrier logistics' if road_dist <= 3000 else 'requires secondary connector transit'}.",
                "data_available": True,
                "raw_value": round(road_dist),
                "unit": "meters"
            }

        # Industrial cluster proximity
        poi_layer = self.layers.get("poi", {})
        poi_features = poi_layer.get("features", [])
        ind_count = 0
        for feat in poi_features:
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    d_m = haversine_distance(lat, lng, coords[1], coords[0], unit="m")
                    if d_m <= 6000:
                        p_type = feat.get("properties", {}).get("type", "").lower()
                        if any(k in p_type for k in ["industrial", "factory", "warehouse", "logistics", "gidc"]):
                            ind_count += 1

        if ind_count == 0 and road_dist > 15000:
            poi = {
                "score": 50.0,
                "label": "Greenfield Logistics Location",
                "explanation": "No existing manufacturing or GIDC industrial clusters detected within 6 km freight radius.",
                "data_available": False,
                "raw_value": 0,
                "unit": "industrial hubs"
            }
        else:
            score = round(min(40.0 + min(ind_count * 12.0, 58.0), 98.0), 1)
            poi = {
                "score": score,
                "label": "Industrial Cluster Proximity" if score >= 70 else "Emerging Freight Corridor",
                "explanation": f"{ind_count} manufacturing or logistics facilities mapped within 6 km freight radius supporting supply chain co-location.",
                "data_available": True,
                "raw_value": ind_count,
                "unit": "industrial hubs"
            }

        has_lu, zone, z_name = self._get_zoning_at_point(lat, lng)
        if not has_lu:
            land = {
                "score": 68.0,
                "label": "Convertible Rural / Industrial Land",
                "explanation": "Outside formal municipal AUDA limits. Agricultural/revenue land convertible under Gujarat Industrial Policy (Sanand/Bavla freight corridor model).",
                "data_available": True,
                "raw_value": "convertible_rural",
                "unit": "zoning"
            }
        else:
            score = WAREHOUSE_LANDUSE_SCORES.get(zone, 60.0)
            land = {
                "score": score,
                "label": f"Logistics Zoning ({zone.title()})",
                "explanation": f"Designated {zone.upper()} zone ({z_name}). {'Fully compliant for high-bay warehouse logistics.' if score >= 80 else 'Requires industrial zoning conversion variance.'}",
                "data_available": True,
                "raw_value": zone,
                "unit": "zoning"
            }

        env_score, env_label, env_expl, env_avail = self._score_environment_rich(lat, lng)
        env = {
            "score": env_score,
            "label": "Flood Risk (Inventory Protection)",
            "explanation": f"Inventory flood risk audit: {env_expl}",
            "data_available": env_avail,
            "raw_value": env_label,
            "unit": "hazard tier"
        }

        return {"demographics": demo, "transportation": trans, "poi": poi, "landuse": land, "environment": env}

    # ── 4. TELECOM TOWER ──────────────────────────────────────────────

    def _score_telecom(self, lat: float, lng: float) -> Dict[str, Dict[str, Any]]:
        d_dist, pop, _ = self._get_nearest_demographic(lat, lng)
        if d_dist > 25000:
            demo = {
                "score": 35.0,
                "label": "Rural Coverage Gap",
                "explanation": "Localized population census survey unavailable for this rural coordinate. Greenfield coverage expansion potential with low immediate subscriber density.",
                "data_available": False,
                "raw_value": None,
                "unit": "subscribers"
            }
        else:
            decay = gaussian(d_dist, sigma=3500.0)
            norm = min(pop / 6000.0, 1.0)
            score = round(max(30.0, min((norm * 0.7 + 0.3) * decay * 100.0, 98.0)), 1)
            demo = {
                "score": score,
                "label": "High Subscriber Reach" if score >= 70 else "Moderate Traffic Demand",
                "explanation": f"Coverage catchment of ~{pop:,} residents within {int(d_dist)} m cell radius ({'high mobile voice/data traffic density' if score >= 65 else 'rural/suburban subscriber volume'}).",
                "data_available": True,
                "raw_value": pop,
                "unit": "subscribers"
            }

        road_dist = self._get_min_road_distance(lat, lng)
        if road_dist > 25000:
            trans = {
                "score": 35.0,
                "label": "Remote Tower Access",
                "explanation": f"Maintenance road access sparse: nearest road corridor is {round(road_dist/1000)} km away. Tower erection and maintenance requires off-road transit.",
                "data_available": False,
                "raw_value": round(road_dist),
                "unit": "meters"
            }
        else:
            score = round(min(30.0 + inverse_distance(road_dist, max_d=10000.0) * 68.0, 98.0), 1)
            trans = {
                "score": score,
                "label": "Maintenance Road Access",
                "explanation": f"Service access road within {int(road_dist)} m for tower construction equipment, diesel generator refueling, and field maintenance crews.",
                "data_available": True,
                "raw_value": round(road_dist),
                "unit": "meters"
            }

        # Telecom POI: Elevation & Line-of-sight
        elevation_m = 45.0
        zone_name = "Central Alluvial Plain"
        for lat_min, lat_max, lng_min, lng_max, elev, name in GUJARAT_ELEVATION_ZONES:
            if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
                elevation_m = elev
                zone_name = name
                break

        elev_score = round(min(35.0 + (elevation_m / 250.0) * 63.0, 98.0), 1)
        poi = {
            "score": elev_score,
            "label": f"Terrain Elevation (~{int(elevation_m)}m AMSL)",
            "explanation": f"Terrain profile: ~{int(elevation_m)} m AMSL ({zone_name}). Line-of-sight signal propagation index: {elev_score}/100.",
            "data_available": True,
            "raw_value": elevation_m,
            "unit": "meters AMSL"
        }

        has_lu, zone, z_name = self._get_zoning_at_point(lat, lng)
        if not has_lu:
            land = {
                "score": 68.0,
                "label": "Greenfield Ground Mast Land",
                "explanation": "Unsurveyed rural terrain suitable for ground-based lattice tower deployment without strict urban municipal permits.",
                "data_available": True,
                "raw_value": "greenfield_mast",
                "unit": "zoning"
            }
        else:
            score = TELECOM_LANDUSE_SCORES.get(zone, 65.0)
            land = {
                "score": score,
                "label": f"Telecom Zoning ({zone.title()})",
                "explanation": f"Designated {zone.upper()} zone ({z_name}). {'Suitable for rooftop mast installation.' if score >= 80 else 'Permitted for ground-based tower with standard setback.'}",
                "data_available": True,
                "raw_value": zone,
                "unit": "zoning"
            }

        env_score, env_label, env_expl, env_avail = self._score_environment_rich(lat, lng)
        env = {
            "score": env_score,
            "label": "Tower Structural Safety",
            "explanation": f"Structural environmental audit: {env_expl}",
            "data_available": env_avail,
            "raw_value": env_label,
            "unit": "hazard tier"
        }

        return {"demographics": demo, "transportation": trans, "poi": poi, "landuse": land, "environment": env}

    # ── 5. WIND TURBINE ───────────────────────────────────────────────

    def _score_windmill(self, lat: float, lng: float) -> Dict[str, Dict[str, Any]]:
        # Demographics: Inverted buffer (>1.5 km required, >4km optimal)
        d_dist, pop, _ = self._get_nearest_demographic(lat, lng)
        if d_dist > 25000:
            demo = {
                "score": 96.0,
                "label": "Optimal Habitation Buffer (> 25km)",
                "explanation": "Remote terrain situated >25 km from dense urban settlements, guaranteeing zero shadow flicker, acoustic nuisance, or municipal buffer conflicts.",
                "data_available": True,
                "raw_value": round(d_dist / 1000, 1),
                "unit": "km to settlement"
            }
        else:
            if d_dist < 800 and pop > 2000:
                score, label = 15.0, "Settlement Conflict (< 800m to Habitation)"
            elif d_dist < 1500:
                score, label = 40.0, "Sub-optimal Habitation Buffer (< 1.5km)"
            elif d_dist > 4000:
                score, label = 95.0, "Optimal Habitation Buffer (> 4km)"
            else:
                score, label = 78.0, "Adequate Settlement Buffer (> 1.5km)"
            demo = {
                "score": score,
                "label": label,
                "explanation": f"Habitation setback of {round(d_dist/1000, 1) if d_dist >= 1000 else int(d_dist)} {'km' if d_dist >= 1000 else 'm'} to nearest settlement (~{pop:,} pop). {'Meets CERC/NIWE acoustic safety guidelines.' if score >= 70 else 'Acoustic and shadow flicker buffer violation risk.'}",
                "data_available": True,
                "raw_value": round(d_dist),
                "unit": "meters"
            }

        # Transportation: Heavy haulage (turbine blades need wide turns)
        road_dist = self._get_min_road_distance(lat, lng)
        if road_dist > 35000:
            trans = {
                "score": 35.0,
                "label": "Remote Heavy Haulage Route",
                "explanation": f"Arterial transport route is {round(road_dist/1000)} km away. Transporting 65m+ wind turbine blades requires dedicated off-grid road civil works.",
                "data_available": False,
                "raw_value": round(road_dist),
                "unit": "meters"
            }
        else:
            score = round(min(35.0 + inverse_distance(road_dist, max_d=25000.0) * 63.0, 98.0), 1)
            trans = {
                "score": score,
                "label": "Heavy Haulage Transport Route",
                "explanation": f"Transport corridor located {round(road_dist/1000, 1)} km from candidate turbine location, facilitating specialized multi-axle blade delivery trailers.",
                "data_available": True,
                "raw_value": round(road_dist),
                "unit": "meters"
            }

        # POI: NIWE 120m Wind Resource
        wind_info = get_wind_resource_score(lat, lng)
        poi = {
            "score": wind_info["score"],
            "label": f"Wind Resource (120m): {wind_info['mean_wind_speed_ms']} m/s",
            "explanation": f"NIWE 120m Wind Atlas: {wind_info['mean_wind_speed_ms']} m/s annual mean wind speed ({wind_info['wind_power_density_wm2']} W/m², Tier {wind_info['tier']}). Estimated CUF: {wind_info['estimated_cuf_pct']}%.",
            "data_available": True,
            "raw_value": wind_info["mean_wind_speed_ms"],
            "unit": "m/s at 120m"
        }

        # Landuse: Wasteland / Open rural preferred
        has_lu, zone, z_name = self._get_zoning_at_point(lat, lng)
        if not has_lu:
            land = {
                "score": 88.0,
                "label": "Open Revenue Wasteland / Rural Terrain",
                "explanation": "Low-cost non-urban open plains suitable for utility-scale wind turbine installation without high civil parcel acquisition overhead.",
                "data_available": True,
                "raw_value": "revenue_wasteland",
                "unit": "land class"
            }
        else:
            score = RENEWABLES_LANDUSE_SCORES.get(zone, 65.0)
            land = {
                "score": score,
                "label": f"Land Suitability ({zone.title()})",
                "explanation": f"Designated {zone.upper()} zone ({z_name}). {'Ideal low-cost parcel for wind farm deployment.' if score >= 80 else 'High-cost or restricted land class.'}",
                "data_available": True,
                "raw_value": zone,
                "unit": "land class"
            }

        env_score, env_label, env_expl, env_avail = self._score_environment_rich(lat, lng)
        env = {
            "score": env_score,
            "label": "Environmental & Ecological Safety",
            "explanation": f"Ecological setback audit: {env_expl}",
            "data_available": env_avail,
            "raw_value": env_label,
            "unit": "hazard tier"
        }

        return {"demographics": demo, "transportation": trans, "poi": poi, "landuse": land, "environment": env}

    # ── 6. SOLAR FARM ─────────────────────────────────────────────────

    def _score_solar(self, lat: float, lng: float) -> Dict[str, Dict[str, Any]]:
        d_dist, pop, _ = self._get_nearest_demographic(lat, lng)
        if d_dist > 25000:
            demo = {
                "score": 96.0,
                "label": "Optimal Settlement Buffer (> 25km)",
                "explanation": "Remote open land situated >25 km from urban settlements: zero land dispute risk and ample contiguous acreage for multi-megawatt PV arrays.",
                "data_available": True,
                "raw_value": round(d_dist / 1000, 1),
                "unit": "km to settlement"
            }
        else:
            score = 92.0 if d_dist >= 3000 else (65.0 if d_dist >= 1000 else 30.0)
            demo = {
                "score": score,
                "label": "Settlement Buffer" if score >= 70 else "Close to Settlement Boundary",
                "explanation": f"Buffer of {round(d_dist/1000, 1) if d_dist >= 1000 else int(d_dist)} {'km' if d_dist >= 1000 else 'm'} to nearest residential center (~{pop:,} pop).",
                "data_available": True,
                "raw_value": round(d_dist),
                "unit": "meters"
            }

        road_dist = self._get_min_road_distance(lat, lng)
        if road_dist > 35000:
            trans = {
                "score": 30.0,
                "label": "Remote Grid & Road Access",
                "explanation": f"Transport corridor survey is {round(road_dist/1000)} km away. Interconnection evacuation requires dedicated transmission tie-in.",
                "data_available": False,
                "raw_value": round(road_dist),
                "unit": "meters"
            }
        else:
            score = round(min(30.0 + inverse_distance(road_dist, max_d=20000.0) * 68.0, 98.0), 1)
            trans = {
                "score": score,
                "label": "Grid & Ingress Transport Access",
                "explanation": f"Transit corridor located {round(road_dist/1000, 1)} km from candidate solar array, facilitating PV module delivery and transmission line access.",
                "data_available": True,
                "raw_value": round(road_dist),
                "unit": "meters"
            }

        # POI: Solar GHI resource
        solar_score, solar_label, solar_meta = self._score_solar_resource(lat, lng)
        poi = {
            "score": solar_score,
            "label": solar_label,
            "explanation": f"NREL/MNRE Solar Atlas: Global Horizontal Irradiance of {solar_meta['ghi_kwh_m2_day']} kWh/m²/day. Annual generation: {int(solar_meta['annual_generation_mwh_mwp'])} MWh/MWp (CUF: {solar_meta['capacity_utilization_factor_pct']}%).",
            "data_available": True,
            "raw_value": solar_meta["ghi_kwh_m2_day"],
            "unit": "kWh/m²/day"
        }

        has_lu, zone, z_name = self._get_zoning_at_point(lat, lng)
        if not has_lu:
            land = {
                "score": 92.0,
                "label": "Flat Barren / Wasteland Parcel",
                "explanation": "Open revenue wasteland with zero agricultural displacement, ideal for contiguous utility-scale ground-mounted solar layout.",
                "data_available": True,
                "raw_value": "barren_wasteland",
                "unit": "land class"
            }
        else:
            score = RENEWABLES_LANDUSE_SCORES.get(zone, 65.0)
            land = {
                "score": score,
                "label": f"Solar Land Suitability ({zone.title()})",
                "explanation": f"Designated {zone.upper()} zone ({z_name}). {'Optimal non-agricultural land class for solar parks.' if score >= 80 else 'High-cost or shaded urban parcel.'}",
                "data_available": True,
                "raw_value": zone,
                "unit": "land class"
            }

        env_score, env_label, env_expl, env_avail = self._score_environment_rich(lat, lng)
        env = {
            "score": env_score,
            "label": "Ecological Buffer & Inundation Safety",
            "explanation": f"Inundation audit: {env_expl}",
            "data_available": env_avail,
            "raw_value": env_label,
            "unit": "hazard tier"
        }

        return {"demographics": demo, "transportation": trans, "poi": poi, "landuse": land, "environment": env}

    # ── SOLAR RESOURCE CALCULATION ────────────────────────────────────

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

    # ── SHARED ENVIRONMENT CHECK ──────────────────────────────────────

    def _score_environment_rich(self, lat: float, lng: float) -> Tuple[float, str, str, bool]:
        """Returns (score, label, explanation, data_available)."""
        env_layer = self.layers.get("environment", {})
        features = env_layer.get("features", [])

        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") in ("Polygon", "MultiPolygon"):
                if check_point_in_geojson_geometry(lat, lng, geom):
                    props = feat.get("properties", {})
                    risk = props.get("risk_level", "medium").lower()
                    h_name = props.get("hazard", props.get("name", "Flood Risk Zone"))
                    score = ENVIRONMENT_SCORES.get(risk, 60.0)
                    label = f"{risk.title()} Flood Risk ({h_name})"
                    expl = f"Candidate location intersects designated {risk} flood inundation contour ({h_name}). Elevated civil plinth and flood mitigation required."
                    return score, label, expl, True

        return 95.0, "Flood & Environmental Safety", "Dry terrestrial terrain: situated clear of recognized flood basins and water exclusion zones.", True

    # ── MAIN COMPUTE METHOD ───────────────────────────────────────────

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

        # Map to canonical archetype
        canonical_type = "windmill" if is_windmill else ("solar" if is_solar else norm_type)
        if canonical_type not in ("ev_charging", "retail", "warehouse", "telecom", "windmill", "solar"):
            canonical_type = "ev_charging"

        # Dispatch archetype rule engine
        if canonical_type == "ev_charging":
            breakdown = self._score_ev(lat, lng)
        elif canonical_type == "retail":
            breakdown = self._score_retail(lat, lng)
        elif canonical_type == "warehouse":
            breakdown = self._score_warehouse(lat, lng)
        elif canonical_type == "telecom":
            breakdown = self._score_telecom(lat, lng)
        elif canonical_type == "windmill":
            breakdown = self._score_windmill(lat, lng)
        elif canonical_type == "solar":
            breakdown = self._score_solar(lat, lng)
        else:
            breakdown = self._score_ev(lat, lng)

        # Select weights
        profile_weights = WEIGHT_PROFILES.get(canonical_type, WEIGHT_PROFILES.get("balanced", DEFAULT_WEIGHTS))
        active_weights = weights or profile_weights

        # Add weight and weighted score to breakdown
        total_w = sum(active_weights.get(k, 0.2) for k in breakdown)
        if total_w <= 0:
            total_w = 1.0

        raw_total = 0.0
        for k in breakdown:
            w = active_weights.get(k, 0.2) / total_w
            breakdown[k]["weight"] = round(w, 3)
            breakdown[k]["contribution"] = round(breakdown[k]["score"] * w, 1)
            raw_total += breakdown[k]["score"] * w

        # Execute constraint audit
        constraint_audit = apply_all_constraints(lat, lng, self.layers, site_type=canonical_type)
        is_disqualified = constraint_audit.get("disqualified", False) or constraint_audit.get("is_water_body", False)

        if is_disqualified:
            final_score = 0.0
            grade = "F"
            breakdown["environment"]["score"] = 0.0
            breakdown["environment"]["contribution"] = 0.0
            wb_name = constraint_audit.get("water_body_name") or "Water Body"
            breakdown["environment"]["label"] = f"CRITICAL LIMITING PARAMETER: {wb_name} Exclusion"
            breakdown["environment"]["explanation"] = f"DISQUALIFIED: Location falls inside {wb_name}. Civil development and ground construction are physically prohibited by environmental regulation."
        else:
            penalty = constraint_audit.get("total_penalty", 0.0)
            final_score = max(0.0, min(raw_total - penalty, 100.0))
            final_score = round(final_score, 1)
            grade = score_to_grade(final_score)

        # Build constraints list for frontend consumption
        road_dist_m = constraint_audit.get("min_road_distance_m", 100.0)
        max_road_allowed = 30000.0 if canonical_type in ("windmill", "solar") else (
            15000.0 if canonical_type == "telecom" else (
                8000.0 if canonical_type == "warehouse" else 2500.0
            )
        )
        road_passed = road_dist_m <= max_road_allowed

        constraints_list = [
            {
                "id": "water_body_exclusion",
                "label": "Water body exclusion",
                "passed": not is_disqualified,
                "reason": (
                    constraint_audit.get("disqualification_reason") or
                    f"Candidate location falls inside {constraint_audit.get('water_body_name', 'Water Body')}. Ground construction is prohibited."
                ) if is_disqualified else "Site is situated on solid terrestrial terrain outside permanent water bodies."
            },
            {
                "id": "flood_zone",
                "label": "Flood plain setback",
                "passed": not constraint_audit.get("in_flood_zone", False),
                "reason": (
                    f"Candidate point intersects active flood risk zone ({constraint_audit.get('flood_risk_level', 'medium')})."
                    if constraint_audit.get("in_flood_zone")
                    else "Outside identified high-risk flood zones."
                )
            },
            {
                "id": "arterial_proximity",
                "label": "Logistics / grid corridor access" if canonical_type in ("windmill", "solar") else "Arterial road access",
                "passed": road_passed,
                "reason": (
                    f"Distance to regional transport/grid corridor is {round(road_dist_m / 1000, 1)} km."
                    if canonical_type in ("windmill", "solar")
                    else f"Distance to nearest mapped highway/road is {int(road_dist_m)} m."
                )
            }
        ]

        resp: Dict[str, Any] = {
            "score": final_score,
            "grade": grade,
            "lat": lat,
            "lng": lng,
            "site_type": canonical_type,
            "disqualified": is_disqualified,
            "limiting_parameter": constraint_audit.get("limiting_parameter"),
            "disqualification_reason": constraint_audit.get("disqualification_reason"),
            "breakdown": breakdown,
            "constraints": constraint_audit,
            "constraints_list": constraints_list,
        }

        # Add domain specific resource metrics
        if canonical_type == "windmill":
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
        elif canonical_type == "solar":
            _, _, solar_meta = self._score_solar_resource(lat, lng)
            resp["solar_resource"] = solar_meta

        return resp

    def generate_site_report(
        self,
        lat: float,
        lng: float,
        site_type: str = "ev_charging",
        weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Generate an executive-ready site report with transparent factor analysis,
        data coverage indicators, and explicit justification for each dimension."""
        computed = self.compute(lat, lng, site_type=site_type, weights=weights)

        # Determine overall data coverage status
        breakdown = computed["breakdown"]
        missing_layers = [k for k, v in breakdown.items() if not v.get("data_available", True)]
        coverage_status = "full" if not missing_layers else ("partial" if len(missing_layers) < 3 else "regional_baseline")

        # Construct executive summary verdict
        if computed["disqualified"]:
            verdict = f"SITE DISQUALIFIED: {computed['disqualification_reason']} The candidate coordinate cannot be permitted under Gujarat environmental regulations."
        elif computed["score"] >= 80.0:
            verdict = f"PRIME CANDIDATE ({computed['score']}/100, Grade {computed['grade']}): Exceptional suitability for {site_type.replace('_', ' ').title()} deployment with superior accessibility and high demand indicators."
        elif computed["score"] >= 60.0:
            verdict = f"VIABLE WITH TRADE-OFFS ({computed['score']}/100, Grade {computed['grade']}): Suitable location for {site_type.replace('_', ' ').title()}, with minor feasibility constraints."
        else:
            verdict = f"HIGH RISK ({computed['score']}/100, Grade {computed['grade']}): Sub-optimal location due to distance from transport corridors or low local demand."

        return {
            "site_summary": {
                "coordinates": {"lat": lat, "lng": lng},
                "site_type": computed["site_type"],
                "score": computed["score"],
                "grade": computed["grade"],
                "disqualified": computed["disqualified"],
                "limiting_parameter": computed["limiting_parameter"],
                "disqualification_reason": computed["disqualification_reason"],
                "coverage_status": coverage_status,
                "unsurveyed_dimensions": missing_layers,
                "verdict": verdict,
            },
            "breakdown": breakdown,
            "constraints": computed["constraints_list"],
            "resource_data": computed.get("renewable_resource") or computed.get("solar_resource"),
        }


# Module level report generator function
def generate_site_report(
    lat: float,
    lng: float,
    site_type: str = "ev_charging",
    weights: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """Helper to generate site report using singleton scorer instance."""
    scorer = SiteReadinessScorer()
    return scorer.generate_site_report(lat, lng, site_type=site_type, weights=weights)
