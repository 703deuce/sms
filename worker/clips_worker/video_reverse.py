"""CV-17b main video reverse (mirror of new-app/lib/clips/editor/video-reverse.ts).

``edits.videoReverse`` = [{startMs, endMs}] in SOURCE ms. Pieces intersect keep segments; export
replaces each piece with a reversed copy on full_render and mutes audio over those spans.
Captions whose word midpoint falls in a piece are dropped from the burn only.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

from clips_worker.clip_keep_segments import ordered_keep_segments
from clips_worker.edits_render import word_mid_ms
from clips_worker.layer_fx import REVERSE_MAX_MS, reversed_media

VIDEO_REVERSE_MAX_RANGES = 50
VIDEO_REVERSE_MIN_MS = 100


def _py_round(x: float) -> int:
    f = math.floor(x)
    d = x - f
    if d > 0.5:
        return f + 1
    if d < 0.5:
        return f
    return f if f % 2 == 0 else f + 1


def normalize_video_reverse(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    rows: list[dict] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        try:
            a = _py_round(float(r.get("startMs")))
            b = _py_round(float(r.get("endMs")))
        except (TypeError, ValueError):
            continue
        a = max(0, a)
        if b - a < VIDEO_REVERSE_MIN_MS:
            continue
        if b - a > REVERSE_MAX_MS:
            continue
        rows.append({"startMs": a, "endMs": b})
    rows.sort(key=lambda x: (x["startMs"], x["endMs"]))
    out: list[dict] = []
    for r in rows:
        if out and r["startMs"] < out[-1]["endMs"]:
            r = {**r, "startMs": out[-1]["endMs"]}
            if r["endMs"] - r["startMs"] < VIDEO_REVERSE_MIN_MS:
                continue
        out.append(r)
    return out[:VIDEO_REVERSE_MAX_RANGES]


def reverse_pieces_ms(edits: dict) -> list[tuple[int, int]]:
    ranges = normalize_video_reverse(edits.get("videoReverse"))
    if not ranges:
        return []
    segs = ordered_keep_segments(edits)
    out: list[tuple[int, int]] = []
    for s0, s1 in segs:
        for r in ranges:
            a = max(int(s0), int(r["startMs"]))
            b = min(int(s1), int(r["endMs"]))
            if b - a >= VIDEO_REVERSE_MIN_MS and b - a <= REVERSE_MAX_MS:
                out.append((a, b))
    out.sort()
    return out


def reverse_pieces_sec(edits: dict, clip_start_ms: int, clip_end_ms: int) -> list[tuple[float, float]]:
    """Pieces as (a, b) seconds on full_render (0 = clip_start_ms)."""
    out: list[tuple[float, float]] = []
    for a, b in reverse_pieces_ms(edits):
        a = max(a, clip_start_ms)
        b = min(b, clip_end_ms)
        if b - a < VIDEO_REVERSE_MIN_MS:
            continue
        out.append(((a - clip_start_ms) / 1000.0, (b - clip_start_ms) / 1000.0))
    return out


def drop_reversed_words(words: list[dict], edits: dict) -> list[dict]:
    pieces = reverse_pieces_ms(edits)
    if not pieces:
        return words
    kept: list[dict] = []
    for w in words:
        mid = word_mid_ms(w)
        if any(a <= mid < b for a, b in pieces):
            continue
        kept.append(w)
    return kept


def _probe_av(path: Path) -> tuple[int, int, float, bool]:
    r = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height:format=duration",
            "-of",
            "default=nw=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    kv = dict(line.split("=", 1) for line in r.stdout.splitlines() if "=" in line)
    w, h = int(kv.get("width", 0)), int(kv.get("height", 0))
    dur = float(kv.get("duration", 0) or 0)
    ar = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
    )
    has_a = ar.returncode == 0 and bool(ar.stdout.strip())
    return w, h, dur, has_a


def apply_full_render_reverse(
    full_render: Path,
    edits: dict,
    clip_start_ms: int,
    clip_end_ms: int,
    work_dir: Path,
    *,
    fps: float = 30.0,
) -> Path:
    pieces = reverse_pieces_sec(edits, clip_start_ms, clip_end_ms)
    if not pieces:
        return full_render
    w, h, dur, has_audio = _probe_av(full_render)
    if dur <= 0.01 or w <= 0:
        return full_render
    wd = work_dir / "reverse"
    wd.mkdir(parents=True, exist_ok=True)
    rev_files: list[Path] = []
    for i, (a, b) in enumerate(pieces):
        rev_files.append(
            reversed_media(full_render, a, b - a, w, h, wd / f"rev_{i}.mp4", fps=int(round(fps)))
        )
    # Build alternating forward / reversed timeline from 0..dur.
    spans: list[tuple[str, float, float, Path | None]] = []
    t = 0.0
    pi = 0
    while t < dur - 1e-6 and pi < len(pieces):
        a, b = pieces[pi]
        if a > t + 1e-6:
            spans.append(("fwd", t, a, None))
        spans.append(("rev", a, b, rev_files[pi]))
        t = b
        pi += 1
    if t < dur - 1e-6:
        spans.append(("fwd", t, dur, None))

    parts: list[str] = []
    labels: list[str] = []
    inp = 0
    rev_in = 1
    for i, (kind, a, b, rev_path) in enumerate(spans):
        lab = f"p{i}"
        labels.append(f"[{lab}]")
        if kind == "fwd":
            parts.append(
                f"[{inp}:v]trim={a:.6f}:{b:.6f},setpts=PTS-STARTPTS,fps={fps:.3f},format=yuv420p,setsar=1[{lab}]"
            )
        else:
            parts.append(f"[{rev_in}:v]setpts=PTS-STARTPTS,fps={fps:.3f},format=yuv420p,setsar=1[{lab}]")
            rev_in += 1
    n = len(labels)
    parts.append("".join(labels) + f"concat=n={n}:v=1:a=0[v]")
    mute_expr = "+".join(f"between(t,{a:.6f},{b:.6f})" for a, b in pieces)
    if has_audio and mute_expr:
        parts.append(f"[{inp}:a]volume=0:enable='{mute_expr}'[a]")
    graph = ";".join(parts)
    out = work_dir / "full_render_rev.mp4"
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(full_render)]
    for p in rev_files:
        cmd += ["-i", str(p)]
    cmd += ["-filter_complex", graph, "-map", "[v]"]
    if has_audio and mute_expr:
        cmd += ["-map", "[a]"]
    else:
        cmd += ["-map", f"{inp}:a?"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-c:a", "aac", str(out)]
    subprocess.check_call(cmd)
    _, _, out_dur, _ = _probe_av(out)
    if abs(out_dur - dur) > 1.0 / max(fps, 1) + 0.05:
        raise RuntimeError(f"reverse duration drift {out_dur} vs {dur}")
    return out
