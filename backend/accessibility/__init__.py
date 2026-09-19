"""Accessibility and Catchment Analysis Package.

Owner: Maharshi [R]
Role: Travel time isochrones (drive/walk/cycle) and demographic catchment analytics.
"""

try:
    from backend.accessibility.isochrone import compute_isochrone
    from backend.accessibility.catchment import compute_catchment_stats
except ImportError:
    from accessibility.isochrone import compute_isochrone
    from accessibility.catchment import compute_catchment_stats

__all__ = ["compute_isochrone", "compute_catchment_stats"]
