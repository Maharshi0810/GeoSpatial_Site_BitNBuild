"""Geocoding and Location Search API — Google Maps-Style Gujarat Spatial Search

Features:
  - Real-time autocomplete across all of Gujarat (cities, wards, streets, landmarks, GIDCs, villages)
  - Strict Gujarat Bounding Box restriction (20.0°N - 24.8°N, 68.0°E - 74.6°E)
  - Primary Engine: Photon OpenStreetMap Autocomplete with Gujarat spatial bounding
  - Secondary Engine: Nominatim Structured Geocoder with bounded viewbox
  - Pre-indexed Gujarat Gazetteer for instant 0ms offline suggestions
  - In-memory LRU caching to eliminate rate-limiting and redundant network latency
"""

import re
import urllib.parse
import urllib.request
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query

router = APIRouter(prefix="", tags=["Search"])

# In-memory geocode cache
_SEARCH_CACHE: Dict[str, List[Dict[str, Any]]] = {}

# Gujarat State Geographic Bounding Box
GUJARAT_BBOX = {
    "min_lng": 68.1,
    "min_lat": 20.1,
    "max_lng": 74.5,
    "max_lat": 24.7,
}

def is_within_gujarat(lat: float, lng: float) -> bool:
    """Validate that coordinates reside strictly within Gujarat borders (with slight buffer)."""
    return (
        GUJARAT_BBOX["min_lat"] - 0.1 <= lat <= GUJARAT_BBOX["max_lat"] + 0.1 and
        GUJARAT_BBOX["min_lng"] - 0.1 <= lng <= GUJARAT_BBOX["max_lng"] + 0.1
    )

