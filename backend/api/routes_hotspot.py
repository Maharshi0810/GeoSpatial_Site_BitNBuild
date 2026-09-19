"""Spatial Analytics API Routes: Hotspots, Clusters, and H3 Hexagonal Binning

Owner: Daksh [D]
Endpoints:
  GET /api/hotspots - Getis-Ord Gi* hot and cold spot detection
  GET /api/clusters - DBSCAN spatial clustering for POI and competitors
  GET /api/h3       - Hexagonal grid binning with aggregate metrics
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import APIRouter, Query, HTTPException

try:
    from backend.spatial.clustering import run_dbscan_clustering
    from backend.spatial.hotspot import compute_getis_ord_gi
    from backend.spatial.h3_binning import compute_h3_grid
    from backend.api.routes_layers import get_layer_geojson
except ImportError:
    from spatial.clustering import run_dbscan_clustering
    from spatial.hotspot import compute_getis_ord_gi
    from spatial.h3_binning import compute_h3_grid
    from api.routes_layers import get_layer_geojson

router = APIRouter(prefix="", tags=["Spatial Analytics"])


@router.get("/hotspots")
async def get_hotspots(
    layer: str = Query("demographics", description="Layer ID to analyze (e.g. demographics, poi)"),
    bandwidth: float = Query(25.0, description="Spatial bandwidth distance in km")
) -> Dict[str, Any]:
    """Perform Getis-Ord Gi* spatial statistics to detect hot spots and cold spots."""
    try:
        layer_geojson = await get_layer_geojson(layer)
        features = layer_geojson.get("features", [])
        
        # Run Getis-Ord Gi* detection
        result = compute_getis_ord_gi(features, value_key="value", bandwidth_km=bandwidth)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hotspot analysis failed: {str(e)}")


@router.get("/clusters")
async def get_clusters(
    layer: str = Query("poi", description="Layer ID for point clustering"),
    eps: float = Query(2.5, description="DBSCAN maximum neighborhood distance in km"),
    min_samples: int = Query(3, description="Minimum points required to form a cluster")
) -> Dict[str, Any]:
    """Execute DBSCAN clustering on spatial point features."""
    try:
        layer_geojson = await get_layer_geojson(layer)
        features = layer_geojson.get("features", [])
        
        result = run_dbscan_clustering(features, eps_km=eps, min_samples=min_samples)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


@router.get("/h3")
async def get_h3_grid(
    layer: str = Query("demographics", description="Layer to aggregate into hexagonal bins"),
    resolution: int = Query(7, ge=4, le=9, description="H3 resolution (4=regional, 7=city, 9=block)")
) -> Dict[str, Any]:
    """Generate an H3 hexagonal grid tessellation with aggregated metrics."""
    try:
        layer_geojson = await get_layer_geojson(layer)
        features = layer_geojson.get("features", [])
        
        result = compute_h3_grid(features, resolution=resolution, value_key="value")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"H3 binning failed: {str(e)}")
