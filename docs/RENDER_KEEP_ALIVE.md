# Render Backend Keep-Alive Automation Guide

## 1. Problem Overview
On Render's Free Tier, web services automatically **spin down (sleep) after 15 minutes of inactivity** (receiving no incoming HTTP traffic).
When a user visits the site after it has slept, Render performs a cold-start which takes **30–50+ seconds**, degrading user experience.

---

## 2. Automated Solutions Implemented

This repository implements a **multi-layered keep-alive system** that ensures the backend stays warm and responsive 24/7.

```mermaid
flowchart TD
    A[GitHub Actions Cron <br/> Every 12 Minutes] -->|GET /api/health| D[Render Backend Service]
    B[FastAPI Background Worker <br/> Every 10 Minutes] -->|GET RENDER_EXTERNAL_URL/api/health| D
    C[Frontend Mount Warmup <br/> Immediate GET /api/health| D
    E[External Ping Script <br/> scripts/keep_alive.py] -->|GET /api/health| D
```

### Layer 1: GitHub Actions Scheduled Cron (`.github/workflows/render-keepalive.yml`)
- **Interval**: Runs automatically every **12 minutes** (`*/12 * * * *`).
- **External Trigger**: Completely independent of Render. If the service is asleep, this cloud cron wakes it up.
- **Manual Trigger**: Can be manually triggered from the **Actions** tab in GitHub (`workflow_dispatch`).
- **Resilience**: Configured with a 90-second timeout and retry logic to accommodate cold-starts gracefully.
- **Customizable**: Reads repository secret `BACKEND_URL` or defaults to `https://geospatial-site-bitnbuild.onrender.com`.

### Layer 2: In-App FastAPI Self-Keepalive Worker (`backend/utils/keep_alive.py`)
- **Auto-Detection**: Automatically detects when running on Render via `RENDER_EXTERNAL_URL` or `RENDER=true`.
- **Interval**: Periodically sends an asynchronous HTTP GET request every 10 minutes to its public URL.
- **Effect**: Because the request is routed over HTTPS through Render's public edge proxy, it counts as external incoming HTTP traffic, continuously resetting Render's 15-minute idle counter.
- **Clean Lifecycle**: Managed via FastAPI's `@asynccontextmanager` `lifespan` handler with graceful start and shutdown.

### Layer 3: Frontend Initial Warmup Ping (`frontend/src/App.tsx`)
- When any client opens the web application, a non-blocking initial `GET /api/health` is fired immediately to prime the backend before the user triggers heavier spatial or analytical queries.

### Layer 4: Standalone Automation Script (`scripts/keep_alive.py`)
A lightweight, zero-dependency Python CLI script for running keep-alive pings from any machine, cron, container, or background daemon:

```bash
# Ping every 10 minutes (default)
python scripts/keep_alive.py

# Ping custom URL every 12 minutes
python scripts/keep_alive.py --url https://geospatial-site-bitnbuild.onrender.com --interval 720

# Single ping test
python scripts/keep_alive.py --once
```

---

## 3. Optional External Uptime Monitors (Recommended Free Services)
For additional external redundancy, you can also register the `/api/health` endpoint on free uptime monitoring services:
1. **[UptimeRobot](https://uptimerobot.com)** (Free 5-minute interval monitoring)
   - Monitor Type: `HTTP(s)`
   - URL: `https://geospatial-site-bitnbuild.onrender.com/api/health`
   - Monitoring Interval: `5 minutes` or `10 minutes`
2. **[cron-job.org](https://cron-job.org)** (Free 1-minute to 15-minute cron webhooks)
   - URL: `https://geospatial-site-bitnbuild.onrender.com/api/health`
   - Schedule: Every 10 minutes
