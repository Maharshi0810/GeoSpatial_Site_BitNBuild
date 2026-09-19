"""Getis-Ord Gi* Spatial Hotspot & Coldspot Detection

Owner: Daksh [D]
Computes standard normal z-scores and p-values to identify statistically significant
spatial clusters of high values (hotspots) and low values (coldspots).
"""

import math
from typing import Dict, Any, List, Optional
import numpy as np

# Critical Z-score thresholds
Z_90 = 1.645
Z_95 = 1.960
Z_99 = 2.576


def _norm_cdf(z: float) -> float:
    """Approximation of the standard normal cumulative distribution function."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def compute_getis_ord_gi(
    features: List[Dict[str, Any]],
    value_key: str = "value",
    bandwidth_km: float = 25.0
) -> Dict[str, Any]:
    """Calculate Getis-Ord Gi* statistic for a set of spatial point features.

    Formula:
      G_i^* = (Sum(w_ij * x_j) - X_bar * Sum(w_ij)) / (S * sqrt((n * Sum(w_ij^2) - (Sum(w_ij))^2) / (n - 1)))
      where S = sqrt(Sum(x_j^2) / n - (X_bar)^2)

    Args:
        features: List of GeoJSON Point features
        value_key: Name of property containing the numerical value
        bandwidth_km: Distance threshold in kilometers for spatial weights

    Returns:
        GeoJSON FeatureCollection with z_score, p_value, and classification
    """
    n = len(features)
    if n < 3:
        # Not enough samples for statistical inference
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    **f,
                    "properties": {
                        **f.get("properties", {}),
                        "z_score": 0.0,
                        "p_value": 1.0,
                        "classification": "neutral"
                    }
                }
                for f in features
            ]
        }

    # Extract coordinates and attribute values
    coords = []
    values = []
    for f in features:
        geom = f.get("geometry", {})
        coords.append(geom.get("coordinates", [0.0, 0.0]))
        val = f.get("properties", {}).get(value_key, 1.0)
        try:
            values.append(float(val))
        except (ValueError, TypeError):
            values.append(1.0)

    x = np.array(values, dtype=float)
    x_bar = np.mean(x)
    s = np.std(x, ddof=0)

    if s == 0:
        # Zero variance: all values are identical
        s = 1e-6

    # Compute pairwise haversine distance matrix (in km)
    coords_deg = np.array(coords)
    lons = np.radians(coords_deg[:, 0])
    lats = np.radians(coords_deg[:, 1])

    # Haversine formula broadcasted
    dlat = lats[:, np.newaxis] - lats[np.newaxis, :]
    dlon = lons[:, np.newaxis] - lons[np.newaxis, :]
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lats[:, np.newaxis]) * np.cos(lats[np.newaxis, :]) * np.sin(dlon / 2.0) ** 2
    c = 2.0 * np.arcsin(np.clip(np.sqrt(a), 0, 1))
    dist_km = 6371.0 * c

    # Spatial weights: Gaussian distance decay within bandwidth
    # w_ij = exp(-0.5 * (d_ij / bandwidth)^2) if d_ij <= 3 * bandwidth else 0
    w = np.exp(-0.5 * (dist_km / max(bandwidth_km, 1.0)) ** 2)

    # Gi* includes self-weight (w_ii > 0)
    w_sum = np.sum(w, axis=1)
    w_sq_sum = np.sum(w ** 2, axis=1)

    numerator = np.sum(w * x[np.newaxis, :], axis=1) - (x_bar * w_sum)
    denominator_factor = np.sqrt(np.maximum((n * w_sq_sum - (w_sum ** 2)) / (n - 1), 0.0))
    denominator = s * denominator_factor
    denominator = np.where(denominator == 0, 1e-6, denominator)

    z_scores = numerator / denominator

    output_features = []
    for idx, f in enumerate(features):
        z = float(z_scores[idx])
        # Two-tailed p-value
        p = 2.0 * (1.0 - _norm_cdf(abs(z)))

        # Classification based on 90%, 95%, 99% confidence
        if z >= Z_95:
            classification = "hot"
            confidence = 99 if z >= Z_99 else 95
        elif z <= -Z_95:
            classification = "cold"
            confidence = 99 if z <= -Z_99 else 95
        elif z >= Z_90:
            classification = "hot"
            confidence = 90
        elif z <= -Z_90:
            classification = "cold"
            confidence = 90
        else:
            classification = "neutral"
            confidence = 0

        props = dict(f.get("properties", {}))
        props["z_score"] = round(z, 3)
        props["p_value"] = round(p, 4)
        props["classification"] = classification
        props["confidence"] = confidence

        output_features.append({
            "type": "Feature",
            "geometry": f.get("geometry"),
            "properties": props
        })

    return {
        "type": "FeatureCollection",
        "features": output_features,
        "metadata": {
            "mean": round(float(x_bar), 2),
            "std": round(float(s), 2),
            "bandwidth_km": bandwidth_km,
            "hot_count": len([f for f in output_features if f["properties"]["classification"] == "hot"]),
            "cold_count": len([f for f in output_features if f["properties"]["classification"] == "cold"])
        }
    }
