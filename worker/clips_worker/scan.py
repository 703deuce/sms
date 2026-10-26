"""ClipAnything free local shortlist: scene, loudness, motion, speech."""
from __future__ import annotations

import math
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np

SCENE_RE = re.compile(r"lavfi\.scene_score=([\d.]+).*?pts_time:([\d.]+)")
LOUD_RE = re.compile(r"lavfi\.r128\.M=([-\d.]+)")


@dataclass
class CandidateWindow:
    id: str
    start_s: float
    end_s: float
    peak_s: float
    score: float


def _z(series: np.ndarray) -> np.ndarray:
    if series.size == 0:
        return series
    m = float(np.mean(series))
    s = float(np.std(series))
    if s < 1e-6:
        return np.zeros_like(series, dtype=np.float64)
    return (series - m) / s


def probe_duration_s(video: Path) -> float:
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
    return max(0.1, float(out))


def scene_events(video: Path, work: Path) -> list[tuple[float, float]]:
    work.mkdir(parents=True, exist_ok=True)
    scenes_file = work / "scenes.txt"
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "info",
        "-i",
        str(video),
        "-vf",
        f"scale=320:-2,select='gt(scene,0.3)',metadata=print:file={scenes_file}",
        "-an",
        "-f",
        "null",
        "-",
    ]
    subprocess.run(cmd, capture_output=True, text=True)
    events: list[tuple[float, float]] = []
    if scenes_file.exists():
        for line in scenes_file.read_text().splitlines():
            m = SCENE_RE.search(line.replace(" ", ""))
            if m:
                events.append((float(m.group(2)), float(m.group(1))))
    else:
        blob = subprocess.run(cmd, capture_output=True, text=True).stderr
        for line in blob.splitlines():
            m = SCENE_RE.search(line.replace(" ", ""))
            if m:
                events.append((float(m.group(2)), float(m.group(1))))
    return events


def loudness_momentary(video: Path, work: Path, duration_s: float) -> np.ndarray:
    work.mkdir(parents=True, exist_ok=True)
    loud_file = work / "loud.txt"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-af",
            f"ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file={loud_file}",
            "-vn",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    vals: list[float] = []
    if loud_file.exists():
        for line in loud_file.read_text().splitlines():
            m = LOUD_RE.search(line)
            if m:
                vals.append(float(m.group(1)))
    if not vals:
        return np.zeros(int(math.ceil(duration_s)) + 1, dtype=np.float64)
    arr = np.array(vals, dtype=np.float64)
    sec_len = int(math.ceil(duration_s)) + 1
    if arr.size >= sec_len:
        return arr[:sec_len]
    out = np.zeros(sec_len, dtype=np.float64)
    out[: arr.size] = arr
    return out


def motion_per_second(video: Path, work: Path, duration_s: float) -> np.ndarray:
    work.mkdir(parents=True, exist_ok=True)
    raw = work / "motion.raw"
    fps = 2.0
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-vf",
            f"fps={fps},scale=160:90,format=gray",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "gray",
            str(raw),
        ],
    )
    if not raw.exists() or raw.stat().st_size == 0:
        return np.zeros(int(math.ceil(duration_s)) + 1, dtype=np.float64)
    frame_bytes = 160 * 90
    data = raw.read_bytes()
    n_frames = len(data) // frame_bytes
    if n_frames < 2:
        return np.zeros(int(math.ceil(duration_s)) + 1, dtype=np.float64)
    frames = np.frombuffer(data[: n_frames * frame_bytes], dtype=np.uint8).reshape(n_frames, frame_bytes)
    diffs = np.mean(np.abs(frames[1:].astype(np.int16) - frames[:-1].astype(np.int16)), axis=1)
    sec_len = int(math.ceil(duration_s)) + 1
    per_sec = np.zeros(sec_len, dtype=np.float64)
    for i, d in enumerate(diffs):
        sec = min(sec_len - 1, int((i + 1) / fps))
        per_sec[sec] = max(per_sec[sec], float(d))
    return per_sec


def speech_seconds(words: list[dict], duration_s: float) -> np.ndarray:
    sec_len = int(math.ceil(duration_s)) + 1
    mask = np.zeros(sec_len, dtype=np.float64)
    for w in words:
        s = int(max(0, math.floor(float(w.get("s", 0)))))
        e = int(min(sec_len - 1, math.ceil(float(w.get("e", 0)))))
        mask[s : e + 1] = 1.0
    return mask


def scene_density(scene_events: list[tuple[float, float]], duration_s: float) -> np.ndarray:
    sec_len = int(math.ceil(duration_s)) + 1
    dens = np.zeros(sec_len, dtype=np.float64)
    for t, _sc in scene_events:
        i = int(min(sec_len - 1, max(0, math.floor(t))))
        dens[i] += 1.0
    kernel = np.ones(5, dtype=np.float64)
    if dens.size >= 5:
        dens = np.convolve(dens, kernel, mode="same")
    return dens


