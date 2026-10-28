"""Discovery density cap + pick telemetry (no filler padding)."""
from __future__ import annotations

import json
from typing import Any

from clips_worker.picker.config import selection_settings


def compute_pick_want(settings: dict, duration_ms: int) -> int:
    """Upper bound for telemetry/tiers only — not a ship cap on gated discoveries."""
    cfg = selection_settings()
    max_clips = int(cfg.get("max_clips") or 24)
    streamer = (settings.get("streamer") or {}) if isinstance(settings, dict) else {}
    user_cap = int(streamer.get("clipCount") or settings.get("clipCount") or 0)
    want = max_clips
    if user_cap > 0:
        want = min(want, user_cap)
    return max(1, want)


def log_pick_stage(