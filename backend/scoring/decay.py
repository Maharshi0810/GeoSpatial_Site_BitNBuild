"""Spatial distance decay functions for site scoring calculations."""

import math
from typing import List, Tuple

def inverse_distance(d: float, max_d: float = 5000.0) -> float:
    """Score decays inversely with distance.
    d=0 -> 1.0, d >= max_d -> 0.0.
    """
    if d <= 0:
        return 1.0
    if d >= max_d:
        return 0.0
    return 1.0 - (d / max_d)

def gaussian(d: float, sigma: float = 2000.0) -> float:
    """Gaussian decay function for smooth spatial attenuation.
    d=0 -> 1.0.
    """
    if d <= 0:
        return 1.0
    return math.exp(-(d ** 2) / (2 * (sigma ** 2)))

def linear(d: float, max_d: float = 5000.0) -> float:
    """Linear distance decay."""
    if d <= 0:
        return 1.0
    if d >= max_d:
        return 0.0
    return 1.0 - (d / max_d)

def step(d: float, thresholds: List[Tuple[float, float]]) -> float:
    """Step decay based on distance threshold bins.
    thresholds format: [(max_dist, score), ...] in ascending order.
    """
    for max_d, score in thresholds:
        if d <= max_d:
            return score
    return 0.0
