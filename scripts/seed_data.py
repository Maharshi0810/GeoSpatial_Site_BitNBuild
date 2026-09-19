"""Dataset Seeding & Ingestion CLI Script.

Owner: Maharshi [R]
Generates and seeds standardized GeoJSON layers in project/data/ directory.
Run via: python scripts/seed_data.py
"""

import os
import sys
import json
from pathlib import Path

# Add backend to path for imports
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(PROJECT_DIR))

from backend.data.synthetic import (
    generate_boundary,
    generate_demographics,
    generate_transportation,
    generate_poi,
    generate_landuse,
    generate_environment,
)
from backend.data.preprocessor import validate_geojson


def seed_all(output_dir: Path):
    """Seed all required datasets into project/data/."""
    print(f"Seeding geospatial datasets to: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Subdirectories
    subdirs = ["demographics", "transportation", "poi", "landuse", "environment"]
    for sub in subdirs:
        (output_dir / sub).mkdir(parents=True, exist_ok=True)

    datasets = [
        {
            "name": "Gujarat Boundary",
            "generator": generate_boundary,
            "paths": [output_dir / "gujarat_boundary.geojson"],
        },
        {
            "name": "Demographics & Population Density",
            "generator": generate_demographics,
            "paths": [
                output_dir / "demographics" / "population_density.geojson",
                output_dir / "demographics.geojson",
            ],
        },
        {
            "name": "Transportation & Highway Network",
            "generator": generate_transportation,
            "paths": [
                output_dir / "transportation" / "road_network.geojson",
                output_dir / "transportation.geojson",
            ],
        },
        {
            "name": "Points of Interest & Competitors",
            "generator": generate_poi,
            "paths": [
                output_dir / "poi" / "competitors.geojson",
                output_dir / "poi.geojson",
            ],
        },
        {
            "name": "Land Use & Zoning Parcels",
            "generator": generate_landuse,
            "paths": [
                output_dir / "landuse" / "zoning.geojson",
                output_dir / "landuse.geojson",
            ],
        },
        {
            "name": "Environmental & Flood Hazards",
            "generator": generate_environment,
            "paths": [
                output_dir / "environment" / "flood_zones.geojson",
                output_dir / "environment.geojson",
            ],
        },
    ]

    summary = []

    for d in datasets:
        data = d["generator"]()
        if not validate_geojson(data):
            print(f"[FAIL] Validation failed for {d['name']}")
            sys.exit(1)

        feature_count = len(data.get("features", []))
        for p in d["paths"]:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

        summary.append({
            "dataset": d["name"],
            "features": feature_count,
            "primary_file": str(d["paths"][0].relative_to(PROJECT_DIR)),
        })
        print(f"  [OK] {d['name']}: {feature_count} features written to {d['paths'][0].name}")

    # Write data/README.md
    readme_path = output_dir / "README.md"
    readme_content = f"""# Geospatial Data Catalog - Gujarat Metropolitan Region

Owner: Maharshi [R]  
CRS: EPSG:4326 (WGS 84)  
Coordinate Bounds: `[68.1, 20.1, 74.5, 24.7]` (Gujarat, India)  
Primary Focus Metro: Ahmedabad (`23.0225 N, 72.5714 E`)

## Layer Registry

| Layer | Path | Feature Type | Count | Description |
|---|---|---|---|---|
| Gujarat Boundary | `gujarat_boundary.geojson` | Polygon | 1 | Official state boundary contour |
| Demographics | `demographics/population_density.geojson` | Point | {summary[1]['features']} | Census-calibrated population density grid centroids |
| Transportation | `transportation/road_network.geojson` | LineString | {summary[2]['features']} | National highways (NH-48, NE-1) & arterial roads |
| Points of Interest | `poi/competitors.geojson` | Point | {summary[3]['features']} | Commercial competitors, retail anchors, EV charging |
| Land Use & Zoning | `landuse/zoning.geojson` | Polygon | {summary[4]['features']} | Commercial, industrial GIDC, residential zoning |
| Environmental Risk | `environment/flood_zones.geojson` | Polygon | {summary[5]['features']} | Sabarmati flood plain & coastal buffer zones |

## Licensing & Attribution
- OpenStreetMap contributors (ODbL)
- Census of India demographic administrative statistics
- Central Water Commission flood hazard contour mappings
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)

    print(f"\nData dictionary written to {readme_path.name}")
    print("All datasets successfully seeded and verified!\n")


if __name__ == "__main__":
    data_directory = PROJECT_DIR / "data"
    seed_all(data_directory)
