"""FastAPI Main Application Entry Point.

Owner: Moksh [M]
Role: Core Infra & Integration Point
"""

import sys
from pathlib import Path

# Ensure backend directory is in sys.path for versatile startup
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
for p in [str(BACKEND_DIR), str(PROJECT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.config import APP_TITLE, APP_VERSION, ALLOWED_ORIGINS
    from backend.api.routes_layers import router as layers_router
    from backend.api.routes_score import router as score_router
    from backend.utils.keep_alive import start_keep_alive_task, stop_keep_alive_task
except ImportError:
    from config import APP_TITLE, APP_VERSION, ALLOWED_ORIGINS
    from api.routes_layers import router as layers_router
    from api.routes_score import router as score_router
    from utils.keep_alive import start_keep_alive_task, stop_keep_alive_task


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle tasks."""
    start_keep_alive_task()
    try:
        yield
    finally:
        await stop_keep_alive_task()


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description="AI-Powered GeoSpatial Site Readiness Analyzer for Gujarat, India",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Phase 1 Routers
app.include_router(layers_router, prefix="/api")
app.include_router(score_router, prefix="/api")

# Conditionally mount future sprint routers as teammates complete them
try:
    from backend.api.routes_hotspot import router as hotspot_router
    app.include_router(hotspot_router, prefix="/api", tags=["Spatial"])
except ImportError:
    try:
        from api.routes_hotspot import router as hotspot_router
        app.include_router(hotspot_router, prefix="/api", tags=["Spatial"])
    except ImportError:
        pass

try:
    from backend.api.routes_isochrone import router as isochrone_router
    app.include_router(isochrone_router, prefix="/api", tags=["Accessibility"])
except ImportError:
    try:
        from api.routes_isochrone import router as isochrone_router
        app.include_router(isochrone_router, prefix="/api", tags=["Accessibility"])
    except ImportError:
        pass

try:
    from backend.api.routes_report import router as report_router
    app.include_router(report_router, prefix="/api", tags=["Reports"])
except ImportError:
    try:
        from api.routes_report import router as report_router
        app.include_router(report_router, prefix="/api", tags=["Reports"])
    except ImportError:
        pass

try:
    from backend.api.routes_compare import router as compare_router
    app.include_router(compare_router, prefix="/api", tags=["Comparison"])
except ImportError:
    try:
        from api.routes_compare import router as compare_router
        app.include_router(compare_router, prefix="/api", tags=["Comparison"])
    except ImportError:
        pass

try:
    from backend.api.routes_search import router as search_router
    app.include_router(search_router, prefix="/api", tags=["Search"])
except ImportError:
    try:
        from api.routes_search import router as search_router
        app.include_router(search_router, prefix="/api", tags=["Search"])
    except ImportError:
        pass

try:
    from backend.api.routes_wind import router as wind_router
    app.include_router(wind_router, prefix="/api", tags=["Wind Resource"])
except ImportError:
    try:
        from api.routes_wind import router as wind_router
        app.include_router(wind_router, prefix="/api", tags=["Wind Resource"])
    except ImportError:
        pass



@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint for container orchestrators and status monitoring."""
    return {
        "status": "ok",
        "data": {
            "version": APP_VERSION,
            "status": "healthy",
            "service": "GeoSpatial Site Readiness Analyzer Backend"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
