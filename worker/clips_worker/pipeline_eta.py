"""FIX3: monotonic pipeline ETA for upload clip projects (picker + finalize + reframe)."""
from __future__ import annotations

import math

from clips_worker.clip_progress import REFRAME_ETA_SEC_PER_CLIP

FINALIZE_ETA_SEC = 45
PICKER_BUDGET_MIN_S = 120
PICKER_BUDGET_PER_25MIN_S = 180


def picker_budget_s(source_s: float) -> int:
    """Expected picker wall time. proj_7346: 3:46 source -> 129 s; ~25 min interview -> ~180 s."""
    return max(PICKER_BUDGET_MIN_S, int(round(PICKER_BUDGET_PER_25MIN_S * max(0.0, float(source_s)) / 1500.0)))


def estimated_clip_count(source_s: float) -> int:
    """Mirror of new-app lib/clips/project-eta.ts estimatedClipCount (3..12)."""
    if source_s <= 0:
        return 4
    return min(12, max(3, int(round(float(source_s) / 1500.0 * 4))))


def reframe_wall_eta_sec(clip_count: int, render_concurrency: int) -> int:
    clips = max(1, int(clip_count))
    conc = max(1, int(render_concurrency))
    return int(math.ceil(clips / conc) * REFRAME_ETA_SEC_PER_CLIP)


def upload_pipeline_eta_seconds(
    elapsed_s: float,
    source_s: float,
    render_concurrency: int,
    *,
    reframe_completed: int = 0,
    reframe_total: int | None = None,
) -> int:
    """Total remaining wall time — decreases as ``elapsed_s`` grows (never meant to jump up on repost)."""
    clips = reframe_total if reframe_total and reframe_total > 0 else estimated_clip_count(source_s)
    total_budget = float(picker_budget_s(source_s) + FINALIZE_ETA_SEC + reframe_wall_eta_sec(clips, render_concurrency))
    remaining = total_budget - max(0.0, float(elapsed_s))
    reframe_left = reframe_wall_eta_sec(max(0, clips - reframe_completed), render_concurrency)
    return max(0, int(max(remaining, reframe_left)))
