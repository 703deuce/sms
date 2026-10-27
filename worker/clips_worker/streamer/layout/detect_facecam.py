"""Auto-detect facecam overlay box (S7). Upgraded: samples across the whole VOD and finds the persistent
overlay rectangle (edge persistence + 4-side support), validated by recurring YuNet faces inside it.
Falls back to the original median-face x 2.2/2.6 box when no rectangle is supported."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import cv2
import numpy as np

AW = 640                    # analysis width (all geometry below is in this scale)


def _probe_wh(video: Path) -> tuple[int, int]:          # unchanged
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height", "-of", "json", str(video)], text=True)
    s = json.loads(out)["streams"][0]
    return int(s["width"]), int(s["height"])


def _sample_frames(video: Path, n: int = 24):
    """n frames spread over 2%..98% of the duration (seek, not decode-all)."""
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    nf = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or int(fps * 60)
    out = []
    for fi in np.linspace(0.02 * nf, 0.98 * nf, n).astype(int):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
        ok, fr = cap.read()
        if ok:
            out.append(fr)
    cap.release()
    return out


def _line_candidates(P: np.ndarray, axis: int, lo: int, hi: int, k: int = 10) -> list[int]:
    """Top-k columns (axis=0) or rows (axis=1) by persistent-edge support inside the band [lo, hi)."""
    band = P[lo:hi, :] if axis == 0 else P[:, lo:hi].T
    s = band.mean(axis=0)
    idx = [int(i) for i in np.argsort(-s)[: 4 * k] if s[i] > 0.25]
    keep: list[int] = []
    for i in idx:                                         # non-max suppression: 3 px
        if all(abs(i - j) > 3 for j in keep):
            keep.append(i)
    return keep[:k]


def find_overlay_rect(P: np.ndarray, face: tuple[float, float, float, float], min_support: float = 0.7):
    """Best rectangle (l, t, r, b) enclosing `face` (cx, cy, w, h) whose 4 sides lie on persistent edges
    (or on the frame border). P: dilated persistent-edge mask in [0,1], shape (h, w)."""
    h, w = P.shape
    cx, cy, fw, fh = face
    cs_v = np.vstack([np.zeros((1, w)), np.cumsum(P, axis=0)])   # vertical prefix sums per column
    cs_h = np.hstack([np.zeros((h, 1)), np.cumsum(P, axis=1)])   # horizontal prefix sums per row
    EDGE = 0.8                                            # a side flush with the frame border counts as 0.8
    vsup = lambda x, y0, y1: EDGE if x in (0, w - 1) else (cs_v[y1, x] - cs_v[y0, x]) / max(1, y1 - y0)
    hsup = lambda y, x0, x1: EDGE if y in (0, h - 1) else (cs_h[y, x1] - cs_h[y, x0]) / max(1, x1 - x0)
    y_band = (int(max(0, cy - fh)), int(min(h, cy + fh)))
    x_band = (int(max(0, cx - fw)), int(min(w, cx + fw)))
    cols = _line_candidates(P, 0, *y_band) + [0, w - 1]
    rows = _line_candidates(P, 1, *x_band) + [0, h - 1]
    L = [x for x in cols if x < cx - 0.3 * fw]; R = [x for x in cols if x > cx + 0.3 * fw]   # face may touch
    T = [y for y in rows if y < cy - 0.3 * fh]; B = [y for y in rows if y > cy + 0.3 * fh]   # the cam border
    best, best_s = None, 0.0
    for l in L:
        for r in R:
            for t in T:
                for b in B:
                    rw, rh = r - l, b - t
                    area = rw * rh / (w * h)
                    if not (0.03 <= area <= 0.35 and 0.8 <= rw / max(rh, 1) <= 2.4):
                        continue
                    if (l, t, r, b) == (0, 0, w - 1, h - 1):
                        continue
                    sides = [vsup(l, t, b), vsup(r, t, b), hsup(t, l, r), hsup(b, l, r)]
                    if min(sides) < min_support:
                        continue
                    s = float(np.mean(sides)) + 0.05 * area      # tie-break toward the outer (overlay) border
                    if s > best_s:
                        best, best_s = (l, t, r, b), s
    return best, best_s


def detect_facecam_layout(video: Path, work: Path, n_samples: int = 60) -> dict[str, Any]:
    """Return layout dict: layout stack|gameplay, facecam box normalised, confidence. (contract unchanged,
    plus `method`: rect|face_box and `persist`: fraction of samples with a face in the box)."""
    w, h = _probe_wh(video)
    v3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))
    yunet_path = v3 / "yunet.onnx"
    gameplay = {"layout": "gameplay", "confidence": 0.0, "source": "auto", "facecam": None}
    if not yunet_path.exists():
        return gameplay
    frames = _sample_frames(video, n_samples)                       # CHANGED: whole VOD, not first 60 frames
    if not frames:
        return gameplay
    ah = int(round(h * AW / w))
    det = cv2.FaceDetectorYN_create(str(yunet_path), "", (AW, ah), 0.6, 0.3, 50)
    E = np.zeros((ah, AW), np.float32); faces = []
    for si, fr in enumerate(frames):
        sm = cv2.resize(fr, (AW, ah), interpolation=cv2.INTER_AREA)
        E += cv2.Canny(cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY), 60, 160) > 0
        _, f = det.detect(sm)
        for r in ([] if f is None else f):
            faces.append((si, r[0] + r[2] / 2, r[1] + r[3] / 2, r[2], r[3]))
    if len(faces) < 3:
        return {**gameplay, "confidence": 0.2}
    P = cv2.dilate(((E / len(frames)) >= 0.6).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
    # recurring face: the median of the biggest cluster of face centres (within 8% of frame width)
    F = np.array(faces); best_c, best_n = None, 0
    for _, x, y, _, _ in F:
        m = np.hypot(F[:, 1] - x, F[:, 2] - y) < 0.08 * AW
        n_s = len(set(F[m, 0].astype(int)))
        if n_s > best_n:
            best_n, best_c = n_s, m
    C = F[best_c]
    face = tuple(float(np.median(C[:, i])) for i in (1, 2, 3, 4))
    persist = best_n / len(frames)
    rect, support = find_overlay_rect(P, face)
    if rect is not None:
        l, t, r, b = rect; method = "rect"
        confidence = float(min(1.0, 0.5 * support + 0.5 * min(1.0, persist / 0.5)))
        box = {"x": l / AW, "y": t / ah, "w": (r - l) / AW, "h": (b - t) / ah}
    else:                                                            # legacy heuristic, kept as fallback
        cx, cy, fw, fh = face; fw *= 2.2; fh *= 2.6; method = "face_box"
        box = {"x": max(0.0, (cx - fw / 2) / AW), "y": max(0.0, (cy - fh / 2) / ah),
               "w": min(0.45, fw / AW), "h": min(0.45, fh / ah)}
        confidence = float(min(0.5, persist))       # < 0.6: caller asks Gemini (bic 4.5 step 5) / user
    if persist < 0.5:                     # bic 4.5: the cam face must be present in >= 50% of samples
        return {**gameplay, "confidence": round(1 - persist, 2)}
    return {"layout": "stack", "facecam": {k: round(v, 4) for k, v in box.items()}, "gameplay": None,
            "split": 0.4, "facecamPosition": "top", "confidence": round(confidence, 3), "source": "auto",
            "method": method, "persist": round(persist, 3)}
