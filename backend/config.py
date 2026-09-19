import os
from pathlib import Path

# Root directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Data directory (env var or fallback to project root data)
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))

# CORS origins
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,*")
ALLOWED_ORIGINS = [orig.strip() for orig in raw_origins.split(",") if orig.strip()]

# App metadata
APP_TITLE = "GeoSpatial Site Readiness Analyzer"
APP_VERSION = "1.0.0"

# Gujarat bounding box [min_lng, min_lat, max_lng, max_lat]
GUJARAT_BBOX = [68.1, 20.1, 74.5, 24.7]
