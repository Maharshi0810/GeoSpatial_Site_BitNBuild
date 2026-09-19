"""DBSCAN Spatial Clustering for POI, Competitors, and Commercial Anchors

Owner: Daksh [D]
"""

import math
from typing import Dict, Any, List, Optional
import numpy as np
from sklearn.cluster import DBSCAN

# Earth radius in kilometers
EARTH_RADIUS_KM = 6371.0


def run_dbscan_clustering(
    features: List[Dict[str, Any]],
    eps_km: float = 2.5,
    min_samples: int = 3
) -> Dict[str, Any]:
    """Cluster point features using DBSCAN with Great-Circle (Haversine) metric.

    Args:
        features: List of GeoJSON Point features with coordinates [lng, lat]
        eps_km: Neighborhood distance in kilometers
        min_samples: Minimum points required to form a dense core

    Returns:
        GeoJSON FeatureCollection with cluster ID, noise flag, and cluster summaries
    """
    if not features:
        return {
            "type": "FeatureCollection",
            "features": [],
            "summary": {"total_points": 0, "num_clusters": 0, "noise_points": 0}
        }

    # Extract coordinates [lat, lng] in radians for haversine
    coords = []
    valid_features = []
    for f in features:
        geom = f.get("geometry", {})
        if geom.get("type") == "Point" and len(geom.get("coordinates", [])) >= 2:
            lng, lat = geom["coordinates"][0], geom["coordinates"][1]
            coords.append([math.radians(lat), math.radians(lng)])
            valid_features.append(f)

    if not coords:
        return {
            "type": "FeatureCollection",
            "features": [],
            "summary": {"total_points": 0, "num_clusters": 0, "noise_points": 0}
        }

    coords_arr = np.array(coords)
    eps_rad = eps_km / EARTH_RADIUS_KM

    # Run DBSCAN with haversine metric
    db = DBSCAN(eps=eps_rad, min_samples=min_samples, metric="haversine")
    labels = db.fit_predict(coords_arr)

    output_features = []
    cluster_counts: Dict[int, int] = {}

    for idx, label in enumerate(labels):
        f = valid_features[idx]
        props = dict(f.get("properties", {}))
        lbl = int(label)
        props["cluster_id"] = lbl
        props["is_noise"] = (lbl == -1)
        props["cluster_label"] = "Noise" if lbl == -1 else f"Cluster {lbl + 1}"
        
        cluster_counts[lbl] = cluster_counts.get(lbl, 0) + 1

        output_features.append({
            "type": "Feature",
            "geometry": f["geometry"],
            "properties": props
        })

    num_clusters = len([k for k in cluster_counts.keys() if k != -1])
    noise_count = cluster_counts.get(-1, 0)

    return {
        "type": "FeatureCollection",
        "features": output_features,
        "summary": {
            "total_points": len(output_features),
            "num_clusters": num_clusters,
            "noise_points": noise_count,
            "eps_km": eps_km,
            "min_samples": min_samples
        }
    }
