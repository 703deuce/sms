"""Auto-detect facecam overlay box (S7, heuristic + YuNet when available)."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import cv2
import numpy as np


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
    centers: list[tuple[float, float, float, float]] = []
    frames = 0
    while frames < 60:
        ok, fr = cap.read()
        if not ok:
            break
        frames += 1
        if frames % 3 != 0:
            continue
        _, faces = det.detect(fr)
        if faces is None or len(faces) == 0:
            continue
        for f in faces:
            x, y, fw, fh = float(f[0]), float(f[1]), float(f[2]), float(f[3])
            centers.append((x + fw / 2, y + fh / 2, fw, fh))
    cap.release()

    if len(centers) < 3:
        return {"layout": "gameplay", "confidence": 0.2, "source": "auto", "facecam": None}

    xs = np.array([c[0] for c in centers])
    ys = np.array([c[1] for c in centers])
    cx, cy = float(np.median(xs)), float(np.median(ys))
    fw = float(np.median([c[2] for c in centers])) * 2.2
    fh = float(np.median([c[3] for c in centers])) * 2.6
    x = max(0.0, (cx - fw / 2) / w)
    y = max(0.0, (cy - fh / 2) / h)
    fw_n = min(0.45, fw / w)
    fh_n = min(0.45, fh / h)
    confidence = min(1.0, len(centers) / 12.0)
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
