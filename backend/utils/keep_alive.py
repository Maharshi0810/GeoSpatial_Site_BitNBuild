"""Render / Cloud Deployment Keep-Alive Utility.

Automatically sends periodic HTTP GET requests to the backend's external public URL
to prevent cloud hosting providers with free-tier inactivity sleep policies
(such as Render's 15-minute spin-down) from putting the service to sleep.
"""

import asyncio
import logging
import os
from typing import Optional
import httpx

logger = logging.getLogger("keep_alive")

# Read configuration from environment
# Render sets RENDER_EXTERNAL_URL automatically (e.g. "https://geospatial-site-bitnbuild.onrender.com")
# RENDER env var is also set to "true" by Render automatically.
IS_RENDER = os.getenv("RENDER", "").lower() in ("true", "1")
DEFAULT_URL = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("BACKEND_URL") or "https://geospatial-site-bitnbuild.onrender.com"
KEEP_ALIVE_ENABLED = os.getenv("KEEP_ALIVE", "true" if IS_RENDER else "false").lower() in ("true", "1", "yes")
KEEP_ALIVE_INTERVAL = int(os.getenv("KEEP_ALIVE_INTERVAL_SECONDS", "600"))  # 10 minutes default (Render sleeps at 15m)

_keep_alive_task: Optional[asyncio.Task] = None


async def ping_endpoint(url: str, timeout_seconds: float = 60.0) -> bool:
    """Send an HTTP GET request to the target URL."""
    target = url.rstrip("/")
    if not target.endswith("/api/health") and not target.endswith("/health"):
        target = f"{target}/api/health"

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
            response = await client.get(target, headers={"User-Agent": "GeoVista-KeepAlive/1.0"})
            if response.status_code < 400:
                logger.info(f"[KeepAlive] Ping successful to {target} (Status: {response.status_code})")
                return True
            else:
                logger.warning(f"[KeepAlive] Received non-success status {response.status_code} from {target}")
                return False
    except httpx.RequestError as exc:
        logger.warning(f"[KeepAlive] Request failed for {target}: {exc}")
        return False
    except Exception as exc:
        logger.error(f"[KeepAlive] Unexpected error pinging {target}: {exc}")
        return False


async def keep_alive_loop(url: str, interval_seconds: int = 600):
    """Background loop that periodically pings the specified URL."""
    logger.info(f"[KeepAlive] Background worker started. Pinging {url} every {interval_seconds}s.")
    # Initial delay to give the server a moment to complete full initialization
    await asyncio.sleep(15)

    while True:
        try:
            await ping_endpoint(url)
        except asyncio.CancelledError:
            logger.info("[KeepAlive] Background worker cancelled. Exiting loop.")
            raise
        except Exception as e:
            logger.error(f"[KeepAlive] Error in keep-alive loop: {e}")

        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            logger.info("[KeepAlive] Sleep interrupted by cancellation.")
            raise


def start_keep_alive_task() -> Optional[asyncio.Task]:
    """Start the keep-alive background task if enabled."""
    global _keep_alive_task

    if not KEEP_ALIVE_ENABLED and not IS_RENDER:
        logger.info("[KeepAlive] Keep-alive worker is disabled (set KEEP_ALIVE=true or deploy on Render to enable).")
        return None

    if _keep_alive_task and not _keep_alive_task.done():
        logger.info("[KeepAlive] Task is already running.")
        return _keep_alive_task

    target_url = DEFAULT_URL
    logger.info(f"[KeepAlive] Spawning keep-alive worker for {target_url} (interval: {KEEP_ALIVE_INTERVAL}s)")
    _keep_alive_task = asyncio.create_task(keep_alive_loop(target_url, KEEP_ALIVE_INTERVAL))
    return _keep_alive_task


async def stop_keep_alive_task():
    """Stop the running keep-alive task gracefully."""
    global _keep_alive_task
    if _keep_alive_task and not _keep_alive_task.done():
        _keep_alive_task.cancel()
        try:
            await _keep_alive_task
        except asyncio.CancelledError:
            pass
        _keep_alive_task = None
        logger.info("[KeepAlive] Keep-alive background task stopped.")
