"""Subject-follow reframe for ClipAnything when face+speech path is weak."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np

EASE = 0.2
MOTION_FPS = 2.0
SAMPLE_STEP_S = 0.5


def _video_meta(video: Path) -> tuple[int, int, float, int]:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,nb_frames",
            "-of",
            "json",
            str(video),
        ],
        text=True,
    )
    data = json.loads(out)["streams"][0]
    w, h = int(data["width"]), int(data["height"])
    fps_s = str(data.get("r_frame_rate", "30/1"))
    if "/" in fps_s:
        a, b = fps_s.split("/")
        fps = float(a) / max(1.0, float(b))
    else:
        fps = float(fps_s)
    nframes = int(data.get("nb_frames") or 0)
    if nframes <= 0:
        dur = float(subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
            text=True,
        ).strip())
        nframes = max(1, int(dur * fps))
    return w, h, fps, nframes


def motion_centroids_x(video: Path, work: Path) -> list[tuple[float, float]]:
    """Return (time_s, centroid_x_px) every ~0.5s from 2fps gray diffs."""
    work.mkdir(parents=True, exist_ok=True)
    raw = work / "motion_gray.raw"
    w, h, fps, _ = _video_meta(video)
    scale_w = 160
    scale_h = 90
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-vf",
            f"fps={MOTION_FPS},scale={scale_w}:{scale_h},format=gray",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "gray",
            str(raw),
        ],
    )
    frame_bytes = scale_w * scale_h
    data = raw.read_bytes()
    n = len(data) // frame_bytes
    if n < 2:
        return [(0.0, w / 2)]
    frames = np.frombuffer(data[: n * frame_bytes], dtype=np.uint8).reshape(n, frame_bytes)
    out: list[tuple[float, float]] = []
    sx = scale_w / max(w, 1)
    for i in range(1, n):
        diff = np.abs(frames[i].astype(np.int16) - frames[i - 1].astype(np.int16))
        thresh = diff > 12
        if not thresh.any():
            cx = w / 2
        else:
            idx = np.where(thresh)[0]
            ys, xs = np.divmod(idx, scale_w)
            cx = float(np.mean(xs)) / sx
        t = i / MOTION_FPS
        if not out or t - out[-1][0] >= SAMPLE_STEP_S - 0.01:
            out.append((t, cx))
    if not out:
        out.append((0.0, w / 2))
    return out


def _subject_box_center_px(subject_box: dict[str, Any] | None, w: int) -> float | None:
    if not subject_box:
        return None
    x = float(subject_box.get("x", 0.5))
    bw = float(subject_box.get("w", 0.2))
    return (x + bw / 2) * w


def blend_targets(
    motion: list[tuple[float, float]],
    subject_box: dict[str, Any] | None,
    w: int,
) -> list[tuple[float, float]]:
    box_c = _subject_box_center_px(subject_box, w)
    if box_c is None:
        return motion
    blended: list[tuple[float, float]] = []
    for t, mx in motion:
        blended.append((t, 0.5 * mx + 0.5 * box_c))
    return blended


def centroid_unstable(targets: list[tuple[float, float]], w: int) -> bool:
    xs = np.array([x for _, x in targets], dtype=np.float64)
    if xs.size < 2:
        return False
    return float(np.std(xs)) > 0.25 * w


def build_crop_track(
    video: Path,
    targets: list[tuple[float, float]],
    clip_start_ms: int,
    *,
    wide: bool = False,
) -> dict[str, Any]:
    w, h, fps, nframes = _video_meta(video)
    cw = int(round(h * 9 / 16)) // 2 * 2
    t0_ms = int(clip_start_ms)
    times = np.array([t for t, _ in targets], dtype=np.float64)
    xs = np.array([x for _, x in targets], dtype=np.float64)
    if wide:
        x0s = [-1] * nframes
    else:
        c = float(xs[0]) if xs.size else w / 2
        x0s = []
        for fi in range(nframes):
            t = fi / fps
            tgt = float(np.interp(t, times, xs)) if times.size else w / 2
            c += EASE * (tgt - c)
            x0s.append(int(np.clip(c - cw / 2, 0, max(0, w - cw))))
    duration_ms = int(round(nframes / fps * 1000))
    shots = [{"start_ms": t0_ms, "end_ms": t0_ms + duration_ms, "spk": "A"}]
    x0_a = list(x0s)
    return {
        "v": 1,
        "W": w,
        "H": h,
        "cw": cw,
        "fps": fps,
        "t0_ms": t0_ms,
        "x0": x0s,
        "x0_A": x0_a,
        "x0_B": x0_a,
        "shots": shots,
    }


def has_face_and_speech(video: Path, words: list[dict], min_words: int = 8) -> bool:
    if len([w for w in words if str(w.get("w", "")).strip()]) < min_words:
        return False
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        return False
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    v3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))
    yunet = cv2.FaceDetectorYN_create(
        str(v3 / "yunet.onnx"),
        "",
        (w, h),
        0.5,
        0.3,
        50,
    )
    hits = 0
    frames = 0
    while frames < 45:
        ok, fr = cap.read()
        if not ok:
            break
        frames += 1
        if frames % 5 != 0:
            continue
        _, faces = yunet.detect(fr)
        if faces is not None and len(faces):
            hits += 1
    cap.release()
    return hits >= 3


def write_motion_crop_track(
    video: Path,
    crop_out: Path,
    ai_meta: dict[str, Any],
    clip_start_ms: int,
    work: Path,
) -> bool:
    """Write crop_track.json; return True if wide (fit-blur) mode."""
    w, _, _, _ = _video_meta(video)
    motion = motion_centroids_x(video, work)
    targets = blend_targets(motion, ai_meta.get("subjectBox"), w)
    wide = centroid_unstable(targets, w)
    track = build_crop_track(video, targets, clip_start_ms, wide=wide)
    crop_out.write_text(json.dumps(track, separators=(",", ":")))
    return wide
