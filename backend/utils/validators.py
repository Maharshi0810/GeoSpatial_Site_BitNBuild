from typing import Optional, List, Dict
from pydantic import BaseModel, Field, field_validator

GUJARAT_LAT_MIN = 20.0
GUJARAT_LAT_MAX = 24.7
GUJARAT_LNG_MIN = 68.1
GUJARAT_LNG_MAX = 74.5

class WeightConfig(BaseModel):
    demographics: float = Field(default=0.25, ge=0.0, le=1.0)
    transportation: float = Field(default=0.20, ge=0.0, le=1.0)
    poi: float = Field(default=0.20, ge=0.0, le=1.0)
    landuse: float = Field(default=0.15, ge=0.0, le=1.0)
    environment: float = Field(default=0.20, ge=0.0, le=1.0)

class ScoreRequest(BaseModel):
    lat: float = Field(..., ge=GUJARAT_LAT_MIN, le=GUJARAT_LAT_MAX, description="Latitude in Gujarat (20.0 to 24.7 N)")
    lng: float = Field(..., ge=GUJARAT_LNG_MIN, le=GUJARAT_LNG_MAX, description="Longitude in Gujarat (68.1 to 74.5 E)")
    site_type: Optional[str] = Field("ev_charging", description="Facility archetype: ev_charging, retail, warehouse, renewables, windmill, solar, telecom")
    sub_filter: Optional[str] = Field(None, description="Optional facility sub-profile filter")
    weights: Optional[WeightConfig] = None

    @field_validator('lat')
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (GUJARAT_LAT_MIN <= v <= GUJARAT_LAT_MAX):
            raise ValueError(f"Latitude {v} is outside Gujarat state boundary ({GUJARAT_LAT_MIN} - {GUJARAT_LAT_MAX} N)")
        return v

    @field_validator('lng')
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not (GUJARAT_LNG_MIN <= v <= GUJARAT_LNG_MAX):
            raise ValueError(f"Longitude {v} is outside Gujarat state boundary ({GUJARAT_LNG_MIN} - {GUJARAT_LNG_MAX} E)")
        return v

class SiteItem(BaseModel):
    lat: float = Field(..., ge=GUJARAT_LAT_MIN, le=GUJARAT_LAT_MAX, description="Latitude in Gujarat (20.0 to 24.7 N)")
    lng: float = Field(..., ge=GUJARAT_LNG_MIN, le=GUJARAT_LNG_MAX, description="Longitude in Gujarat (68.1 to 74.5 E)")
    label: str = "Site"

    @field_validator('lat')
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (GUJARAT_LAT_MIN <= v <= GUJARAT_LAT_MAX):
            raise ValueError(f"Latitude {v} is outside Gujarat state boundary ({GUJARAT_LAT_MIN} - {GUJARAT_LAT_MAX} N)")
        return v

    @field_validator('lng')
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not (GUJARAT_LNG_MIN <= v <= GUJARAT_LNG_MAX):
            raise ValueError(f"Longitude {v} is outside Gujarat state boundary ({GUJARAT_LNG_MIN} - {GUJARAT_LNG_MAX} E)")
        return v

class CompareRequest(BaseModel):
    sites: List[SiteItem] = Field(..., min_length=2, max_length=10)
    site_type: Optional[str] = Field("ev_charging", description="Facility archetype: ev_charging, retail, warehouse, renewables, windmill, solar, telecom")
    weights: Optional[WeightConfig] = None