def per_second_score(
    motion: np.ndarray,
    loud: np.ndarray,
    scene_d: np.ndarray,
    speech: np.ndarray,
) -> np.ndarray:
    n = max(motion.size, loud.size, scene_d.size, speech.size)
    m = np.pad(motion, (0, n - motion.size))
    l = np.pad(loud, (0, n - loud.size))
    sd = np.pad(scene_d, (0, n - scene_d.size))
    sp = np.pad(speech, (0, n - speech.size))
    loud_peaks = l.copy()
    med = float(np.median(l)) if l.size else 0.0
    loud_peaks[l < med + 6.0] = med
    base = 0.4 * _z(m) + 0.35 * _z(loud_peaks) + 0.25 * _z(sd)
    base += 0.2 * sp
    return base


def _nms_peaks(scores: np.ndarray, min_gap_s: int = 20) -> list[int]:
    order = list(np.argsort(-scores))
    chosen: list[int] = []
    for idx in order:
        if scores[idx] <= 0:
            continue
        if any(abs(idx - c) < min_gap_s for c in chosen):
            continue
        chosen.append(int(idx))
    return chosen


def _scene_cuts(scene_events: list[tuple[float, float]]) -> list[float]:
    return sorted({t for t, _ in scene_events})


def _extend_to_cuts(start_s: float, end_s: float, cuts: list[float], duration_s: float) -> tuple[float, float]:
    lo = max(0.0, start_s)
    hi = min(duration_s, end_s)
    for c in cuts:
        if abs(c - lo) <= 1.5:
            lo = c
        if abs(c - hi) <= 1.5:
            hi = c
    lo = max(0.0, lo)
    hi = min(duration_s, hi)
    if hi - lo < 15:
        hi = min(duration_s, lo + 15)
    if hi - lo > 90:
        hi = lo + 90
    return lo, hi


def shortlist_window_cap(range_start_s: float, range_end_s: float, max_clips: int) -> int:
    duration_s = max(1.0, range_end_s - range_start_s)
    return min(60, max(max_clips * 3, int(math.ceil(0.25 * duration_s / 30.0))))


def build_candidate_windows(
    video: Path,
    words: list[dict],
    work: Path,
    range_start_s: float = 0.0,
    range_end_s: float | None = None,
    *,
    max_clips: int = 10,
) -> list[CandidateWindow]:
    duration_s = probe_duration_s(video)
    if range_end_s is None or range_end_s <= 0:
        range_end_s = duration_s
    range_end_s = min(duration_s, range_end_s)
    range_start_s = max(0.0, min(range_start_s, range_end_s))

    events = scene_events(video, work)
    loud = loudness_momentary(video, work, duration_s)
    motion = motion_per_second(video, work, duration_s)
    speech = speech_seconds(words, duration_s)
    sd = scene_density(events, duration_s)
    scores = per_second_score(motion, loud, sd, speech)

    rs = int(range_start_s)
    re = int(range_end_s)
    local = scores[rs : re + 1]
    cap = max(1, shortlist_window_cap(range_start_s, range_end_s, max_clips))
    peaks = _nms_peaks(local, min_gap_s=20)[: cap * 2]
    cuts = _scene_cuts(events)

    out: list[CandidateWindow] = []
    for i, peak_idx in enumerate(peaks):
        peak_s = rs + peak_idx
        start_s = max(range_start_s, peak_s - 8.0)
        end_s = min(range_end_s, peak_s + 22.0)
        start_s, end_s = _extend_to_cuts(start_s, end_s, cuts, range_end_s)
        if end_s - start_s < 15:
            end_s = min(range_end_s, start_s + 15)
        if end_s - start_s > 90:
            end_s = start_s + 90
        out.append(
            CandidateWindow(
                id=f"c{i}",
                start_s=start_s,
                end_s=end_s,
                peak_s=float(peak_s),
                score=float(local[peak_idx]),
            ),
        )
    out.sort(key=lambda c: -c.score)
    return out[:cap]


def sample_candidate_frames(
    video: Path,
    cand: CandidateWindow,
    out_dir: Path,
    *,
    max_frames: int = 60,
) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    dur = max(0.5, cand.end_s - cand.start_s)
    fps = 1.0
    pattern = out_dir / f"{cand.id}_%04d.jpg"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            str(cand.start_s),
            "-i",
            str(video),
            "-t",
            str(dur),
            "-vf",
            "fps=1,scale=512:-2",
            "-q:v",
            "5",
            str(pattern),
        ],
    )
    frames = sorted(out_dir.glob(f"{cand.id}_*.jpg"))
    if len(frames) > max_frames:
        step = max(1, len(frames) // max_frames)
        frames = frames[::step][:max_frames]
    result: list[dict] = []
    for i, path in enumerate(frames):
        result.append({"index": i, "path": path, "jpeg": path.read_bytes()})
    return result


def iou(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    lo = max(a_start, b_start)
    hi = min(a_end, b_end)
    inter = max(0.0, hi - lo)
    union = max(1e-6, (a_end - a_start) + (b_end - b_start) - inter)
    return inter / union
