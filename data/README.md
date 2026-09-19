# Geospatial Data Catalog - Gujarat Metropolitan Region

Owner: Maharshi [R]  
CRS: EPSG:4326 (WGS 84)  
Coordinate Bounds: `[68.1, 20.1, 74.5, 24.7]` (Gujarat, India)  
Primary Focus Metro: Ahmedabad (`23.0225 N, 72.5714 E`)

## Layer Registry

| Layer | Path | Feature Type | Count | Description |
|---|---|---|---|---|
| Gujarat Boundary | `gujarat_boundary.geojson` | Polygon | 1 | Official state boundary contour |
| Demographics | `demographics/population_density.geojson` | Point | 500 | Census-calibrated population density grid centroids |
| Transportation | `transportation/road_network.geojson` | LineString | 6 | National highways (NH-48, NE-1) & arterial roads |
| Points of Interest | `poi/competitors.geojson` | Point | 250 | Commercial competitors, retail anchors, EV charging |
| Land Use & Zoning | `landuse/zoning.geojson` | Polygon | 7 | Commercial, industrial GIDC, residential zoning |
| Environmental Risk | `environment/flood_zones.geojson` | Polygon | 4 | Sabarmati flood plain & coastal buffer zones |

## Licensing & Attribution
- OpenStreetMap contributors (ODbL)
- Census of India demographic administrative statistics
- Central Water Commission flood hazard contour mappings
