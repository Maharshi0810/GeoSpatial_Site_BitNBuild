"""Gujarat Wind & Renewable Energy Resource Potential Model.

Calibrated against National Institute of Wind Energy (NIWE) 100m-120m Wind Atlas data,
MNRE Renewable Energy Guidelines, and Gujarat Wind Policy benchmarks.

Key Zones:
- Coastal Kutch (Mandvi, Jakhau, Abdasa, Lakhpat): 7.5 - 8.6 m/s, WPD > 400 W/m² (Tier 1)
- Saurashtra Coastal (Dwarka, Porbandar, Jamnagar, Bhavnagar): 7.0 - 8.2 m/s, WPD 350-450 W/m² (Tier 1)
- Central Saurashtra Plateaus (Rajkot, Surendranagar, Morbi, Amreli): 5.8 - 7.0 m/s (Tier 2)
- Mainland Eastern Plains (Ahmedabad, Gandhinagar, Vadodara, Surat): 3.8 - 4.8 m/s (Tier 3 - Sub-commercial)
"""

import math
from typing import Dict, Any, Tuple

try:
    from backend.utils.geo_helpers import haversine_distance
except ImportError:
    from utils.geo_helpers import haversine_distance


# High-wind anchor epicenters across Gujarat (Latitude, Longitude, Mean annual wind speed m/s at 120m)
GUJARAT_WIND_EPICENTERS = [
    # --- Coastal Kutch Belt (Highest Wind Potential in India) ---
    {"name": "Jakhau Coast, Kutch", "lat": 23.238, "lng": 68.705, "speed": 8.4, "radius_km": 65.0},
    {"name": "Mandvi Coastal Strip, Kutch", "lat": 22.833, "lng": 69.355, "speed": 8.1, "radius_km": 55.0},
    {"name": "Lakhpat / Abdasa Ridge, Kutch", "lat": 23.750, "lng": 68.800, "speed": 7.9, "radius_km": 70.0},
    {"name": "Khavda / Pachham Ridge, Kutch", "lat": 23.850, "lng": 69.750, "speed": 7.8, "radius_km": 60.0},

    # --- Saurashtra Coastal & Elevated Belt ---
    {"name": "Devbhumi Dwarka Coastal Belt", "lat": 22.240, "lng": 68.968, "speed": 8.3, "radius_km": 50.0},
    {"name": "Porbandar Coastal Corridor", "lat": 21.642, "lng": 69.609, "speed": 8.0, "radius_km": 45.0},
    {"name": "Jamnagar Coastal Plateau", "lat": 22.470, "lng": 70.070, "speed": 7.6, "radius_km": 50.0},
    {"name": "Bhavnagar Coastal Ridgeline", "lat": 21.764, "lng": 72.152, "speed": 7.4, "radius_km": 45.0},
    {"name": "Mahuva / Jafrabad Coastal Strip", "lat": 21.090, "lng": 71.770, "speed": 7.7, "radius_km": 50.0},

    # --- Central Saurashtra Elevated Plateaus ---
    {"name": "Rajkot Elevated Ridge", "lat": 22.300, "lng": 70.800, "speed": 6.8, "radius_km": 55.0},
    {"name": "Surendranagar Wind Corridor", "lat": 22.720, "lng": 71.640, "speed": 6.6, "radius_km": 50.0},
    {"name": "Morbi / Maliya Plateau", "lat": 22.820, "lng": 70.830, "speed": 6.9, "radius_km": 45.0},
    {"name": "Amreli Wind Corridor", "lat": 21.600, "lng": 71.220, "speed": 6.7, "radius_km": 45.0},

    # --- Low-Wind Mainland Baseline Anchors ---
    {"name": "Ahmedabad Urban Basin", "lat": 23.022, "lng": 72.571, "speed": 4.1, "radius_km": 60.0},
    {"name": "Vadodara Inland Basin", "lat": 22.307, "lng": 73.181, "speed": 3.9, "radius_km": 60.0},
    {"name": "Surat Coastal Valley", "lat": 21.170, "lng": 72.831, "speed": 4.6, "radius_km": 45.0},
]


def estimate_wind_speed(lat: float, lng: float) -> Tuple[float, str]:
    """Inverse-distance-weighted spatial estimation of mean annual wind speed (m/s at 120m hub height)."""
    weights_sum = 0.0
    weighted_speed_sum = 0.0
    closest_anchor = None
    min_dist_km = float("inf")

    for anchor in GUJARAT_WIND_EPICENTERS:
        d_km = haversine_distance(lat, lng, anchor["lat"], anchor["lng"], unit="km")
        if d_km < min_dist_km:
            min_dist_km = d_km
            closest_anchor = anchor["name"]

        # Gaussian distance decay around anchor influence radius
        sigma = anchor["radius_km"]
        w = math.exp(-0.5 * (d_km / sigma) ** 2)
        weighted_speed_sum += anchor["speed"] * w
        weights_sum += w

    if weights_sum > 0.001:
        speed = weighted_speed_sum / weights_sum
    else:
        # Geographic fallback based on longitude (Western Gujarat is windy; Eastern is sheltered)
        if lng <= 70.5:
            speed = 7.2  # Kutch/West Saurashtra
        elif lng <= 71.8:
            speed = 6.4  # Central Saurashtra
        else:
            speed = 4.2  # Mainland Gujarat

    return round(speed, 2), closest_anchor or "Gujarat Regional Wind Field"


