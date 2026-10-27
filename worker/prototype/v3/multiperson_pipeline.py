"""Multiperson clipper pipeline (tracking + director + crop v2)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision, BaseOptions

from director import run_director, hungarian_map_speakers, combine_speaking_probs, style_config
from smoothing import FollowState, follow
from tracking import (
    Det,
    Tracklet,
    associate_frame,
    cluster_tracklets,
    embed_tracklet,
    histogram_shot_cuts,
    load_sface,
    person_id_label,
    tracklets_at_frame,
)

HERE = Path(__file__).resolve().parent
SAMPLE_FPS = float(os.environ.get("SAMPLE_FPS", "10"))


class SinglePersonFallback(RuntimeError):
    """Fewer than 2 persons — use legacy speakercrop path."""


def _env_float(k: str, d: str) -> float:
    return float(os.environ.get(k, d))


def detect_loop(
    cap: cv2.VideoCapture,
    det: cv2.FaceDetectorYN,
    fps: float,
    W: int,
    H: int,
) -> tuple[list[float], dict[int, np.ndarray], list[Tracklet], list[np.ndarray]]:
    step = max(1, int(round(fps / SAMPLE_FPS)))
    scale = 640.0 / max(W, H)
    nw, nh = int(W * scale), int(H * scale)
    det.setInputSize((nw, nh))
    times: list[float] = []
    frame_by_index: dict[int, np.ndarray] = {}
    gray_samples: list[np.ndarray] = []
    tracklets: list[Tracklet] = []
    fi = 0
    sample_i = 0
    while True:
        if not cap.grab():
            break
        if fi % step != 0:
            fi += 1
            continue
        ok, fr = cap.retrieve()
        if not ok:
            break
        t = fi / fps
        times.append(t)
        frame_by_index[sample_i] = fr
        gray_samples.append(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY))
        fr_s = cv2.resize(fr, (nw, nh))
        _, faces = det.detect(fr_s)
        dets: list[Det] = []
        if faces is not None:
            for row in faces:
                score = float(row[14]) if row.size > 14 else float(row[4])
                x, y, w, h = [float(v) for v in row[:4]]
                x /= scale
                y /= scale
                w /= scale
                h /= scale
                box = np.array([x, y, w, h], dtype=np.float32)
                dets.append(Det(frame=sample_i, t=t, box=box, score=score))
        tracklets, _ = associate_frame(tracklets, dets)
        sample_i += 1
        fi += 1
    cuts = histogram_shot_cuts(gray_samples)
    if cuts != [0]:
        # reset tracklets at cuts after first
        merged: list[Tracklet] = []
        for tr in tracklets:
            merged.append(tr)
        tracklets = merged
    return times, frame_by_index, tracklets, gray_samples


def build_diar_matrix(words: list[dict], person_frames: list[list[float]], times: np.ndarray) -> np.ndarray:
    """M[speaker][person] overlap seconds with elevated mouth activity."""
    if not words:
        return np.zeros((0, len(person_frames)))
    spk_ids = sorted({int(w.get("spk", 0)) for w in words if w.get("spk") is not None})
    if not spk_ids:
        spk_ids = [0, 1]
    M = np.zeros((len(spk_ids), len(person_frames)))
    for si, spk in enumerate(spk_ids):
        for pi, mouth_ts in enumerate(person_frames):
            for w in words:
                if int(w.get("spk", 0)) != spk:
                    continue
                mid = (w["s"] + w["e"]) / 2
                j = int(np.argmin(np.abs(times - mid)))
                if mouth_ts[j] if j < len(mouth_ts) else 0 > 0:
                    M[si, pi] += w["e"] - w["s"]
    return M


def run(inp: str, out: str) -> None:
    t0 = time.time()
    HERE_str = str(HERE)
    cap = cv2.VideoCapture(inp)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    det = cv2.FaceDetectorYN.create(os.path.join(HERE_str, "yunet.onnx"), "", (W, H), 0.5, 0.3, 50)
    lm = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=os.path.join(HERE_str, "face_landmarker.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            output_face_blendshapes=True,
            min_face_detection_confidence=0.2,
            min_face_presence_confidence=0.2,
        )
    )
    times_l, frame_by_index, tracklets, _ = detect_loop(cap, det, fps, W, H)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    if not times_l:
        raise RuntimeError("no frames sampled")
    times = np.array(times_l)
    n = len(times)
    try:
        rec = load_sface(HERE_str)
    except FileNotFoundError:
        rec = None
    embeddings = []
    if rec is not None:
        embeddings = [embed_tracklet(rec, frame_by_index, tr) for tr in tracklets]
    else:
        embeddings = [None] * len(tracklets)
    person_groups = cluster_tracklets(tracklets, embeddings, n)
    n_persons = len(person_groups)
    if n_persons <= 1:
        raise SinglePersonFallback("single person — legacy crop")

    mouth = np.zeros((n_persons, n))
    xpos = np.zeros((n_persons, n))
    ypos = np.zeros((n_persons, n))
    for pi, group in enumerate(person_groups):
        for si, t in enumerate(times):
            frame_idx = si
            dets = []
            for tr in group:
                for d in tr.dets:
                    if d.frame == frame_idx:
                        dets.append(d)
                        break
            if not dets:
                mouth[pi, si] = np.nan
                continue
            d = max(dets, key=lambda x: x.score)
            cx, cy = d.cx, float(d.box[1] + d.box[3] / 2)
            xpos[pi, si] = cx
            ypos[pi, si] = cy
            x0, y0 = int(max(0, cx - d.box[2])), int(max(0, cy - d.box[3]))
            fr = frame_by_index.get(frame_idx)
            if fr is None:
                continue
            s = max(d.box[2], d.box[3]) * 1.8
            crop = np.ascontiguousarray(
                fr[int(y0) : int(y0 + s), int(x0) : int(x0 + s)]
            )
            if crop.size == 0:
                continue
            res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))
            if res.face_landmarks:
                pts = res.face_landmarks[0]
                ys = [p.y for p in pts]
                sz = max(ys) - min(ys)
                jaw = next(b.score for b in res.face_blendshapes[0] if b.category_name == "jawOpen")
                mouth[pi, si] = abs(pts[13].y - pts[14].y) / max(sz, 1e-6) + 0.3 * jaw

    vis = np.nan_to_num(mouth)
    med = np.nanmedian(vis)
    speak_vis = (vis > med).astype(np.float64)

    words_path = os.environ.get("WORDS_JSON") or os.environ.get("WORDS", "")
    words: list[dict] = []
    if words_path and os.path.isfile(words_path):
        words = json.load(open(words_path))
    M = build_diar_matrix(words, [speak_vis[p].tolist() for p in range(n_persons)], times)
    mapping = hungarian_map_speakers(M)
    diar_prob = np.zeros_like(speak_vis)
    for si, pi in mapping.items():
        for w in words:
            if int(w.get("spk", 0)) != si:
                continue
            j = int(np.clip(np.searchsorted(times, (w["s"] + w["e"]) / 2), 0, n - 1))
            diar_prob[pi, j] = max(diar_prob[pi, j], 1.0)
    speak = combine_speaking_probs(diar_prob, speak_vis)

    style = os.environ.get("LAYOUT_STYLE") or os.environ.get("LAYOUT_MODE", "dynamic")
    segments = run_director(times, speak, speak_vis, SAMPLE_FPS, style, words)

    cw = int(round(H * 9 / 16)) // 2 * 2
    dt = 1.0 / SAMPLE_FPS
    states = [FollowState(x=float(np.nanmean(xpos[p]))) for p in range(n_persons)]
    segment_tracks: list[dict] = []
    for seg in segments:
        slots_out = []
        lay = seg["layout"]
        person_ids = seg.get("slots") or []
        for pid in person_ids:
            pi = int(pid.replace("P", "")) - 1
            if pi < 0 or pi >= n_persons:
                continue
            track_pts = []
            st = FollowState(x=float(np.nanmean(xpos[pi])))
            for si, t in enumerate(times):
                if t < seg["t0"] or t > seg["t1"]:
                    continue
                tgt = float(xpos[pi, si]) if not np.isnan(xpos[pi, si]) else st.x
                if style_config(style).locked_off:
                    cx = float(np.nanmedian(xpos[pi]))
                else:
                    cx = follow(tgt, dt, st, cw)
                cy = float(ypos[pi, si]) if not np.isnan(ypos[pi, si]) else H / 2
                track_pts.append([round(t, 3), round(cx, 2), round(cy, 2)])
            slots_out.append(
                {
                    "personId": pid,
                    "cx": track_pts[0][1] if track_pts else W / 2,
                    "cy": track_pts[0][2] if track_pts else H / 2,
                    "scale": 1.0,
                    "track": track_pts,
                }
            )
        segment_tracks.append({**seg, "slots": slots_out})

    t0_ms = int(float(os.environ.get("CLIP_START_MS", "0")))
    persons = [{"id": person_id_label(i), "label": person_id_label(i)} for i in range(n_persons)]
    crop = {
        "version": 2,
        "W": W,
        "H": H,
        "fps": fps,
        "t0_ms": t0_ms,
        "out_w": int(os.environ.get("OUT_W", "1080")),
        "out_h": int(os.environ.get("OUT_H", "1920")),
        "persons": persons,
        "segments": segment_tracks,
        "divider_px": 4,
        "caption_seam_y": 960,
        # legacy v1 fields for single-slot close segments
        "v": 1,
        "cw": cw,
        "x0": [],
        "shots": [
            {
                "start_ms": t0_ms + int(seg["t0"] * 1000),
                "end_ms": t0_ms + int(seg["t1"] * 1000),
                "spk": "split" if seg["layout"] == "two_up" else "A",
                "layout": seg["layout"],
            }
            for seg in segment_tracks
        ],
    }
    crop_out = os.environ.get("CROP_TRACK_OUT", os.path.splitext(out)[0] + ".crop_track.json")
    json.dump(crop, open(crop_out, "w"), separators=(",", ":"))
    if int(os.environ.get("NORENDER", "0")):
        return
    import sys

    worker_root = HERE.parent.parent
    if str(worker_root) not in sys.path:
        sys.path.insert(0, str(worker_root))
    from clips_worker.multiperson_render import render_multiperson_v2

    render_multiperson_v2(Path(inp), Path(out), crop)
    print(f"multiperson done in {time.time() - t0:.1f}s persons={n_persons}")


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2])
