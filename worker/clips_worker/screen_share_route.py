"""Route detected screen-share clips to screen_pip layout (speakercrop v2 per-clip)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from clips_worker.render_clip import V3
from clips_worker.reframe_v2 import reframe_v2_ops_enabled
from clips_worker.screen_share_detect import probe_screen_share_video

# User- or probe-selected layouts must not be overridden by screen-share vision.
_SCREEN_SHARE_BLOCK_LAYOUTS = frozenset(
    {
        "fit",
        "fill",
        "split",
        "split_debate",
        "grid",
        "grid3",
        "grid4",
        "dynamic",
        "locked_off",
        "screen_pip",
        "pip",
        "side",
    }
)


def should_run_screen_share_vision_probe(settings: dict | None, applied_layout: str) -> bool:
    """Vision layout check: only when v2 ops on and user did not lock a non-default layout."""
    if not reframe_v2_ops_enabled():
        return False
    raw = ((settings or {}).get("layout") or "speaker_follow").strip()
    if raw not in ("auto", "speaker_follow", "subject_follow"):
        return False
    applied = (applied_layout or "speaker_follow").strip()
    if applied in _SCREEN_SHARE_BLOCK_LAYOUTS:
        return False
    return True


def apply_screen_share_env(
    clip_src: Path,
    *,
    settings: dict | None = None,
    applied_layout: str = "speaker_follow",
) -> tuple[dict[str, str], dict[str, Any]]:
    shadow: dict[str, Any] = {"screenShareProbe": False}
    if not should_run_screen_share_vision_probe(settings, applied_layout):
        shadow["screenShareVisionGate"] = (
            "reframe_v2_off" if not reframe_v2_ops_enabled() else "layout_locked"
        )
        return {}, shadow

    verdict = probe_screen_share_video(str(clip_src), models_dir=str(V3))
    shadow["screenShareProbe"] = True
    shadow["screenShareConfidence"] = verdict.confidence
    shadow["screenShareFaceCorner"] = verdict.face_corner
    if not verdict.is_screen_share:
        return {}, shadow
    shadow["routedLayout"] = "screen_pip"
    shadow["appliedLayout"] = "screen_pip"
    return {
        "REFRAME_V": "2",
        "LAYOUT_MODE": "screen_pip",
        "LAYOUT_STYLE": "screen_pip",
        "SCREEN_PIP": "1",
        "SCREEN_PIP_META": json.dumps(
            {"confidence": verdict.confidence, "faceCorner": verdict.face_corner},
            separators=(",", ":"),
        ),
    }, shadow
