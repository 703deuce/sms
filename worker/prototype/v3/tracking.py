"""ByteTrack-lite association + SFace re-ID clustering for multiperson clipper."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

try:
    from sklearn.cluster import AgglomerativeClustering
except ImportError:  # pragma: no cover
    AgglomerativeClustering = None  # type: ignore

SFACE_FILENAME = "face_recognition_sface_2021dec.onnx"
REID_DIST = float(os.environ.get("REID_DIST", "0.6"))
MIN_CLUSTER_FRAC = float(os.environ.get("REID_MIN_CLUSTER_FRAC", "0.05"))
MAX_PERSONS = int(os.environ.get("MAX_PERSONS", "5"))
IOU_HIGH = 0.3
IOU_LOW = 0.3


def box_iou(a: np.ndarray, b: np.ndarray) -> float:
    ax, ay, aw, ah = a[0], a[1], a[2], a[3]
    bx, by, bw, bh = b[0], b[1], b[2], b[3]
    x1 = max(ax, bx)
    y1 = max(ay, by)
    x2 = min(ax + aw, bx + bw)
    y2 = min(ay + ah, by + bh)
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    if inter <= 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return float(inter / max(union, 1e-9))


@dataclass
class Det:
    frame: int
    t: float
    box: np.ndarray
    score: float

    @property
    def cx(self) -> float:
        return float(self.box[0] + self.box[2] / 2)

    @property
    def area(self) -> float:
        return float(self.box[2] * self.box[3])


@dataclass
class Tracklet:
    tid: int
    dets: list[Det] = field(default_factory=list)

    def last_box(self) -> np.ndarray | None:
        return self.dets[-1].box if self.dets else None


def associate_frame(
    tracklets: list[Tracklet],
    detections: list[Det],
    *,
    iou_thresh: float = IOU_HIGH,
) -> tuple[list[Tracklet], list[Det]]:
    """Greedy IoU match; unmatched dets start new tracklets."""
    unmatched = list(detections)
    for tr in tracklets:
        lb = tr.last_box()
        if lb is None:
            continue
        best_i, best_iou = -1, 0.0
        for j, det in enumerate(unmatched):
            if det.score < 0.3:
                continue
            iou = box_iou(lb, det.box)
            if iou >= iou_thresh and iou > best_iou:
                best_iou = iou
                best_i = j
        if best_i >= 0:
            tr.dets.append(unmatched.pop(best_i))
    for det in unmatched:
        if det.score >= 0.3:
            tracklets.append(Tracklet(tid=len(tracklets), dets=[det]))
    # second pass: low-score boxes 0.3–0.6
    for tr in tracklets:
        lb = tr.last_box()
        if lb is None:
            continue
        for j, det in enumerate(unmatched):
            if not (0.3 <= det.score < 0.6):
                continue
            if box_iou(lb, det.box) >= IOU_LOW:
                tr.dets.append(det)
                unmatched.pop(j)
                break
    return tracklets, unmatched


def histogram_shot_cuts(gray_frames: list[np.ndarray], thresh: float = 0.35) -> list[int]:
    """Frame indices where a new shot starts (0 always included)."""
    if not gray_frames:
        return [0]
    cuts = [0]
    prev = cv2.calcHist([gray_frames[0]], [0], None, [64], [0, 256]).flatten()
    prev = prev / (prev.sum() + 1e-9)
    for i in range(1, len(gray_frames)):
        h = cv2.calcHist([gray_frames[i]], [0], None, [64], [0, 256]).flatten()
        h = h / (h.sum() + 1e-9)
        diff = float(np.sum(np.abs(h - prev)))
        if diff > thresh:
            cuts.append(i)
        prev = h
    return cuts


def sface_path(models_dir: str) -> str:
    primary = os.path.join(models_dir, SFACE_FILENAME)
    if os.path.isfile(primary):
        return primary
    legacy = os.path.join(models_dir, "sface.onnx")
    if os.path.isfile(legacy):
        return legacy
    return primary


def load_sface(models_dir: str) -> cv2.FaceRecognizerSF:
    path = sface_path(models_dir)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"missing SFace model: {path}")
    return cv2.FaceRecognizerSF.create(path, "")


def embed_tracklet(
    rec: cv2.FaceRecognizerSF,
    frame_by_index: dict[int, np.ndarray],
    tracklet: Tracklet,
    max_samples: int = 5,
) -> np.ndarray | None:
    ranked = sorted(tracklet.dets, key=lambda d: (-d.score, -d.area))[: max_samples * 2]
    feats: list[np.ndarray] = []
    for det in ranked:
        fr = frame_by_index.get(det.frame)
        if fr is None:
            continue
        row = np.array([*det.box[:4], det.score, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], dtype=np.float32)
        if row.size < 15:
            row = np.resize(row, 15)
        try:
            aligned = rec.alignCrop(fr, row)
            feat = rec.feature(aligned)
            feats.append(feat.flatten().astype(np.float64))
        except cv2.error:
            continue
        if len(feats) >= max_samples:
            break
    if not feats:
        return None
    mean = np.mean(np.stack(feats, axis=0), axis=0)
    n = np.linalg.norm(mean)
    return mean / n if n > 1e-9 else mean


def cluster_tracklets(
    tracklets: list[Tracklet],
    embeddings: list[np.ndarray | None],
    total_frames: int,
) -> list[list[Tracklet]]:
    """Cluster tracklets into persons; drop rare clusters."""
    valid = [(i, e) for i, e in enumerate(embeddings) if e is not None]
    if not valid:
        return []
    if len(valid) == 1:
        return [[tracklets[valid[0][0]]]]
    idxs, embs = zip(*valid)
    X = np.stack([e for e in embs], axis=0)
    if AgglomerativeClustering is None:
        return [[tracklets[i] for i in idxs]]
    cl = AgglomerativeClustering(
        n_clusters=None,
        metric="cosine",
        linkage="average",
        distance_threshold=REID_DIST,
    )
    labels = cl.fit_predict(X)
    groups: dict[int, list[Tracklet]] = {}
    for lab, ti in zip(labels, idxs):
        groups.setdefault(int(lab), []).append(tracklets[ti])
    min_frames = max(1, int(MIN_CLUSTER_FRAC * total_frames))
    kept: list[list[Tracklet]] = []
    for grp in groups.values():
        frames = {d.frame for tr in grp for d in tr.dets}
        if len(frames) >= min_frames:
            kept.append(grp)
    kept.sort(key=lambda g: np.mean([d.cx for tr in g for d in tr.dets]))
    return kept[:MAX_PERSONS]


def person_id_label(index: int) -> str:
    return f"P{index + 1}"


def tracklets_at_frame(person_tracklets: list[Tracklet], frame: int) -> list[Det]:
    out: list[Det] = []
    for tr in person_tracklets:
        for d in tr.dets:
            if d.frame == frame:
                out.append(d)
                break
    return out
