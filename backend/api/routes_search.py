"""Geocoding and Location Search API for Gujarat Sites & Worldwide Geocoding

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

# In-memory geocode cache to prevent rate-limiting and accelerate repeated queries
_GEOCODE_CACHE: Dict[str, List[Dict[str, Any]]] = {}

# Curated benchmark, district headquarters, GIDC industrial estates, and prominent locations across Gujarat
GUJARAT_PLACES: List[Dict[str, Any]] = [
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
        "name": "Gandhinagar Central Secretariat (Sector 10-21)",
        "subTitle": "Capital Administrative & Commercial Sector, Gandhinagar",
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
    {
        "id": "loc-surat-adajan",
        "name": "Adajan & Pal Commercial Precinct",
        "subTitle": "West Surat Tapi Riverfront Expansion, Surat",
        "lat": 21.1925,
        "lng": 72.7892,
        "category": "city",
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
    {
        "id": "loc-bhavnagar-chitra",
        "name": "Chitra GIDC Industrial Estate",
        "subTitle": "Plastics, Chemicals & Small-Scale Manufacturing, Bhavnagar",
        "lat": 21.7856,
        "lng": 72.1124,
        "category": "industrial",
        "district": "Bhavnagar",
    },

    # --- JAMNAGAR ---
    {
        "id": "loc-jamnagar-refinery",
        "name": "Jamnagar Petrochemical & Refining Belt",
        "subTitle": "Motikhavdi World-Scale Refinery Complex, Jamnagar",
        "lat": 22.4707,
        "lng": 70.0577,
        "category": "industrial",
        "district": "Jamnagar",
    },
    {
        "id": "loc-jamnagar-city",
        "name": "Jamnagar City & Brass Parts Industrial Zone",
        "subTitle": "National Brass Parts & Precision Hardware Capital, Jamnagar",
        "lat": 22.4707,
        "lng": 70.0724,
        "category": "city",
        "district": "Jamnagar",
    },

    # --- JUNAGADH ---
    {
        "id": "loc-junagadh-city",
        "name": "Junagadh Central Heritage & Civic Hub",
        "subTitle": "Girnar Foothills Commercial & Tourism Center, Junagadh",
        "lat": 21.5222,
        "lng": 70.4579,
        "category": "city",
        "district": "Junagadh",
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

    # --- BHARUCH & ANKLESHWAR ---
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
        "id": "loc-bharuch-city",
        "name": "Bharuch City & Narmada Corridor",
        "subTitle": "Historical Port & Industrial Highway Junction, Bharuch",
        "lat": 21.7051,
        "lng": 72.9959,
        "category": "city",
        "district": "Bharuch",
    },

    # --- ANAND & KHEDA ---
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
        "id": "loc-vallabh-vidyanagar",
        "name": "Vallabh Vidyanagar Educational & Tech Town",
        "subTitle": "Premier University Campus & Knowledge Town, Anand",
        "lat": 22.5534,
        "lng": 72.9234,
        "category": "city",
        "district": "Anand",
    },
    {
        "id": "loc-nadiad-city",
        "name": "Nadiad Commercial & Healthcare Hub",
        "subTitle": "Central Gujarat Express Highway Node, Kheda",
        "lat": 22.6916,
        "lng": 72.8634,
        "category": "city",
        "district": "Kheda",
    },

    # --- SOUTH GUJARAT (VAPI, VALSAD, NAVSARI) ---
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
        "id": "loc-valsad-city",
        "name": "Valsad City & Coastal Railway Corridor",
        "subTitle": "Horticulture, Agro Logistics & Coastal Center, Valsad",
        "lat": 20.6105,
        "lng": 72.9257,
        "category": "city",
        "district": "Valsad",
    },
    {
        "id": "loc-navsari-city",
        "name": "Navsari Twin City Commercial Hub",
        "subTitle": "Diamond Polishing & Agro-Industrial Center, Navsari",
        "lat": 20.9500,
        "lng": 72.9300,
        "category": "city",
        "district": "Navsari",
    },

    # --- NORTH GUJARAT (MORBI, MEHSANA, PATAN, BANASKANTHA, SABARKANTHA) ---
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
        "id": "loc-mehsana-dudhsagar",
        "name": "Mehsana Dairy & Engineering Hub",
        "subTitle": "Dudhsagar Dairy & Oil Exploration Center, Mehsana",
        "lat": 23.5880,
        "lng": 72.3693,
        "category": "industrial",
        "district": "Mehsana",
    },
    {
        "id": "loc-kadi-gidc",
        "name": "Kadi & Chhatral Industrial Zone",
        "subTitle": "Ceramics, Cotton Ginning & Heavy Machinery, Mehsana",
        "lat": 23.3039,
        "lng": 72.3333,
        "category": "industrial",
        "district": "Mehsana",
    },
    {
        "id": "loc-palanpur-city",
        "name": "Palanpur Commercial & Transport Junction",
        "subTitle": "Diamond Trading & Dairy Center, Banaskantha",
        "lat": 24.1724,
        "lng": 72.4346,
        "category": "city",
        "district": "Banaskantha",
    },
    {
        "id": "loc-himatnagar-city",
        "name": "Himatnagar Ceramic & Trade Hub",
        "subTitle": "Sabarkantha District Administrative & Industrial Center",
        "lat": 23.5977,
        "lng": 72.9698,
        "category": "city",
        "district": "Sabarkantha",
    },

    # --- SAURASHTRA (DHOLERA, PORBANDAR, VERAVAL, SURENDRANAGAR) ---
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
        "id": "loc-porbandar-port",
        "name": "Porbandar Coastal Marine & Port Hub",
        "subTitle": "Commercial Deep-Water Port & Fishery Processing, Porbandar",
        "lat": 21.6417,
        "lng": 69.6293,
        "category": "city",
        "district": "Porbandar",
    },
    {
        "id": "loc-veraval-somnath",
        "name": "Veraval-Somnath Fisheries & Port Belt",
        "subTitle": "Marine Exports, Port Logistics & Cultural Gateway, Gir Somnath",
        "lat": 20.9000,
        "lng": 70.3667,
        "category": "city",
        "district": "Gir Somnath",
    },
    {
        "id": "loc-surendranagar-wadhwan",
        "name": "Surendranagar & Wadhwan Industrial Area",
        "subTitle": "Engineering, Ginning & Ceramic Hub, Surendranagar",
        "lat": 22.7275,
        "lng": 71.6370,
        "category": "city",
        "district": "Surendranagar",
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
                        "subTitle": "Direct GPS Coordinates",
                        "lat": lat,
                        "lng": lng,
                        "category": "coordinate",
                        "district": "Custom Point",
                    }
        except Exception:
            return None
    return None


def fetch_nominatim_geocoding(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """Query OpenStreetMap Nominatim geocoder with caching and robust User-Agent."""
    q_clean = query.strip().lower()
    if q_clean in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[q_clean][:limit]

    try:
        # Bias viewbox towards Gujarat, but keep bounded=0 so anywhere in India or the world resolves
        params = urllib.parse.urlencode({
            "format": "json",
            "q": query,
            "viewbox": "68.0,24.8,74.6,20.0",
            "bounded": "0",
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
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = []
            for item in data:
                lat = float(item.get("lat", 0))
                lng = float(item.get("lon", 0))
                display_name = item.get("display_name", "")
                parts = [p.strip() for p in display_name.split(",") if p.strip()]
                primary_name = item.get("name") or (parts[0] if parts else "Location")
                
                addr = item.get("address", {})
                city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county") or addr.get("state") or ""
                state = addr.get("state", "")
                country = addr.get("country", "")
                sub_parts = [p for p in [city, state, country] if p and p.lower() != primary_name.lower()]
                subTitle = ", ".join(sub_parts) if sub_parts else display_name

                results.append({
                    "id": f"osm-{item.get('place_id', '')}",
                    "name": primary_name,
                    "subTitle": subTitle,
                    "lat": lat,
                    "lng": lng,
                    "category": "geocoded",
                    "district": city or state or "Global",
                })
            
            if results:
                _GEOCODE_CACHE[q_clean] = results
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

    # 2. Local curated places matching (broad substring match on name, subtitle, and district)
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

    # 3. Live OSM Geocoding if fewer than 5 local matches and query length >= 3
    if len(results) < 5 and len(query) >= 3 and not coord:
        needed = limit - len(results)
        osm_results = fetch_nominatim_geocoding(query, limit=max(needed, 4))
        for osm in osm_results:
            # Deduplicate against existing results by coordinate proximity (~500m)
            if not any(abs(r["lat"] - osm["lat"]) < 0.005 and abs(r["lng"] - osm["lng"]) < 0.005 for r in results):
                results.append(osm)

    return {
        "query": query,
        "count": len(results),
        "results": results[:limit]
    }
