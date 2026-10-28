"""Rolling analyze window identity (transcript / picker cache scope)."""
from __future__ import annotations

import hashlib


def analyze_window_tag(*, range_start_ms: int, range_end_ms: int, audio_key: str) -> str:
    raw = f"{int(range_start_ms)}:{int(range_end_ms)}:{audio_key.strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:20]
