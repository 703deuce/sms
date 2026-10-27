"""Route detected screen-share clips to screen_pip layout (REFRAME_V2_ENABLED only)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from clips_worker.render_clip import V3
from clips_worker.reframe_v2 import reframe_v2_ops_enabled
from clips_worker.screen_share_detect import probe_screen_share_video


def apply_screen_share_env(clip_src: Path) -> tuple[dict[str, str], dict[str, Any]]:
    shadow: dict[str, Any] = {"screenShareProbe": False}
    if not reframe_v2_ops_enabled():
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