# Curated High-Priority Gujarat Benchmarks, District HQs, and Strategic Hubs
GUJARAT_GAZETTEER: List[Dict[str, Any]] = [
    # --- AHMEDABAD & GANDHINAGAR ---
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
        "id": "loc-gandhinagar-central",
        "name": "Gandhinagar Central (Sector 10-21)",
        "subTitle": "Capital Administrative & Secretariat Sector, Gandhinagar",
        "lat": 23.2156,
        "lng": 72.6369,
        "category": "city",
        "district": "Gandhinagar",
    },
    {
        "id": "loc-infocity",
        "name": "Infocity IT & Software Park",
        "subTitle": "Major IT/ITES Corridor & Innovation Hub, Gandhinagar",
        "lat": 23.1904,
        "lng": 72.6288,
        "category": "industrial",
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
        "id": "loc-changodar",
        "name": "Changodar Industrial & Logistics Park",
        "subTitle": "Sarkhej-Bavla National Highway Freight Corridor",
        "lat": 22.9234,
        "lng": 72.4285,
        "category": "industrial",
        "district": "Ahmedabad Rural",
    },

    # --- VADODARA ---
    {
        "id": "loc-vadodara-central",
        "name": "Vadodara Central Business District",
        "subTitle": "Sayajigunj, Station Area & Alkapuri, Vadodara",
        "lat": 22.3072,
        "lng": 73.1812,
        "category": "city",
        "district": "Vadodara",
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
        "id": "loc-vadodara-makarpura",
        "name": "Makarpura GIDC Industrial Estate",
        "subTitle": "Major Electrical & Heavy Engineering Hub, Vadodara",
        "lat": 22.2536,
        "lng": 73.1950,
        "category": "industrial",
        "district": "Vadodara",
    },
    {
        "id": "loc-vadodara-akota",
        "name": "Akota & Gotri Commercial Corridor",
        "subTitle": "West Vadodara High-Density Retail & Residential Axis",
        "lat": 22.3015,
        "lng": 73.1614,
        "category": "city",
        "district": "Vadodara",
    },

    # --- SURAT ---
    {
        "id": "loc-surat-central",
        "name": "Surat Central & Ring Road Textile Market",
        "subTitle": "Asia's Premier Textile & Fabric Trading Capital, Surat",
        "lat": 21.1959,
        "lng": 72.8302,
        "category": "city",
        "district": "Surat",
    },
    {
        "id": "loc-surat-vesu",
        "name": "Vesu Commercial & Luxury Retail Hub",
        "subTitle": "South Surat High-Density Premium Corridor, Surat",
        "lat": 21.1442,
        "lng": 72.7712,
        "category": "city",
        "district": "Surat",
    },
    {
        "id": "loc-surat-diamond-bourse",
        "name": "Surat Diamond Bourse (DREAM City)",
        "subTitle": "Khajod Global Gems & Jewelry Trading Capital, Surat",
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

    # --- RAJKOT ---
    {
        "id": "loc-rajkot-ringroad",
        "name": "150 Feet Ring Road Commercial Axis",
        "subTitle": "West Rajkot Retail, Hospitality & Healthcare Corridor, Rajkot",
        "lat": 22.2850,
        "lng": 70.7680,
        "category": "city",
        "district": "Rajkot",
    },
    {
        "id": "loc-rajkot-central",
        "name": "Rajkot Central & Yagnik Road",
        "subTitle": "Saurashtra Commercial & Financial Epicenter, Rajkot",
        "lat": 22.3039,
        "lng": 70.8022,
        "category": "city",
        "district": "Rajkot",
    },
    {
        "id": "loc-rajkot-aji",
        "name": "Aji GIDC & Shapar-Veraval Industrial Zone",
        "subTitle": "Engineering, Casting & Diesel Engine Capital, Rajkot",
        "lat": 22.2514,
        "lng": 70.8142,
        "category": "industrial",
        "district": "Rajkot",
    },

    # --- BHAVNAGAR ---
    {
        "id": "loc-bhavnagar-city",
        "name": "Bhavnagar Central & Waghawadi Road",
        "subTitle": "Commercial High-Street & Civic Center, Bhavnagar",
        "lat": 21.7645,
        "lng": 72.1519,
        "category": "city",
        "district": "Bhavnagar",
    },
    {
        "id": "loc-alang-shipyard",
        "name": "Alang Ship Recycling & Marine Yard",
        "subTitle": "World's Largest Ship Breaking & Steel Recovery Cluster, Bhavnagar",
        "lat": 21.4167,
        "lng": 72.1833,
        "category": "industrial",
        "district": "Bhavnagar",
    },

    # --- KUTCH ---
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
        "id": "loc-gandhidham-kandla",
        "name": "Gandhidham & Deendayal Port (Kandla)",
        "subTitle": "Major Dry Cargo Port, Timber & Logistics Node, Kutch",
        "lat": 23.0753,
        "lng": 70.1337,
        "category": "industrial",
        "district": "Kutch",
    },
    {
        "id": "loc-bhuj-city",
        "name": "Bhuj Central Heritage & Commercial Hub",
        "subTitle": "Kutch District Headquarters & Transport Node, Bhuj",
        "lat": 23.2420,
        "lng": 69.6669,
        "category": "city",
        "district": "Kutch",
    },

    # --- BHARUCH, ANAND, VAPI, MORBI, DHOLERA ---
    {
        "id": "loc-dahej-pcpir",
        "name": "Dahej PCPIR & Deep-Water Port Terminal",
        "subTitle": "Petrochemicals, Petroleum & Chemical Investment Zone, Bharuch",
        "lat": 21.7125,
        "lng": 72.5855,
        "category": "industrial",
        "district": "Bharuch",
    },
    {
        "id": "loc-ankleshwar-gidc",
        "name": "Ankleshwar GIDC Mega Chemical Estate",
        "subTitle": "Asia's Foremost Chemical & Pharmaceuticals Cluster, Bharuch",
        "lat": 21.6264,
        "lng": 73.0031,
        "category": "industrial",
        "district": "Bharuch",
    },
    {
        "id": "loc-anand-amul",
        "name": "Anand Agri & Amul Dairy Corridor",
        "subTitle": "India's Dairy Capital & Agro-Processing Zone, Anand",
        "lat": 22.5645,
        "lng": 72.9289,
        "category": "city",
        "district": "Anand",
    },
    {
        "id": "loc-vapi-gidc",
        "name": "Vapi Mega GIDC Industrial Estate",
        "subTitle": "Chemicals, Paper, Dyes & Packaging Hub, Valsad",
        "lat": 20.3893,
        "lng": 72.9106,
        "category": "industrial",
        "district": "Valsad",
    },
    {
        "id": "loc-morbi-ceramic",
        "name": "Morbi Ceramic Industrial Cluster",
        "subTitle": "National Ceramic Tile & Sanitaryware Capital, Morbi",
        "lat": 22.8120,
        "lng": 70.8380,
        "category": "industrial",
        "district": "Morbi",
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
]

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
                    in_guj = is_within_gujarat(lat, lng)
                    return {
                        "id": "coord-custom",
                        "name": f"Coordinates: {lat:.4f}° N, {lng:.4f}° E",
                        "subTitle": "Direct GPS Coordinates" + (" (Gujarat)" if in_guj else ""),
                        "lat": lat,
                        "lng": lng,
                        "category": "coordinate",
                        "district": "Custom Point",
                    }
        except Exception:
            return None
    return None


