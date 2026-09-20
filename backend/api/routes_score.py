"""Scoring API Routes.

Owner: Moksh [M] & Antigravity
Endpoints:
  POST /api/score            - Calculate site readiness score and factor breakdown
  POST /api/score/breakdown  - Return comprehensive factor analysis with weights
  POST /api/score/report     - Return executive site readiness dossier report
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException

try:
    from backend.utils.validators import ScoreRequest
    from backend.scoring.engine import SiteReadinessScorer
except ImportError:
    from utils.validators import ScoreRequest
    from scoring.engine import SiteReadinessScorer

router = APIRouter(tags=["Scoring"])

# Lazy singleton scorer instance
_scorer: SiteReadinessScorer = None


def get_scorer() -> SiteReadinessScorer:
    global _scorer
    if _scorer is None:
        _scorer = SiteReadinessScorer()
    return _scorer


@router.post("/score")
async def compute_site_score(request: ScoreRequest) -> Dict[str, Any]:
    """Compute 0-100 composite readiness score for a candidate coordinate in Gujarat."""
    try:
        scorer = get_scorer()
        weights_dict = None
        if request.weights:
            weights_dict = request.weights.model_dump()

        result = scorer.compute(
            request.lat,
            request.lng,
            site_type=request.site_type or "ev_charging",
            weights=weights_dict
        )

        return {
            "status": "ok",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute site score: {str(e)}"
        )


@router.post("/score/breakdown")
async def compute_score_breakdown(request: ScoreRequest) -> Dict[str, Any]:
    """Return in-depth breakdown of factors, applied weights, and weighted contributions."""
    try:
        scorer = get_scorer()
        weights_dict = request.weights.model_dump() if request.weights else None
        result = scorer.compute(
            request.lat,
            request.lng,
            site_type=request.site_type or "ev_charging",
            weights=weights_dict
        )

        factors = []
        for layer_key, info in result["breakdown"].items():
            w = info.get("weight") or (weights_dict.get(layer_key, 0.2) if weights_dict else 0.2)
            score_val = info["score"]
            factors.append({
                "layer": layer_key,
                "label": info["label"],
                "score": score_val,
                "weight": w,
                "weighted_score": info.get("contribution") or round(score_val * w, 2),
                "explanation": info.get("explanation"),
                "data_available": info.get("data_available", True),
                "raw_value": info.get("raw_value"),
                "unit": info.get("unit"),
                "details": {
                    "raw_score": score_val,
                    "contribution_pct": round((score_val * w) / (result["score"] or 1) * 100, 1)
                }
            })

        return {
            "status": "ok",
            "data": {
                "score": result["score"],
                "grade": result["grade"],
                "lat": result["lat"],
                "lng": result["lng"],
                "site_type": result.get("site_type"),
                "disqualified": result.get("disqualified", False),
                "limiting_parameter": result.get("limiting_parameter"),
                "disqualification_reason": result.get("disqualification_reason"),
                "factors": factors,
                "constraints": result.get("constraints_list") or result.get("constraints")
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate factor breakdown: {str(e)}"
        )


@router.post("/score/report")
async def compute_site_report(request: ScoreRequest) -> Dict[str, Any]:
    """Generate comprehensive executive-ready site report with transparent data coverage and reasons."""
    try:
        scorer = get_scorer()
        weights_dict = request.weights.model_dump() if request.weights else None
        report = scorer.generate_site_report(
            request.lat,
            request.lng,
            site_type=request.site_type or "ev_charging",
            weights=weights_dict
        )
        return {
            "status": "ok",
            "data": report
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate site report: {str(e)}"
        )
