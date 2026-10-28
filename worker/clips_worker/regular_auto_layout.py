"""Regular clipper: default to full_frame when face probe is weak (screen/slides)."""
from __future__ import annotations

import os
from pathlib import Path

from clips_worker.subject_reframe import has_face_and_speech


def auto_full_frame_enabled() -> bool:
    if os.environ.get("CLIP_AUTO_FULL_FRAME") == "0":
        return False
    return True


def face_reliable_fraction(video: Path, words: list[dict]) -> float:
    """Share of sampled frames with a YuNet face (0–1)."""
    import cv2

    if not words:
        return 0.0
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        return 0.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    v3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))
    yunet = cv2.FaceDetectorYN_create(str(v3 / "yunet.onnx"), "", (w, h), 0.5, 0.3, 50)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    sample_positions: list[int] = []
    if total > 0:
        for ratio in (0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9):
            sample_positions.append(min(total - 1, max(0, int(total * ratio))))
    else:
        sample_positions = list(range(0, 60, 8))
    hits = 0
    n = 0
    for pos in sample_positions:
        if total > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
            ok, fr = cap.read()
        else:
            ok, fr = cap.read()
        if not ok:
            continue
        n += 1
        _, faces = yunet.detect(fr)
        if faces is not None and len(faces) > 0:
            hits += 1
    cap.release()
    if n == 0:
        return 0.0
    return hits / n


def apply_regular_auto_layout(
    edits: dict,
    video: Path,
    words: list[dict],
    *,
    streamer: bool = False,
) -> dict:
    if streamer or not auto_full_frame_enabled():
        return edits
    layout = edits.get("layout") or {}
    mode = str(layout.get("mode") or "speaker_follow")
    if mode in ("fit_blur", "fit_top", "full_frame"):
        return edits
    if mode not in ("speaker_follow", "subject_follow", "auto"):
        return edits
    if has_face_and_speech(video, words):
        return edits
    frac = face_reliable_fraction(video, words)
    if frac >= 0.34:
        return edits
    return {
        **edits,
        "layout": {**layout, "mode": "full_frame"},
    }
