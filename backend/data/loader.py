"""GeoJSON and Spatial Layer Loader.

Owner: Maharshi [R]
Reads standardized GeoJSON layers from DATA_DIR for scoring, hotspot, and map APIs.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

try:
    from backend.config import DATA_DIR
except ImportError:
    try:
        from config import DATA_DIR
    except ImportError:
        DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

LAYER_REGISTRY: Dict[str, Dict[str, Any]] = {
    "demographics": {
        "id": "demographics",
        "name": "Population Density",
        "type": "heatmap",
        "path": "demographics/population_density.geojson",
        "alt_path": "demographics.geojson",
        "value_field": "population",
        "description": "Census-calibrated population density grid and urban clusters across Gujarat",
        "color": "#ff5722",
        "unit": "people/sq km",
    },
    "transportation": {
        "id": "transportation",
        "name": "Road Network",
        "type": "line",
        "path": "transportation/road_network.geojson",
        "alt_path": "transportation.geojson",
        "value_field": None,
        "description": "National highways (NH-48, NE-1), arterial expressways, and transit corridors",
        "color": "#2196f3",
        "unit": "hierarchy",
    },
    "poi": {
        "id": "poi",
        "name": "Points of Interest",
        "type": "point",
        "path": "poi/competitors.geojson",
        "alt_path": "poi.geojson",
        "value_field": "revenue_index",
        "description": "Commercial retail competitors, EV charging stations, banks, and fuel stations",
        "color": "#4caf50",
        "unit": "category",
    },
    "landuse": {
        "id": "landuse",
        "name": "Land Use & Zoning",
        "type": "fill",
        "path": "landuse/zoning.geojson",
        "alt_path": "landuse.geojson",
        "value_field": "zone_type",
        "description": "Commercial (C-1, C-2), industrial GIDC zones, residential, and agricultural parcels",
        "color": "#9c27b0",
        "unit": "zoning_code",
    },
    "environment": {
        "id": "environment",
        "name": "Environmental Risk",
        "type": "fill",
        "path": "environment/flood_zones.geojson",
        "alt_path": "environment.geojson",
        "value_field": "risk_level",
        "description": "Sabarmati and coastal river flood spillover zones and hazard buffers",
        "color": "#f44336",
        "unit": "risk_level",
    },
}

_LAYER_CACHE: Dict[str, Dict[str, Any]] = {}


def list_layers() -> List[Dict[str, Any]]:
    """Return catalog of all registered geospatial data layers."""
    return list(LAYER_REGISTRY.values())


def load_layer(layer_id: str, use_cache: bool = True) -> Dict[str, Any]:
    """Read a GeoJSON layer from DATA_DIR.
    
    Returns standard FeatureCollection. Raises FileNotFoundError if file is missing.
    """
    if layer_id not in LAYER_REGISTRY:
        raise ValueError(f"Unknown layer ID: '{layer_id}'. Available: {list(LAYER_REGISTRY.keys())}")

    if use_cache and layer_id in _LAYER_CACHE:
        return _LAYER_CACHE[layer_id]

    info = LAYER_REGISTRY[layer_id]
    base_data_dir = Path(DATA_DIR)
    
    candidate_paths = [
        base_data_dir / info["path"],
        base_data_dir / info["alt_path"],
        base_data_dir / layer_id / f"{layer_id}.geojson",
        base_data_dir / f"{layer_id}.json",
    ]

    for p in candidate_paths:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                if use_cache:
                    _LAYER_CACHE[layer_id] = data
                return data

    raise FileNotFoundError(
        f"Could not locate GeoJSON file for layer '{layer_id}' in {base_data_dir}. Expected one of: {[str(p) for p in candidate_paths]}"
    )


def load_layer_as_gdf(layer_id: str):
    """Load layer as a GeoPandas GeoDataFrame if geopandas is installed, otherwise return raw dict."""
    try:
        import geopandas as gpd
        geojson_data = load_layer(layer_id)
        gdf = gpd.GeoDataFrame.from_features(geojson_data.get("features", []), crs="EPSG:4326")
        return gdf
    except ImportError:
        return load_layer(layer_id)


def load_boundary(boundary_name: str = "gujarat_boundary") -> Dict[str, Any]:
    """Load regional boundary GeoJSON."""
    base_data_dir = Path(DATA_DIR)
    p = base_data_dir / f"{boundary_name}.geojson"
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    raise FileNotFoundError(f"Boundary file not found at {p}")
