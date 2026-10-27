"""Pytest path setup for prototype/v3 modules used by director/smoothing calm tests."""
from __future__ import annotations

import sys
from pathlib import Path

_V3 = Path(__file__).resolve().parents[1] / "prototype" / "v3"
if _V3.is_dir() and str(_V3) not in sys.path:
    sys.path.insert(0, str(_V3))
