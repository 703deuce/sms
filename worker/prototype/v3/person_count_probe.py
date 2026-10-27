"""Lightweight person count for render routing (no full render)."""
from __future__ import annotations

import os
from pathlib import Path

import cv2
import numpy as np

from tracking import Det, Tracklet, associate_frame, cluster_tracklets, embed_tracklet, load_sface

HERE = Path(__file__).resolve().parent
PROBE_SAMPLE_FPS = float(os.environ.get("PROBE_SAMPLE_FPS", "1"))
PROBE_MAX_WIDTH = int(os.environ.get("PROBE_MAX_WIDTH", "640"))
PROBE_MAX_SAMPLES = int(os.environ.get("PROBE_MAX_SAMPLES", "120"))


def probe_person_count(video_path: str) -> dict:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"n_persons": 0, "confidence": 0.0, "mean_embed_coverage": 0.0}
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w, h = int(cap.get(3)), int(cap.get(4))
    sar_num = cap.get(cv2.CAP_PROP_SAR_NUM) or 1.0
    sar_den = cap.get(cv2.CAP_PROP_SAR_DEN) or 1.0
    if sar_den and abs(float(sar_num) / float(sar_den) - 1.0) > 0.02:
        w = int(round(w * float(sar_num) / float(sar_den)))
    det_path = os.path.join(HERE, "yunet.onnx")
    det = cv2.FaceDetectorYN.create(det_path, "", (640, 480), 0.55, 0.3, 50)
    scale = PROBE_MAX_WIDTH / max(w, h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    det.setInputSize((nw, nh))
    step = max(1, int(round(fps / PROBE_SAMPLE_FPS)))
    tracklets: list[Tracklet] = []
    small_frames: dict[int, np.ndarray] = {}
    fi = 0
    sample_i = 0
    embed_hits = 0
    embed_try = 0
    sface = load_sface(str(HERE))
    while sample_i < PROBE_MAX_SAMPLES:
        if not cap.grab():
            break
        if fi % step != 0:
            fi += 1
            continue
        ok, fr = cap.retrieve()
        if not ok:
            break
        fr_s = cv2.resize(fr, (nw, nh))
        small_frames[sample_i] = fr_s
        _, faces = det.detect(fr_s)
        dets: list[Det] = []
        if faces is not None:
            for row in faces:
                score = float(row[14]) if row.size > 14 else float(row[4])
                if score < 0.45:
                    continue
                x, y, bw, bh = [float(v) for v in row[:4]]
                box = np.array([x, y, bw, bh], dtype=np.float32)
                dets.append(Det(frame=sample_i, t=fi / fps, box=box, score=score))
        tracklets, _ = associate_frame(tracklets, dets)
        sample_i += 1
        fi += 1
        if len(small_frames) > 8:
            drop = min(small_frames)
            if drop not in {d.frame for tr in tracklets for d in tr.dets}:
                del small_frames[drop]
    cap.release()
    total_samples = max(1, sample_i)
    embeddings = []
    for tr in tracklets:
        embed_try += 1
        scaled_frames = {
            idx: small_frames[idx]
            for idx in {d.frame for d in tr.dets}
            if idx in small_frames
        }
        emb = embed_tracklet(sface, scaled_frames, tr) if sface is not None else None
        if emb is not None:
            embed_hits += 1
        embeddings.append(emb)
    small_frames.clear()
    groups = cluster_tracklets(tracklets, embeddings, total_samples)
    n = len(groups)
    coverage = embed_hits / max(1, embed_try)
    det_density = min(1.0, sum(len(tr.dets) for tr in tracklets) / (total_samples * 1.5))
    confidence = float(min(1.0, 0.35 + 0.4 * coverage + 0.25 * det_density))
    if n < 2:
        confidence = min(confidence, 0.45)
    return {"n_persons": n, "confidence": confidence, "mean_embed_coverage": coverage}
