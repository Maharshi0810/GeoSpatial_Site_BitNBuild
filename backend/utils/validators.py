from typing import Optional, List, Dict
from pydantic import BaseModel, Field

class WeightConfig(BaseModel):
    demographics: float = Field(default=0.25, ge=0.0, le=1.0)
    transportation: float = Field(default=0.20, ge=0.0, le=1.0)
    poi: float = Field(default=0.20, ge=0.0, le=1.0)
    landuse: float = Field(default=0.15, ge=0.0, le=1.0)
    environment: float = Field(default=0.20, ge=0.0, le=1.0)

class ScoreRequest(BaseModel):
    lat: float = Field(..., description="Latitude of candidate site")
    lng: float = Field(..., description="Longitude of candidate site")
    site_type: Optional[str] = Field("ev_charging", description="Facility archetype: ev_charging, retail, warehouse, renewables, telecom")
    sub_filter: Optional[str] = Field(None, description="Optional facility sub-profile filter")
    weights: Optional[WeightConfig] = None

class SiteItem(BaseModel):
    lat: float
    lng: float
    label: str = "Site"

class CompareRequest(BaseModel):
    sites: List[SiteItem] = Field(..., min_length=2, max_length=10)
    site_type: Optional[str] = Field("ev_charging", description="Facility archetype for comparison")
    weights: Optional[WeightConfig] = None
