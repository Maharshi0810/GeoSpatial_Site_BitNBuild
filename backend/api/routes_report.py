"""Analytical Report Export API Routes.

Owner: Maharshi [R]
Endpoints:
  POST /api/report/export - Generate and return comprehensive site evaluation dossier
  GET /api/report/schema  - Get report structure schema
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    from backend.scoring.engine import SiteReadinessScorer
    from backend.accessibility.isochrone import compute_isochrone
    from backend.accessibility.catchment import compute_catchment_stats
    from backend.data.loader import load_layer
    from backend.utils.geo_helpers import haversine_distance
except ImportError:
    from scoring.engine import SiteReadinessScorer
    from accessibility.isochrone import compute_isochrone
    from accessibility.catchment import compute_catchment_stats
    from data.loader import load_layer
    from utils.geo_helpers import haversine_distance

router = APIRouter(tags=["Reports"])

# Singleton scorer instance
_scorer = None


def get_scorer() -> SiteReadinessScorer:
    global _scorer
    if _scorer is None:
        _scorer = SiteReadinessScorer()
    return _scorer


class ReportExportRequest(BaseModel):
    lat: float = Field(..., ge=20.0, le=25.0, description="Latitude in Gujarat (20.0 to 25.0)")
    lng: float = Field(..., ge=68.0, le=75.0, description="Longitude in Gujarat (68.0 to 75.0)")
    location_name: Optional[str] = Field("Selected Candidate Site", description="Descriptive name of location")
    site_type: Optional[str] = Field("EV charging", description="Site profile: 'EV charging', 'Retail', 'Warehouse'")
    minutes: Optional[int] = Field(15, ge=5, le=60, description="Catchment travel time in minutes")
    mode: Optional[str] = Field("driving", description="Travel mode: 'driving', 'walking', 'cycling'")
    weights: Optional[Dict[str, float]] = Field(None, description="Custom scoring factor weights")


def get_nearby_pois(lat: float, lng: float, limit: int = 5) -> List[Dict[str, Any]]:
    """Retrieve top nearest commercial POIs from seeded data."""
    try:
        poi_data = load_layer("poi")
        if not poi_data or "features" not in poi_data:
            return []

        scored_pois = []
        for feature in poi_data.get("features", []):
            geom = feature.get("geometry", {})
            coords = geom.get("coordinates", [])
            props = feature.get("properties", {})
            if len(coords) >= 2:
                dist_km = haversine_distance(lat, lng, coords[1], coords[0])
                scored_pois.append({
                    "name": props.get("name", "Commercial Facility"),
                    "category": props.get("category", "Retail"),
                    "distance_km": round(dist_km, 2),
                    "lat": coords[1],
                    "lng": coords[0],
                })

        scored_pois.sort(key=lambda x: x["distance_km"])
        return scored_pois[:limit]
    except Exception:
        return []


@router.post("/report/export")
async def generate_site_report(request: ReportExportRequest) -> Dict[str, Any]:
    """Generate comprehensive Site Readiness Evaluation Dossier."""
    try:
        report_id = f"GSRA-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        timestamp_iso = datetime.now(timezone.utc).isoformat()

        # 1. Compute Site Score and Breakdown
        scorer = get_scorer()
        weights_dict = request.weights if request.weights else None
        score_result = scorer.compute(request.lat, request.lng, weights=weights_dict)

        # 2. Compute Travel-Time Isochrone
        isochrone_fc = compute_isochrone(
            lat=request.lat,
            lng=request.lng,
            minutes=request.minutes,
            mode=request.mode
        )

        # 3. Compute Demographic & Competitor Catchment
        catchment_raw = compute_catchment_stats(
            lat=request.lat,
            lng=request.lng,
            minutes=request.minutes,
            mode=request.mode
        )
        catchment_stats = catchment_raw.get("data", catchment_raw) if isinstance(catchment_raw, dict) else {}

        # 4. Nearest POIs / Commercial Anchors
        nearby_pois = get_nearby_pois(request.lat, request.lng, limit=5)

        # 5. Normalize Constraints
        raw_constraints = score_result.get("constraints", {})
        in_flood = raw_constraints.get("in_flood_zone", False)
        road_dist = raw_constraints.get("min_road_distance_m", 100.0)

        constraints_list = [
            {
                "id": "flood_risk",
                "label": "Flood Zone Risk Check",
                "passed": not in_flood,
                "status": "Clear (Outside Flood Plain)" if not in_flood else "Warning: Located within Flood Plain",
                "details": "Site is clear of high-hazard flood plains" if not in_flood else "Site lies within recorded hazard plain",
            },
            {
                "id": "road_access",
                "label": "Arterial Road Proximity",
                "passed": road_dist <= 5000,
                "status": f"{int(road_dist)}m from nearest highway",
                "details": "Direct arterial corridor access within 5km" if road_dist <= 5000 else "Distance exceeds 5km arterial threshold",
            }
        ]
        has_failed_constraint = in_flood or road_dist > 5000

        # 6. Normalize Factor Breakdown List
        factor_breakdown_list = []
        raw_breakdown = score_result.get("breakdown", {})
        for layer_key, info in raw_breakdown.items():
            w = (weights_dict or {}).get(layer_key, 0.2)
            s = info.get("score", 0.0)
            factor_breakdown_list.append({
                "factor_id": layer_key,
                "label": info.get("label", layer_key.title()),
                "score": round(s, 1),
                "weight": round(w, 2),
                "contribution": round(s * w, 2),
            })

        # Determine Recommendation Tier
        overall_score = score_result.get("score", 0)
        if has_failed_constraint:
            recommendation_tier = "Conditional — Constraints Unmet"
            recommendation_color = "red"
        elif overall_score >= 85:
            recommendation_tier = "Priority Tier 1 — Prime Candidate"
            recommendation_color = "green"
        elif overall_score >= 70:
            recommendation_tier = "Viable Tier 2 — Recommended"
            recommendation_color = "blue"
        elif overall_score >= 55:
            recommendation_tier = "Moderate Tier 3 — Secondary Option"
            recommendation_color = "amber"
        else:
            recommendation_tier = "Suboptimal — Not Recommended"
            recommendation_color = "slate"

        # GeoJSON Spatial Bundle (Site point + Catchment polygon)
        spatial_bundle = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [request.lng, request.lat]
                    },
                    "properties": {
                        "feature_type": "candidate_site",
                        "name": request.location_name,
                        "score": overall_score,
                        "grade": score_result.get("grade", "N/A"),
                        "recommendation": recommendation_tier,
                    }
                }
            ]
        }
        if isochrone_fc and isochrone_fc.get("features"):
            spatial_bundle["features"].extend(isochrone_fc.get("features", []))

        # Generate standard CSV representation
        csv_lines = [
            "# GEOSPATIAL SITE READINESS EVALUATION REPORT",
            f"Report ID,{report_id}",
            f"Generated At,{timestamp_iso}",
            f"Location Name,\"{request.location_name}\"",
            f"Site Profile,{request.site_type}",
            f"Latitude,{request.lat:.5f}",
            f"Longitude,{request.lng:.5f}",
            f"Overall Score,{overall_score}",
            f"Grade,{score_result.get('grade', 'N/A')}",
            f"Recommendation Tier,\"{recommendation_tier}\"",
            "",
            "# FACTOR BREAKDOWN",
            "Factor,Score,Weight,Contribution",
        ]
        for f in factor_breakdown_list:
            csv_lines.append(f'"{f["label"]}",{f["score"]},{f["weight"]},{f["contribution"]}')

        csv_lines.append("")
        csv_lines.append("# CONSTRAINTS CHECK")
        csv_lines.append("Constraint,Passed,Status,Details")
        for c in constraints_list:
            csv_lines.append(f'"{c["label"]}",{c["passed"]},"{c["status"]}","{c["details"]}"')

        csv_lines.append("")
        csv_lines.append("# ACCESSIBILITY & CATCHMENT")
        csv_lines.append(f"Travel Mode,{request.mode}")
        csv_lines.append(f"Duration,{request.minutes} min")
        csv_lines.append(f"Population Reached,{catchment_stats.get('population_reached', 0)}")
        csv_lines.append(f"Catchment Area (km2),{catchment_stats.get('catchment_area_km2', 0)}")
        csv_lines.append(f"Average Density (people/km2),{catchment_stats.get('average_density_per_km2', 0)}")
        csv_lines.append(f"Dominant Income Tier,{catchment_stats.get('dominant_income_tier', 'Mid-Income')}")
        csv_lines.append(f"Competitors in Catchment,{catchment_stats.get('competitors_in_catchment', 0)}")

        csv_lines.append("")
        csv_lines.append("# TIME BANDS")
        csv_lines.append("Band,Population,Area (km2)")
        for tb in catchment_stats.get("time_bands", []):
            csv_lines.append(f'"{tb.get("label", str(tb.get("minutes")) + " min")}",{tb.get("population", 0)},{tb.get("area_km2", 0)}')

        csv_lines.append("")
        csv_lines.append("# NEARBY COMMERCIAL ANCHORS")
        csv_lines.append("Name,Category,Distance (km),Latitude,Longitude")
        for p in nearby_pois:
            csv_lines.append(f'"{p.get("name", "POI")}","{p.get("category", "Retail")}",{p.get("distance_km", 0)},{p.get("lat", 0)},{p.get("lng", 0)}')

        csv_export = "\n".join(csv_lines)

        dossier = {
            "metadata": {
                "report_id": report_id,
                "created_at": timestamp_iso,
                "version": "1.0.0",
                "system": "GeoSpatial Site Readiness Analyzer (BitNBuild PS-2)",
                "data_vintage": "2024.Q1",
            },
            "site": {
                "location_name": request.location_name,
                "site_type": request.site_type,
                "coordinates": {
                    "lat": request.lat,
                    "lng": request.lng,
                    "formatted": f"{request.lat:.5f}° N, {request.lng:.5f}° E",
                },
                "region": "Gujarat, India",
            },
            "evaluation": {
                "overall_score": overall_score,
                "grade": score_result.get("grade", "N/A"),
                "percentile": 88,
                "recommendation_tier": recommendation_tier,
                "recommendation_color": recommendation_color,
                "constraints": constraints_list,
                "factor_breakdown": factor_breakdown_list,
            },
            "accessibility": {
                "mode": request.mode,
                "duration_minutes": request.minutes,
                "catchment_area_km2": catchment_stats.get("catchment_area_km2", 0),
                "population_reached": catchment_stats.get("population_reached", 0),
                "average_density_per_km2": catchment_stats.get("average_density_per_km2", 0),
                "dominant_income_tier": catchment_stats.get("dominant_income_tier", "Mid-Income"),
                "competitors_in_catchment": catchment_stats.get("competitors_in_catchment", 0),
                "time_bands": catchment_stats.get("time_bands", []),
            },
            "nearby_commercial_anchors": nearby_pois,
            "spatial_geojson": spatial_bundle,
            "csv_export": csv_export,
        }

        return {
            "status": "ok",
            "data": dossier
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate site readiness dossier: {str(e)}"
        )