# Empirical Gujarat Monthly Wind Multipliers (derived from NIWE & IMD long-term weather records)
MONTHLY_WIND_FACTORS = {
    "Jan": 0.78,
    "Feb": 0.82,
    "Mar": 0.86,
    "Apr": 0.97,
    "May": 1.18,
    "Jun": 1.47,
    "Jul": 1.53,
    "Aug": 1.31,
    "Sep": 0.79,
    "Oct": 0.57,
    "Nov": 0.63,
    "Dec": 0.73,
}


def get_wind_resource_score(lat: float, lng: float) -> Dict[str, Any]:
    """Compute 0-100 Wind Resource Suitability score and annual profile for Gujarat.

    Rating criteria (at 120m hub height):
      - >= 7.8 m/s : Score 92 - 100 (Prime Tier 1, High Capacity Utilization Factor > 38%)
      - 7.0 - 7.8 m/s: Score 80 - 92 (Strong Commercial, CUF 32-38%)
      - 6.0 - 7.0 m/s: Score 60 - 80 (Viable Medium Wind Class, CUF 26-32%)
      - 5.0 - 6.0 m/s: Score 35 - 60 (Marginal / Low Wind)
      - < 5.0 m/s  : Score 15 - 35 (Sub-commercial / Unsuitable for utility wind turbines)
    """
    annual_mean_ms, anchor_name = estimate_wind_speed(lat, lng)

    # Air density at ~30°C in Gujarat: ~1.165 kg/m³
    # Wind Power Density (W/m²) = 0.5 * rho * v³
    air_density = 1.165
    wpd = 0.5 * air_density * (annual_mean_ms ** 3)

    if annual_mean_ms >= 8.2:
        score = 95.0 + min((annual_mean_ms - 8.2) * 15.0, 5.0)
        tier = "Tier 1 — High-Yield Coastal Belt"
        cuf_pct = 38.0 + min((annual_mean_ms - 8.2) * 4.0, 6.0)
    elif annual_mean_ms >= 7.5:
        score = 85.0 + (annual_mean_ms - 7.5) / 0.7 * 10.0
        tier = "Tier 1 — Commercial Wind Corridor"
        cuf_pct = 33.0 + (annual_mean_ms - 7.5) / 0.7 * 5.0
    elif annual_mean_ms >= 6.8:
        score = 72.0 + (annual_mean_ms - 6.8) / 0.7 * 13.0
        tier = "Tier 2 — Elevated Saurashtra Plateau"
        cuf_pct = 28.0 + (annual_mean_ms - 6.8) / 0.7 * 5.0
    elif annual_mean_ms >= 5.8:
        score = 52.0 + (annual_mean_ms - 5.8) / 1.0 * 20.0
        tier = "Tier 2 — Moderate Inland Corridor"
        cuf_pct = 22.0 + (annual_mean_ms - 5.8) / 1.0 * 6.0
    elif annual_mean_ms >= 4.8:
        score = 30.0 + (annual_mean_ms - 4.8) / 1.0 * 22.0
        tier = "Tier 3 — Marginal Wind Resource"
        cuf_pct = 16.0 + (annual_mean_ms - 4.8) / 1.0 * 6.0
    else:
        score = max(15.0, 15.0 + (annual_mean_ms - 3.5) / 1.3 * 15.0)
        tier = "Sub-Commercial (Low Wind Plain)"
        cuf_pct = max(8.0, 10.0 + (annual_mean_ms - 3.5) / 1.3 * 6.0)

    score = round(min(max(score, 12.0), 99.0), 1)

    # 12-Month distribution throughout the year
    monthly_speeds = {
        m: round(annual_mean_ms * factor, 2)
        for m, factor in MONTHLY_WIND_FACTORS.items()
    }

    # Seasonal aggregates
    monsoon_peak_ms = round(sum(monthly_speeds[m] for m in ["May", "Jun", "Jul", "Aug"]) / 4.0, 2)
    winter_ms = round(sum(monthly_speeds[m] for m in ["Dec", "Jan", "Feb", "Mar"]) / 4.0, 2)
    lull_ms = round(sum(monthly_speeds[m] for m in ["Sep", "Oct", "Nov"]) / 3.0, 2)

    return {
        "score": score,
        "mean_wind_speed_ms": annual_mean_ms,
        "annual_average_ms": annual_mean_ms,
        "wind_power_density_wm2": round(wpd, 1),
        "hub_height_m": 120,
        "tier": tier,
        "estimated_cuf_pct": round(cuf_pct, 1),
        "anchor_proximity": anchor_name,
        "seasonal_summary": {
            "monsoon_high_wind_may_aug_ms": monsoon_peak_ms,
            "winter_moderate_dec_mar_ms": winter_ms,
            "post_monsoon_lull_sep_nov_ms": lull_ms
        },
        "monthly_speeds_ms": monthly_speeds,
        "label": f"Wind Resource (120m): {annual_mean_ms} m/s ({tier})"
    }
