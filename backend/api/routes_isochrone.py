"""Isochrone and Catchment Analysis API Routes.

Owner: Maharshi [R]
Endpoints:
  GET /api/isochrones - Retrieve travel-time polygon FeatureCollection
  POST /api/catchment - Compute population and competitor catchment metrics
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

try:
    from backend.accessibility.isochrone import compute_isochrone
    from backend.accessibility.catchment import compute_catchment_stats
except ImportError:
    from accessibility.isochrone import compute_isochrone
    from accessibility.catchment import compute_catchment_stats

router = APIRouter(tags=["Accessibility"])


class CatchmentRequest(BaseModel):
    lat: float = Field(..., ge=20.0, le=25.0, description="Latitude in Gujarat (20.0 to 25.0)")
    lng: float = Field(..., ge=68.0, le=75.0, description="Longitude in Gujarat (68.0 to 75.0)")
    minutes: int = Field(15, ge=5, le=60, description="Travel time threshold in minutes (5 to 60)")
    mode: str = Field("driving", description="Travel mode: 'driving', 'walking', or 'cycling'")
    custom_polygon: Optional[Dict[str, Any]] = Field(None, description="Optional custom user polygon geometry")


@router.get("/isochrones")
@router.get("/isochrone")
async def get_isochrones(
    lat: float = Query(23.0225, ge=20.0, le=25.0, description="Latitude in Gujarat"),
    lng: float = Query(72.5714, ge=68.0, le=75.0, description="Longitude in Gujarat"),
    minutes: int = Query(15, ge=5, le=60, description="Travel time threshold in minutes"),
    mode: str = Query("driving", description="Travel mode: 'driving', 'walking', or 'cycling'"),
    multi_band: bool = Query(False, description="Whether to return progressive 5/10/15/30 min rings")
) -> Dict[str, Any]:
    """Generate travel-time isochrone polygons from a candidate coordinate."""
    try:
        intervals = [5, 10, 15, 30] if multi_band else None
        fc = compute_isochrone(lat=lat, lng=lng, minutes=minutes, mode=mode, intervals=intervals)
        return fc
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate isochrone: {str(e)}"
        )


@router.post("/catchment")
async def get_catchment_analysis(request: CatchmentRequest) -> Dict[str, Any]:
    """Calculate demographic reach, population density, and competitor volume within catchment."""
    try:
        result = compute_catchment_stats(
            lat=request.lat,
            lng=request.lng,
            minutes=request.minutes,
            mode=request.mode,
            custom_polygon=request.custom_polygon
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute catchment statistics: {str(e)}"
        )
