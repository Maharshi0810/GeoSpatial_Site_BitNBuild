#!/usr/bin/env python3
"""Render Backend Keep-Alive Automation Script.

Continuously sends HTTP GET requests to the backend /api/health endpoint at
a configurable interval to prevent Render free tier instances from sleeping
after 15 minutes of inactivity.

Usage:
    # Run continuous ping every 10 minutes (default)
    python scripts/keep_alive.py

    # Ping a specific URL every 12 minutes
    python scripts/keep_alive.py --url https://geospatial-site-bitnbuild.onrender.com --interval 720

    # Ping once and exit (for external crons or container healthchecks)
    python scripts/keep_alive.py --once
"""

import argparse
import datetime
import sys
import time
import urllib.request
import urllib.error

DEFAULT_BACKEND_URL = "https://geospatial-site-bitnbuild.onrender.com/api/health"
DEFAULT_INTERVAL_SECONDS = 600  # 10 minutes


def ping(url: str, timeout: int = 60) -> bool:
    """Send an HTTP GET request to the target URL."""
    target = url.rstrip("/")
    if not target.endswith("/api/health") and not target.endswith("/health"):
        target = f"{target}/api/health"

    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[{timestamp}] Pinging {target} ...", end=" ", flush=True)

    start_time = time.time()
    req = urllib.request.Request(
        target,
        headers={"User-Agent": "Render-KeepAlive-Script/1.0"},
        method="GET"
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            duration = time.time() - start_time
            status = response.getcode()
            body = response.read().decode("utf-8", errors="replace")[:120]
            print(f"SUCCESS (HTTP {status}, {duration:.2f}s) - {body}")
            return True
    except urllib.error.HTTPError as e:
        duration = time.time() - start_time
        print(f"HTTP ERROR {e.code} ({duration:.2f}s): {e.reason}")
        return False
    except urllib.error.URLError as e:
        duration = time.time() - start_time
        print(f"NETWORK ERROR ({duration:.2f}s): {e.reason}")
        return False
    except Exception as e:
        duration = time.time() - start_time
        print(f"UNEXPECTED ERROR ({duration:.2f}s): {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Automated keep-alive worker for Render-hosted backend services."
    )
    parser.add_argument(
        "--url",
        "-u",
        default=DEFAULT_BACKEND_URL,
        help=f"Target backend URL to ping (default: {DEFAULT_BACKEND_URL})",
    )
    parser.add_argument(
        "--interval",
        "-i",
        type=int,
        default=DEFAULT_INTERVAL_SECONDS,
        help=f"Ping interval in seconds (default: {DEFAULT_INTERVAL_SECONDS}s)",
    )
    parser.add_argument(
        "--timeout",
        "-t",
        type=int,
        default=60,
        help="HTTP request timeout in seconds (default: 60s, accommodates cold starts)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Ping once and exit immediately with exit code (0 on success, 1 on failure)",
    )

    args = parser.parse_args()

    print("==================================================")
    print(" GeoVista Backend Keep-Alive Service")
    print(f" Target URL : {args.url}")
    print(f" Interval   : {args.interval}s")
    print(f" Timeout    : {args.timeout}s")
    print(f" Single-run : {args.once}")
    print("==================================================")

    if args.once:
        success = ping(args.url, timeout=args.timeout)
        sys.exit(0 if success else 1)

    while True:
        try:
            ping(args.url, timeout=args.timeout)
            time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nKeep-alive service stopped by user.")
            sys.exit(0)


if __name__ == "__main__":
    main()
