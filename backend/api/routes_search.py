"""Geocoding and Location Search API for Gujarat Sites

Endpoints:
  GET /api/search - Query places, wards, benchmarks, coordinates, or live OSM geocoding
"""

import re
import urllib.parse
import urllib.request
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query

router = APIRouter(prefix="", tags=["Search"])

# Curated benchmark and prominent locations across Gujarat
GUJARAT_PLACES: List[Dict[str, Any]] = [
    {
        "id": "loc-sg-highway",
        "name": "SG Highway Commercial Corridor",
        "subTitle": "Bodakdev - Thaltej - Sola Arterial Axis, Ahmedabad",
        "lat": 23.0378,
        "lng": 72.5112,
        "category": "benchmark",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-gift-city",
        "name": "GIFT City International FinTech Zone",
        "subTitle": "India's Flagship IFSC Smart City, Gandhinagar",
        "lat": 23.1601,
        "lng": 72.6841,
        "category": "benchmark",
        "district": "Gandhinagar",
    },
    {
        "id": "loc-sanand-gidc",
        "name": "Sanand GIDC Mega Automotive Corridor",
        "subTitle": "Heavy Industrial & Auto OEM Cluster, Ahmedabad Rural",
        "lat": 22.9868,
        "lng": 72.3814,
        "category": "benchmark",
        "district": "Ahmedabad Rural",
    },
    {
        "id": "loc-mundra-port",
        "name": "Mundra Port & SEZ Logistics Hub",
        "subTitle": "Deep-Water Container Terminal & Freight Corridor, Kutch",
        "lat": 22.8394,
        "lng": 69.7214,
        "category": "benchmark",
        "district": "Kutch",
    },
    {
        "id": "loc-vadodara-alkapuri",
        "name": "Alkapuri Central Commercial Hub",
        "subTitle": "R.C. Dutt Road Premier Business District, Vadodara",
        "lat": 22.3106,
        "lng": 73.1812,
        "category": "benchmark",
        "district": "Vadodara",
    },
    {
        "id": "loc-sbr",
        "name": "Sindhu Bhavan Road (SBR)",
        "subTitle": "High-Street Retail & Corporate Corridor, Ahmedabad",
        "lat": 23.0450,
        "lng": 72.4980,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-bodakdev",
        "name": "Bodakdev Urban Ward",
        "subTitle": "SG Highway & Judges Bungalow Precinct, Ahmedabad",
        "lat": 23.0373,
        "lng": 72.5074,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-prahladnagar",
        "name": "Prahlad Nagar Corporate Road",
        "subTitle": "Makarba - Vejalpur Commercial Zone, Ahmedabad",
        "lat": 23.0125,
        "lng": 72.5085,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-satellite",
        "name": "Satellite & Shivranjani",
        "subTitle": "Dense Mixed Commercial & Residential Hub, Ahmedabad",
        "lat": 23.0305,
        "lng": 72.5178,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-vastrapur",
        "name": "Vastrapur Lake & IIM Ahmedabad",
        "subTitle": "Institutional & Premium Retail District, Ahmedabad",
        "lat": 23.0350,
        "lng": 72.5293,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-navrangpura",
        "name": "Navrangpura Commercial District",
        "subTitle": "CG Road, Municipal Market & Law Garden, Ahmedabad",
        "lat": 23.0365,
        "lng": 72.5611,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-ashram-road",
        "name": "Ashram Road Financial Corridor",
        "subTitle": "Historic CBD & Sabarmati Riverfront, Ahmedabad",
        "lat": 23.0298,
        "lng": 72.5714,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-science-city",
        "name": "Science City & Sola",
        "subTitle": "Rapid Growth Residential & Tech Hub, Ahmedabad",
        "lat": 23.0786,
        "lng": 72.5167,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-bopal",
        "name": "Bopal & South Bopal Urban Zone",
        "subTitle": "SP Ring Road Western Residential Expansion, Ahmedabad",
        "lat": 23.0342,
        "lng": 72.4641,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-chandkheda-motera",
        "name": "Motera & Chandkheda (Narendra Modi Stadium)",
        "subTitle": "Northern Ahmedabad - Gandhinagar Connector",
        "lat": 23.0911,
        "lng": 72.5975,
        "category": "ward",
        "district": "Ahmedabad",
    },
    {
        "id": "loc-changodar",
        "name": "Changodar Industrial & Logistics Park",
        "subTitle": "Sarkhej-Bavla National Highway Freight Corridor",
        "lat": 22.9234,
        "lng": 72.4285,
        "category": "industrial",
        "district": "Ahmedabad Rural",
    },
    {
        "id": "loc-surat-vesu",
        "name": "Vesu Commercial & Luxury Retail Hub",
        "subTitle": "South Surat High-Density Premium Corridor",
        "lat": 21.1442,
        "lng": 72.7712,
        "category": "city",
        "district": "Surat",
    },
    {
        "id": "loc-surat-diamond-bourse",
        "name": "Surat Diamond Bourse (DREAM City)",
        "subTitle": "Khajod Global Gems & Jewelry Trading Capital",
        "lat": 21.1219,
        "lng": 72.7661,
        "category": "city",
        "district": "Surat",
    },
    {
        "id": "loc-surat-hazira",
        "name": "Hazira Port & Industrial Belt",
        "subTitle": "Deep-Water LNG, Steel & Heavy Petrochemical Terminal, Surat",
        "lat": 21.1158,
        "lng": 72.6482,
        "category": "industrial",
        "district": "Surat",
    },
    {
        "id": "loc-rajkot-ringroad",
        "name": "150 Feet Ring Road Commercial Axis",
        "subTitle": "West Rajkot Retail, Hospitality & Healthcare Corridor",
        "lat": 22.2850,
        "lng": 70.7680,
        "category": "city",
        "district": "Rajkot",
    },
    {
        "id": "loc-dholera-sir",
        "name": "Dholera Special Investment Region (SIR)",
        "subTitle": "Greenfield Smart Industrial City & Semiconductor Node",
        "lat": 22.2472,
        "lng": 72.1908,
        "category": "industrial",
        "district": "Ahmedabad Rural",
    },
    {
        "id": "loc-dahej-pcpir",
        "name": "Dahej PCPIR & Port Terminal",
        "subTitle": "Petrochemicals, Petroleum & Chemical Investment Zone, Bharuch",
        "lat": 21.7125,
        "lng": 72.5855,
        "category": "industrial",
        "district": "Bharuch",
    },
    {
        "id": "loc-morbi-ceramic",
        "name": "Morbi Ceramic Industrial Cluster",
        "subTitle": "National Ceramic Tile & Sanitaryware Capital",
        "lat": 22.8120,
        "lng": 70.8380,
        "category": "industrial",
        "district": "Morbi",
    },
    {
        "id": "loc-jamnagar-refinery",
        "name": "Jamnagar Petrochemical & Refining Belt",
        "subTitle": "Motikhavdi World-Scale Refinery & Port Complex",
        "lat": 22.4707,
        "lng": 70.0577,
        "category": "industrial",
        "district": "Jamnagar",
    },
    {
        "id": "loc-anand-amul",
        "name": "Anand Agri & Dairy Corridor",
        "subTitle": "Amul Dairy Capital & Agro-Processing Zone, Anand",
        "lat": 22.5645,
        "lng": 72.9289,
        "category": "city",
        "district": "Anand",
    },
]

