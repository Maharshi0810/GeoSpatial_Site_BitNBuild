"""Backend package initialization."""

import sys
from pathlib import Path

# Add backend directory and project root to sys.path
_backend_dir = Path(__file__).resolve().parent
_project_dir = _backend_dir.parent

for _p in [str(_backend_dir), str(_project_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)
