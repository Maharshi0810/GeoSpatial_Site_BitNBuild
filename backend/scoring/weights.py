"""Default weight profiles and preset configurations for SiteReadinessScorer."""

DEFAULT_WEIGHTS = {
    "demographics": 0.25,
    "transportation": 0.20,
    "poi": 0.20,
    "landuse": 0.15,
    "environment": 0.20,
}

WEIGHT_PROFILES = {
    "balanced": DEFAULT_WEIGHTS,
    "retail": {
        "demographics": 0.35,
        "transportation": 0.20,
        "poi": 0.25,
        "landuse": 0.15,
        "environment": 0.05,
    },
    "warehouse": {
        "demographics": 0.10,
        "transportation": 0.40,
        "poi": 0.10,
        "landuse": 0.25,
        "environment": 0.15,
    },
    "ev_charging": {
        "demographics": 0.20,
        "transportation": 0.35,
        "poi": 0.20,
        "landuse": 0.15,
        "environment": 0.10,
    },
}