# Coordinate regex (lat, lng)
COORD_REGEX = re.compile(r"^[-+]?([1-8]?\d(?:\.\d+)?|90(?:\.0+)?)[,\s]+[-+]?(180(?:\.0+)?|(?:1[0-7]\d|[1-9]?\d)(?:\.\d+)?)$")


def parse_coordinates(query: str) -> Optional[Dict[str, Any]]:
    m = COORD_REGEX.match(query.strip())
    if m:
        try:
            parts = [p.strip() for p in re.split(r"[, ]+", query.strip()) if p.strip()]
            if len(parts) >= 2:
                lat = float(parts[0])
                lng = float(parts[1])
                if -90 <= lat <= 90 and -180 <= lng <= 180:
                    return {
                        "id": "coord-custom",
                        "name": f"Coordinates: {lat:.4f}° N, {lng:.4f}° E",
                        "subTitle": "Direct GPS Coordinates in Gujarat",
                        "lat": lat,
                        "lng": lng,
                        "category": "coordinate",
                        "district": "Gujarat",
                    }
        except Exception:
            return None
    return None


def fetch_nominatim_geocoding(query: str, limit: int = 4) -> List[Dict[str, Any]]:
    """Query OpenStreetMap Nominatim geocoder bounded to Gujarat/India."""
    try:
        # Bounded by Gujarat box: min_lon=68.1, max_lat=24.7, max_lon=74.5, min_lat=20.1
        params = urllib.parse.urlencode({
            "format": "json",
            "q": query,
            "countrycodes": "in",
            "viewbox": "68.1,24.7,74.5,20.1",
            "bounded": "0",
            "limit": limit,
            "addressdetails": "1"
        })
        url = f"https://nominatim.openstreetmap.org/search?{params}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "SiteReadinessAnalyzer/1.0 (contact@example.com)"}
        )
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = []
            for item in data:
                lat = float(item.get("lat", 0))
                lng = float(item.get("lon", 0))
                display_name = item.get("display_name", "")
                parts = display_name.split(",")
                primary_name = item.get("name") or (parts[0].strip() if parts else "Location")
                
                results.append({
                    "id": f"osm-{item.get('place_id', '')}",
                    "name": primary_name,
                    "subTitle": display_name,
                    "lat": lat,
                    "lng": lng,
                    "category": "geocoded",
                    "district": item.get("address", {}).get("state_district", "Gujarat"),
                })
            return results
    except Exception:
        return []


@router.get("/search")
async def search_locations(
    q: str = Query("", description="Search term, place name, ward, or coordinates"),
    limit: int = Query(8, description="Maximum number of suggestions to return")
) -> Dict[str, Any]:
    """Unified location search and geocoding endpoint."""
    query = q.strip()
    results: List[Dict[str, Any]] = []

    # 1. Coordinate check
    coord = parse_coordinates(query)
    if coord:
        results.append(coord)

    # 2. Local curated places matching
    q_lower = query.lower()
    if q_lower:
        matched_presets = [
            p for p in GUJARAT_PLACES
            if q_lower in p["name"].lower()
            or q_lower in p["subTitle"].lower()
            or q_lower in p["district"].lower()
            or q_lower in p["category"].lower()
        ]
        results.extend(matched_presets[:limit])
    else:
        results.extend(GUJARAT_PLACES[:limit])

    # 3. Live OSM Geocoding fallback if few local matches and length >= 3
    if len(results) < 4 and len(query) >= 3 and not coord:
        osm_results = fetch_nominatim_geocoding(query, limit=limit - len(results))
        for osm in osm_results:
            if not any(abs(r["lat"] - osm["lat"]) < 0.005 and abs(r["lng"] - osm["lng"]) < 0.005 for r in results):
                results.append(osm)

    return {
        "query": query,
        "count": len(results),
        "results": results[:limit]
    }
