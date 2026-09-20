"""Default weight profiles and preset configurations for SiteReadinessScorer.

Each profile maps 5 scoring dimensions to weights that sum to ~1.0.
The *semantic meaning* of each dimension changes per archetype — see engine.py
for archetype-specific scoring methods and label overrides.
"""

DEFAULT_WEIGHTS = {
    "demographics": 0.25,
    "transportation": 0.20,
    "poi": 0.20,
    "landuse": 0.15,
    "environment": 0.20,
}

WEIGHT_PROFILES = {
    "balanced": DEFAULT_WEIGHTS,

    # ── URBAN / COMMERCIAL ARCHETYPES ─────────────────────────────────

    "ev_charging": {
        "demographics": 0.15,      # EV ownership density (income-weighted)
        "transportation": 0.35,    # Highway/arterial proximity — dominant factor
        "poi": 0.25,               # Dwell-time anchors (malls, offices, petrol pumps)
        "landuse": 0.15,           # Commercial/mixed zoning preferred
        "environment": 0.10,       # Flood/water exclusion only
    },
    "retail": {
        "demographics": 0.35,      # Footfall catchment = revenue proxy — dominant
        "transportation": 0.15,    # Vehicular + pedestrian access
        "poi": 0.30,               # Co-tenancy & cluster effect
        "landuse": 0.15,           # Commercial zoning mandatory
        "environment": 0.05,       # Minimal environmental constraint
    },
    "warehouse": {
        "demographics": 0.10,      # INVERTED: low density = cheap land, large parcels
        "transportation": 0.40,    # Highway/port/rail corridor — dominant factor
        "poi": 0.05,               # Industrial cluster / SEZ proximity
        "landuse": 0.30,           # Industrial zoning mandatory; scalability
        "environment": 0.15,       # Flood risk critical for inventory protection
    },
    "telecom": {
        "demographics": 0.30,      # Subscriber density = coverage demand
        "transportation": 0.10,    # Maintenance crew road access
        "poi": 0.15,               # Existing tower gap / coverage hole analysis
        "landuse": 0.15,           # Zoning compliance (rooftop vs greenfield)
        "environment": 0.30,       # Elevation / terrain for signal propagation
    },

    # ── RENEWABLES ARCHETYPES (managed by separate engine paths) ──────

    "renewables": {
        "demographics": 0.20,      # Inverted: rewards uninhabited buffer / low density
        "transportation": 0.15,    # Heavy haul road / logistics corridor
        "poi": 0.35,               # Wind Resource & Generation Potential Index
        "landuse": 0.20,           # Open wasteland / non-arable low cost
        "environment": 0.10,       # Setback from protected forests/sanctuaries
    },
    "windmill": {
        "demographics": 0.20,
        "transportation": 0.15,
        "poi": 0.35,
        "landuse": 0.20,
        "environment": 0.10,
    },
    "solar": {
        "demographics": 0.10,      # INVERTED: uninhabited land preferred
        "transportation": 0.10,    # Grid substation proximity
        "poi": 0.40,               # Solar Irradiance (GHI) — dominant
        "landuse": 0.25,           # Flat wasteland, non-agricultural
        "environment": 0.15,       # Protected area setback + flood risk
    },
}
