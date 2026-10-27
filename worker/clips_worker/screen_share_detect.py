"""Detect screen-share + corner webcam (low motion, text-heavy main + face in corner)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore


@dataclass(frozen=True)
class ScreenShareVerdict:
    is_screen_share: bool
    confidence: float
    face_corner: str | None = None


def edge_density(gray: np.ndarray) -> float:
    if cv2 is None:
        return 0.0
    edges = cv2.Canny(gray, 50, 150)
    return float(np.mean(edges > 0))


def mean_optical_flow(prev: np.ndarray, nxt: np.ndarray) -> float:
    if cv2 is None:
        return 0.0
    flow = cv2.calcOpticalFlowFarneback(prev, nxt, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    mag = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
    return float(np.mean(mag))


def face_in_corner_norm(cx: float, cy: float, margin: float = 0.35) -> str | None:
    """Return corner id if face center lies in outer margin band."""
    if cx <= margin and cy <= margin:
        return "tl"
    if cx >= 1 - margin and cy <= margin:
        return "tr"
    if cx <= margin and cy >= 1 - margin:
        return "bl"
    if cx >= 1 - margin and cy >= 1 - margin:
        return "br"
    return None


def classify_screen_share_from_samples(
    gray_frames: list[np.ndarray],
    *,
    face_cx_norm: float | None = None,
    face_cy_norm: float | None = None,
    down_w: int = 160,
    down_h: int = 90,
) -> ScreenShareVerdict:
    """
    Heuristic: central / full-frame region has high edge density + low flow;
    optional face sits in a corner (typical webcam overlay).
    """
    if len(gray_frames) < 2:
        return ScreenShareVerdict(False, 0.0)

    resized = []
    for g in gray_frames[: min(12, len(gray_frames))]:
        if cv2 is None:
            resized.append(g)
        else:
            resized.append(cv2.resize(g, (down_w, down_h), interpolation=cv2.INTER_AREA))

    edges = [edge_density(f) for f in resized]
    flows = [mean_optical_flow(resized[i], resized[i + 1]) for i in range(len(resized) - 1)]
    edge_mean = float(np.mean(edges))
    flow_mean = float(np.mean(flows)) if flows else 0.0

    corner = None
    if face_cx_norm is not None and face_cy_norm is not None:
        corner = face_in_corner_norm(face_cx_norm, face_cy_norm)

    # Tunable thresholds — high structure, low motion (slides/code), face optional but boosts confidence.
    text_like = edge_mean >= 0.08
    static_like = flow_mean <= 1.2
    score = 0.0
    if text_like and static_like:
        score = 0.55 + min(0.25, (edge_mean - 0.08) * 2.0) + min(0.15, (1.2 - flow_mean) / 8.0)
    if corner:
        score = min(1.0, score + 0.2)
    is_ss = score >= 0.55 and text_like and static_like and corner is not None
    return ScreenShareVerdict(is_screen_share=is_ss, confidence=round(score, 3), face_corner=corner)


def probe_screen_share_video(video_path: str, sample_count: int = 8, models_dir: str | None = None) -> ScreenShareVerdict:
    """Lightweight OpenCV probe (worker hot path when REFRAME_V2_ENABLED=1)."""
    if cv2 is None:
        return ScreenShareVerdict(False, 0.0)
    from pathlib import Path

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return ScreenShareVerdict(False, 0.0)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if total < 2:
        cap.release()
        return ScreenShareVerdict(False, 0.0)
    step = max(1, total // sample_count)
    grays: list[np.ndarray] = []
    face_cx = face_cy = None
    model = None
    if models_dir:
        p = Path(models_dir) / "face_detection_yunet_2023mar.onnx"
        if p.is_file():
            model = str(p)
    fi = 0
    while len(grays) < sample_count:
        cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
        ok, fr = cap.read()
        if not ok:
            break
        h, w = fr.shape[:2]
        grays.append(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY))
        if face_cx is None and model:
            try:
                det = cv2.FaceDetectorYN.create(model, "", (320, 320), 0.5, 0.3, 5000)
                det.setInputSize((w, h))
                _, faces = det.detect(fr)
                if faces is not None and len(faces):
                    row = faces[0]
                    x, y, bw, bh = [float(v) for v in row[:4]]
                    face_cx = (x + bw / 2) / w
                    face_cy = (y + bh / 2) / h
            except Exception:
                pass
        fi += step
    cap.release()
    if len(grays) < 2:
        return ScreenShareVerdict(False, 0.0)
    return classify_screen_share_from_samples(
        grays,
        face_cx_norm=face_cx,
        face_cy_norm=face_cy,
    )
