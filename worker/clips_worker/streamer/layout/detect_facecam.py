"""Auto-detect facecam overlay box (S7, heuristic + YuNet when available)."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import cv2
import numpy as np

SAMPLE_INTERVAL_S = 2.0
MAX_SAMPLES = 60


def _probe_wh(video: Path) -> tuple[int, int]:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            str(video),
        ],
        text=True,
    )
    s = json.loads(out)["streams"][0]
    return int(s["width"]), int(s["height"])


def _probe_duration_s(video: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video),
        ],
        text=True,
    ).strip()
    return max(0.0, float(out or 0))


def _sample_times(duration_s: float) -> list[float]:
    times: list[float] = []
    t = 0.0
    while t < duration_s and len(times) < MAX_SAMPLES:
        times.append(t)
        t += SAMPLE_INTERVAL_S
    if not times and duration_s > 0:
        times.append(0.0)
    return times


def detect_facecam_layout(video: Path, work: Path) -> dict[str, Any]:
    """Return layout dict: layout stack|gameplay, facecam box normalised, confidence."""
    w, h = _probe_wh(video)
    v3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))
    yunet_path = v3 / "yunet.onnx"
    if not yunet_path.exists():
        return {"layout": "gameplay", "confidence": 0.0, "source": "auto", "facecam": None}

    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        return {"layout": "gameplay", "confidence": 0.0, "source": "auto", "facecam": None}

    det = cv2.FaceDetectorYN_create(str(yunet_path), "", (w, h), 0.5, 0.3, 50)
    duration_s = _probe_duration_s(video)
    sample_times = _sample_times(duration_s)

    per_sample_boxes: list[list[tuple[float, float, float, float]]] = []
    for t in sample_times:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ok, fr = cap.read()
        if not ok:
            continue
        _, faces = det.detect(fr)
        boxes: list[tuple[float, float, float, float]] = []
        if faces is not None:
            for f in faces:
                x, y, fw, fh = float(f[0]), float(f[1]), float(f[2]), float(f[3])
                boxes.append((x + fw / 2, y + fh / 2, fw, fh))
        per_sample_boxes.append(boxes)
    cap.release()

    samples_with_face = sum(1 for b in per_sample_boxes if b)
    if samples_with_face < max(2, len(sample_times) // 5):
        return {"layout": "gameplay", "confidence": 0.2, "source": "auto", "facecam": None}

    centers: list[tuple[float, float, float, float]] = []
    for boxes in per_sample_boxes:
        if not boxes:
            continue
        best = max(boxes, key=lambda b: b[2] * b[3])
        centers.append(best)

    xs = np.array([c[0] for c in centers])
    ys = np.array([c[1] for c in centers])
    cx, cy = float(np.median(xs)), float(np.median(ys))
    fw = float(np.median([c[2] for c in centers])) * 2.2
    fh = float(np.median([c[3] for c in centers])) * 2.6
    x = max(0.0, (cx - fw / 2) / w)
    y = max(0.0, (cy - fh / 2) / h)
    fw_n = min(0.45, fw / w)
    fh_n = min(0.45, fh / h)
    confidence = min(1.0, samples_with_face / max(1, len(sample_times)))
    facecam = {"x": x, "y": y, "w": fw_n, "h": fh_n}
    return {
        "layout": "stack",
        "facecam": facecam,
        "gameplay": None,
        "split": 0.4,
        "facecamPosition": "top",
        "confidence": confidence,
        "source": "auto",
    }
