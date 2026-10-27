"""Guide §12: analysis wall-clock vs source duration on ≤60 s fixture (0.4–0.6× RT target)."""
from __future__ import annotations

import os
import time

import pytest

from clips_worker import reframe_core as rc

FIX = os.environ.get("CLIPPER_FIXTURE", "/workspace/clipper-guide/media/multicam_edit.mp4")
MODELS = os.environ.get("CLIPPER_MODELS", "/workspace/clipper-guide/models")
pytestmark = pytest.mark.skipif(
    not (os.path.isfile(FIX) and os.path.isdir(MODELS)),
    reason="fixture/models missing (set CLIPPER_FIXTURE + CLIPPER_MODELS)",
)


def _source_duration_s(path: str) -> float:
    import cv2

    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    cap.release()
    return float(n / fps) if n else 60.0


def test_analyze_clip_realtime_factor():
    dur = min(60.0, _source_duration_s(FIX))
    t0 = time.perf_counter()
    track = rc.analyze_clip(FIX, None, rc.director_cfg_from_env({}), models_dir=MODELS)
    wall = time.perf_counter() - t0
    assert track.get("people"), "expected faces on fixture"
    rt = wall / dur
    assert 0.35 <= rt <= 0.70, f"wall={wall:.1f}s dur={dur:.1f}s rt={rt:.2f}"
