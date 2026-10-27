"""Ops gate for speakercrop v2 / multiperson layouts (worker env REFRAME_V2_ENABLED=1)."""
from __future__ import annotations

import os


def reframe_v2_ops_enabled() -> bool:
    return os.environ.get("REFRAME_V2_ENABLED", "").strip() == "1"