def fetch_photon_gujarat(query: str, limit: int = 8) -> List[Dict[str, Any]]:
    """Query Photon autocomplete engine strictly bounded to Gujarat (bbox: 68.1, 20.1 to 74.5, 24.7)."""
    params = urllib.parse.urlencode({
        "q": query,
        "bbox": f"{GUJARAT_BBOX['min_lng']},{GUJARAT_BBOX['min_lat']},{GUJARAT_BBOX['max_lng']},{GUJARAT_BBOX['max_lat']}",
        "limit": limit * 2,
    })
    url = f"https://photon.komoot.io/api/?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "GeoVistaSiteReadiness/2.0 (team@geovista.app)"})

    results = []
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for feat in data.get("features", []):
                coords = feat.get("geometry", {}).get("coordinates", [])
                if len(coords) < 2:
                    continue
                lng, lat = float(coords[0]), float(coords[1])
                if not is_within_gujarat(lat, lng):
                    continue

                p = feat.get("properties", {})
                name = p.get("name")
                if not name:
                    continue

                street = p.get("street") or ""
                district = p.get("district") or p.get("city") or p.get("county") or ""
                state = p.get("state") or "Gujarat"
                if state.lower() in ["maharashtra", "rajasthan", "madhya pradesh", "karnataka", "delhi"]:
                    continue
                postcode = p.get("postcode") or ""

                sub_items = [item for item in [street, district, state, postcode] if item and item.lower() != name.lower()]
                subTitle = ", ".join(sub_items) if sub_items else "Gujarat, India"

                osm_key = p.get("osm_key", "")
                osm_value = p.get("osm_value", "")
                category = "geocoded"
                if osm_key in ["place"] and osm_value in ["city", "town"]:
                    category = "city"
                elif osm_key in ["industrial", "landuse"] or "gidc" in name.lower():
                    category = "industrial"
                elif osm_key in ["amenity", "tourism", "historic", "leisure"]:
                    category = "benchmark"
                elif osm_key in ["highway"]:
                    category = "ward"

                results.append({
                    "id": f"ph-{p.get('osm_id', '')}-{lat:.4f}-{lng:.4f}",
                    "name": name,
                    "subTitle": subTitle,
                    "lat": lat,
                    "lng": lng,
                    "category": category,
                    "district": district or "Gujarat",
                })
    except Exception:
        pass
    return results


def fetch_nominatim_gujarat(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Secondary fallback: Nominatim geocoder with bounded viewbox to Gujarat."""
    params = urllib.parse.urlencode({
        "format": "json",
        "q": query,
        "viewbox": f"{GUJARAT_BBOX['min_lng']},{GUJARAT_BBOX['max_lat']},{GUJARAT_BBOX['max_lng']},{GUJARAT_BBOX['min_lat']}",
        "bounded": "1",
        "limit": limit,
        "addressdetails": "1",
    })
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "GeoVistaSiteReadiness/2.0 (team@geovista.app; dakshthakkar42@gmail.com)",
            "Accept-Language": "en",
        }
    )
    results = []
    try:
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for item in data:
                lat = float(item.get("lat", 0))
                lng = float(item.get("lon", 0))
                if not is_within_gujarat(lat, lng):
                    continue

                display_name = item.get("display_name", "")
                parts = [p.strip() for p in display_name.split(",") if p.strip()]
                primary_name = item.get("name") or (parts[0] if parts else "Location")

                addr = item.get("address", {})
                city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county") or ""
                state = addr.get("state", "Gujarat")
                sub_parts = [p for p in [city, state] if p and p.lower() != primary_name.lower()]
                subTitle = ", ".join(sub_parts) if sub_parts else display_name

                results.append({
                    "id": f"nom-{item.get('place_id', '')}",
                    "name": primary_name,
                    "subTitle": subTitle,
                    "lat": lat,
                    "lng": lng,
                    "category": "geocoded",
                    "district": city or state or "Gujarat",
                })
    except Exception:
        pass
    return results


@router.get("/search")
async def search_locations(
    q: str = Query("", description="Search term, place, street, GIDC, ward, or coordinates in Gujarat"),
    limit: int = Query(8, description="Maximum number of results to return")
) -> Dict[str, Any]:
    """Google Maps-style autocomplete and geocoding strictly scoped to Gujarat."""
    query = q.strip()
    if not query:
        return {"query": "", "count": len(GUJARAT_GAZETTEER[:limit]), "results": GUJARAT_GAZETTEER[:limit]}

    # Check cache
    q_key = query.lower()
    if q_key in _SEARCH_CACHE:
        return {"query": query, "count": len(_SEARCH_CACHE[q_key]), "results": _SEARCH_CACHE[q_key][:limit]}

    results: List[Dict[str, Any]] = []

    # 1. Coordinate input (lat, lng)
    coord = parse_coordinates(query)
    if coord:
        results.append(coord)

    # 2. Match local Gujarat gazetteer presets
    matched_gazetteer = [
        p for p in GUJARAT_GAZETTEER
        if q_key in p["name"].lower()
        or q_key in p["subTitle"].lower()
        or q_key in p["district"].lower()
    ]
    results.extend(matched_gazetteer)

    # 3. Query Photon with strict Gujarat bounding box (searches every street, ward, village, landmark)
    if len(query) >= 2 and not coord:
        photon_matches = fetch_photon_gujarat(query, limit=limit)
        for pm in photon_matches:
            # Deduplicate by ~400m proximity
            if not any(abs(r["lat"] - pm["lat"]) < 0.004 and abs(r["lng"] - pm["lng"]) < 0.004 for r in results):
                results.append(pm)

    # 4. If still under limit, query Nominatim with bounded viewbox
    if len(results) < 4 and len(query) >= 3 and not coord:
        nominatim_matches = fetch_nominatim_gujarat(query, limit=limit - len(results))
        for nm in nominatim_matches:
            if not any(abs(r["lat"] - nm["lat"]) < 0.004 and abs(r["lng"] - nm["lng"]) < 0.004 for r in results):
                results.append(nm)

    final_results = results[:limit]
    if final_results:
        _SEARCH_CACHE[q_key] = final_results

    return {
        "query": query,
        "count": len(final_results),
        "results": final_results
    }
