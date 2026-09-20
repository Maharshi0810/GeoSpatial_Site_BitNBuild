"""Site Comparison API Routes.

Owner: Moksh [M]
Endpoint:
  POST /api/compare - Compare multiple candidate sites side-by-side
"""

from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException

try:
    from backend.utils.validators import CompareRequest
    from backend.scoring.engine import SiteReadinessScorer
except ImportError:
    from utils.validators import CompareRequest
    from scoring.engine import SiteReadinessScorer

router = APIRouter(tags=["Comparison"])

_scorer: SiteReadinessScorer = None


def get_scorer() -> SiteReadinessScorer:
    global _scorer
    if _scorer is None:
        _scorer = SiteReadinessScorer()
    return _scorer


@router.post("/compare")
async def compare_sites(request: CompareRequest) -> Dict[str, Any]:
    """Compare 2 to 10 candidate sites in Gujarat side-by-side."""
    try:
        scorer = get_scorer()
        weights_dict = request.weights.model_dump() if request.weights else scorer.weights

        evaluated_sites: List[Dict[str, Any]] = []
        best_site_label = None
        highest_score = -1.0
        best_site_strengths = []

        for item in request.sites:
            result = scorer.compute(
                item.lat,
                item.lng,
                site_type=request.site_type or "ev_charging",
                weights=weights_dict
            )
            site_summary = {
                "label": item.label,
                "lat": item.lat,
                "lng": item.lng,
                "score": result["score"],
                "grade": result["grade"],
                "breakdown": result["breakdown"],
                "constraints": result["constraints"],
            }
            evaluated_sites.append(site_summary)

            if result["score"] > highest_score:
                highest_score = result["score"]
                best_site_label = item.label
                # Find top 2 factor strengths
                sorted_factors = sorted(
                    result["breakdown"].items(),
                    key=lambda kv: kv[1]["score"],
                    reverse=True
                )
                best_site_strengths = [kv[1]["label"] for kv in sorted_factors[:2]]

        summary_text = (
            f"{best_site_label} scores highest ({highest_score}/100) due to strong "
            f"{' and '.join(best_site_strengths) if best_site_strengths else 'layer factors'}."
        )

        return {
            "status": "ok",
            "data": {
                "sites": evaluated_sites,
                "best_site": best_site_label,
                "comparison_summary": summary_text,
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compare candidate sites: {str(e)}"
        )
