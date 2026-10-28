"""Discovery density cap + pick telemetry (no filler padding)."""
from __future__ import annotations

import json
from typing import Any

from clips_worker.picker.config import selection_settings


def compute_pick_want(settings: dict, duration_ms: int) -> int:
    """Soft cap ~1 clip / 50s — never pad with filler picks."""
    cfg = selection_settings()
    max_clips = int(cfg.get("max_clips") or 24)
    streamer = (settings.get("streamer") or {}) if isinstance(settings, dict) else {}
    user_cap = int(streamer.get("clipCount") or settings.get("clipCount") or 0)
    dur_s = max(1, int(duration_ms // 1000))
    density = max(1, int(round(dur_s / 50.0)))
    want = min(max_clips, density)
    if user_cap > 0:
        want = min(want, user_cap)
    feasible = max(1, dur_s // 15)
    return max(1, min(want, feasible))


def log_pick_stage(
    path: str,
    *,
    want: int,
    round_n: int | None = None,
    got: int | None = None,
    after_dedupe: int | None = None,
    after_overlap: int | None = None,
    after_threshold: int | None = None,
    final: int | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    parts = [f"path={path}", f"want={want}"]
    if round_n is not None:
        parts.append(f"round={round_n}")
    if got is not None:
        parts.append(f"got={got}")
    if after_dedupe is not None:
        parts.append(f"after_dedupe={after_dedupe}")
    if after_overlap is not None:
        parts.append(f"after_overlap={after_overlap}")
    if after_threshold is not None:
        parts.append(f"after_threshold={after_threshold}")
    if final is not None:
        parts.append(f"final={final}")
    if extra:
        parts.append(json.dumps(extra, separators=(",", ":")))
    print(f"[clipper:pick] {' '.join(parts)}", flush=True)
