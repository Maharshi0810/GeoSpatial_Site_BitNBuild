"""Layer Management and GeoJSON Data Serving API

Owner: Daksh [D]
Endpoints:
  GET /api/layers               - List all available data layers with metadata
  GET /api/layers/{id}/geojson  - Retrieve GeoJSON FeatureCollection for a layer
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Path as PathParam

router = APIRouter(prefix="", tags=["Layers"])

# Resolve data directory from environment or relative path
DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data"))

# Official layer definitions per PRD and API_CONTRACT
LAYERS_METADATA: List[Dict[str, Any]] = [
    {
        "id": "demographics",
        "name": "Population Density",
        "type": "heatmap",
        "description": "Census-based population density grid and urban clusters",
        "color": "#ff5722",
        "unit": "people/sq km"
    },
    {
        "id": "transportation",
        "name": "Road Network",
        "type": "line",
        "description": "National and state highways, arterial roads, and transit accessibility",
        "color": "#2196f3",
        "unit": "hierarchy"
    },
    {
        "id": "poi",
        "name": "Points of Interest",
        "type": "point",
        "description": "Commercial competitors, retail anchors, EV chargers, and utility hubs",
        "color": "#4caf50",
        "unit": "category"
    },
    {
        "id": "landuse",
        "name": "Land Use & Zoning",
        "type": "fill",
        "description": "Commercial, industrial, residential, and agricultural land parcels",
        "color": "#9c27b0",
        "unit": "zoning_code"
    },
    {
        "id": "environment",
        "name": "Environmental Risk",
        "type": "fill",
        "description": "Flood-prone hazard zones, coastal regulation zones, and air quality indices",
        "color": "#f44336",
        "unit": "risk_level"
    }
]


def _get_fallback_geojson(layer_id: str) -> Dict[str, Any]:
    """Provide realistic Gujarat sample data when disk GeoJSON files are still being seeded."""
    base_points = [
        {"name": "Ahmedabad Central", "lat": 23.0225, "lng": 72.5714, "pop": 7800, "risk": "low"},
        {"name": "Surat Diamond Hub", "lat": 21.1702, "lng": 72.8311, "pop": 6200, "risk": "medium"},
        {"name": "Vadodara Industrial", "lat": 22.3072, "lng": 73.1812, "pop": 4100, "risk": "low"},
        {"name": "Rajkot Commercial", "lat": 22.3039, "lng": 70.8022, "pop": 3400, "risk": "low"},
        {"name": "Bhavnagar Port Access", "lat": 21.7645, "lng": 72.1519, "pop": 2100, "risk": "medium"},
        {"name": "Gandhinagar Tech Park", "lat": 23.2156, "lng": 72.6369, "pop": 3900, "risk": "low"}
    ]

    if layer_id == "demographics":
        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [p["lng"], p["lat"]]},
                "properties": {
                    "name": p["name"],
                    "population": p["pop"],
                    "density": p["pop"] / 1.5,
                    "value": p["pop"] / 10000.0
                }
            }
            for p in base_points
        ]
    elif layer_id == "poi":
        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [p["lng"] + 0.01, p["lat"] - 0.008]},
                "properties": {
                    "name": f"Competitor Hub - {p['name']}",
                    "category": "retail",
                    "footfall": 850
                }
            }
            for p in base_points
        ]
    elif layer_id == "transportation":
        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.5714, 23.0225],
                        [72.6369, 23.2156],
                        [73.1812, 22.3072],
                        [72.8311, 21.1702]
                    ]
                },
                "properties": {"name": "NH-48 Golden Corridor", "class": "primary"}
            }
        ]
    elif layer_id == "environment":
        # Sample coastal/flood polygon near Gulf of Khambhat
        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [72.3, 21.6],
                        [72.7, 21.6],
                        [72.8, 21.2],
                        [72.4, 21.2],
                        [72.3, 21.6]
                    ]]
                },
                "properties": {
                    "hazard": "Flood Zone 1",
                    "risk_level": "high",
                    "is_exclusion": True
                }
            }
        ]
    elif layer_id == "landuse":
        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [72.50, 23.00],
                        [72.55, 23.00],
                        [72.55, 23.05],
                        [72.50, 23.05],
                        [72.50, 23.00]
                    ]]
                },
                "properties": {"zone": "Commercial C-2", "permitted": True}
            }
        ]
    else:
        features = []

    return {"type": "FeatureCollection", "features": features}


@router.get("/layers")
async def list_layers() -> Dict[str, Any]:
    """Retrieve metadata of all supported geospatial data layers."""
    return {
        "status": "ok",
        "data": LAYERS_METADATA
    }


@router.get("/layers/{layer_id}/geojson")
async def get_layer_geojson(
    layer_id: str = PathParam(..., description="ID of the geospatial layer")
) -> Dict[str, Any]:
    """Retrieve the standard GeoJSON FeatureCollection for a specific layer.
    
    Reads from Maharshi's data folder if present, otherwise returns realistic
    fallback geometries for Gujarat.
    """
    valid_ids = [l["id"] for l in LAYERS_METADATA]
    if layer_id not in valid_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Layer '{layer_id}' not found. Supported: {valid_ids}"
        )

    # Candidate file locations in data directory
    candidate_paths = [
        DATA_DIR / f"{layer_id}.geojson",
        DATA_DIR / layer_id / f"{layer_id}.geojson",
        DATA_DIR / layer_id / "data.geojson",
        DATA_DIR / f"{layer_id}.json"
    ]

    for path in candidate_paths:
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                # Log error and continue to fallback
                pass

    # Fallback to realistic synthetic GeoJSON features
    return _get_fallback_geojson(layer_id)
