"""G4c stabilize (mirror of new-app/lib/clips/editor/stabilize.ts).

``edits.stabilize`` = [{fromMs, toMs, amount}] in SOURCE ms (like segmentSpeeds), applied to
full_render.mp4 (t = (src − clip_start)/1000) before color, so every later pass (color, cut,
motion, B-roll, captions) sees the steadied picture. The worker's ffmpeg decides the method at
runtime: vidstab two-pass (vidstabdetect → vidstabtransform, auto zoom) when the build has
libvidstab (Debian bookworm's ffmpeg 5.1 does), else the built-in single-pass ``deshake`` with
a small crop-zoom that hides its mirrored edges. Each amount group is stabilized over its own
window (±1 s context) and overlaid on the original only inside its ranges; audio is untouched.
Any failure keeps the original render (export never fails on stabilize).
"""
from __future__ import annotations

import math
import os
import subprocess
from functools import lru_cache
from pathlib import Path

STAB_MAX_RANGES = 50
STAB_DEFAULT = 50
CONTEXT_MS = 1000


def clamp_amount(v) -> int:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return STAB_DEFAULT
    if not math.isfinite(n):
        return STAB_DEFAULT
    return int(max(1, min(100, math.floor(n + 0.5))))


def normalize_stabilize(raw) -> list[dict]:
    """Sorted, non-overlapping [{fromMs, toMs, amount}] (later ranges are clipped to start after
    the previous one ends), at most STAB_MAX_RANGES."""
    if not isinstance(raw, list):
        return []
    rows = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        try:
            a = round(float(r.get("fromMs")))
            b = round(float(r.get("toMs")))
        except (TypeError, ValueError):
            continue
        a = max(0, a)
        if b - a < 100:
            continue
        rows.append({"fromMs": a, "toMs": b, "amount": clamp_amount(r.get("amount", STAB_DEFAULT))})
    rows.sort(key=lambda x: (x["fromMs"], x["toMs"]))
    out: list[dict] = []
    for r in rows:
        if out and r["fromMs"] < out[-1]["toMs"]:
            r = {**r, "fromMs": out[-1]["toMs"]}
            if r["toMs"] - r["fromMs"] < 100:
                continue
        out.append(r)
    return out[:STAB_MAX_RANGES]


@lru_cache(maxsize=1)
def ffmpeg_filters() -> frozenset[str]:
    """Names of the filters compiled into the worker's ffmpeg (``ffmpeg -filters``), cached."""
    try:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True, timeout=30)
    except Exception:  # pragma: no cover - no ffmpeg
        return frozenset()
    names = set()
    for line in r.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 3 and "->" in parts[2]:
            names.add(parts[1])
    return frozenset(names)


def stabilize_method() -> str | None:
    """'vidstab' | 'deshake' | None. CLIPS_STABILIZE_METHOD=deshake forces the fallback."""
    f = ffmpeg_filters()
    forced = os.environ.get("CLIPS_STABILIZE_METHOD", "").strip().lower()
    has_vs = "vidstabdetect" in f and "vidstabtransform" in f
    if forced == "deshake" and "deshake" in f:
        return "deshake"
    if has_vs:
        return "vidstab"
    return "deshake" if "deshake" in f else None


def vidstab_params(amount: int) -> tuple[int, int]:
    """(shakiness 1..10, smoothing frames) for amount 1..100."""
    a = clamp_amount(amount)
    return max(1, min(10, round(3 + a * 0.07))), round(5 + a * 0.4)


def deshake_radius(amount: int) -> int:
    """deshake rx = ry search radius in px — ffmpeg needs a multiple of 16 in 16..64."""
    return 16 * max(1, min(4, math.ceil(clamp_amount(amount) / 25)))


def ranges_in_render(edits: dict, clip_start_ms: int, clip_end_ms: int) -> list[dict]:
    out = []
    for r in normalize_stabilize(edits.get("stabilize")):
        a, b = max(r["fromMs"], clip_start_ms), min(r["toMs"], clip_end_ms)
        if b - a >= 100:
            out.append({"a": (a - clip_start_ms) / 1000, "b": (b - clip_start_ms) / 1000, "amount": r["amount"]})
    return out


def _probe(path: Path) -> tuple[int, int, float]:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
         "-of", "default=nw=1", str(path)], capture_output=True, text=True, check=True)
    kv = dict(line.split("=", 1) for line in r.stdout.splitlines() if "=" in line)
    return int(kv.get("width", 0)), int(kv.get("height", 0)), float(kv.get("duration", 0) or 0)


def stabilize_window(src: Path, out: Path, w0: float, w1: float, amount: int, method: str, w: int, h: int,
                     work_dir: Path, tag: str) -> None:
    """Stabilize src[w0, w1] (seconds) into out (video only, timestamps from 0)."""
    seek = ["-ss", f"{w0:.3f}", "-to", f"{w1:.3f}", "-i", str(src)]
    enc = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p"]
    if method == "vidstab":
        shk, smooth = vidstab_params(amount)
        trf = f"stab_{tag}.trf"  # relative to cwd=work_dir: no path escaping inside the filter args
        subprocess.run(["ffmpeg", "-y", "-v", "error", *seek, "-vf",
                        f"vidstabdetect=shakiness={shk}:accuracy=15:result={trf}", "-f", "null", "-"],
                       check=True, cwd=str(work_dir))
        vf = (f"vidstabtransform=input={trf}:smoothing={smooth}:optzoom=1:interpol=bicubic,"
              f"unsharp=5:5:0.6:3:3:0.3,scale={w}:{h},setsar=1")
        subprocess.run(["ffmpeg", "-y", "-v", "error", *seek, "-vf", vf, *enc, str(out)], check=True, cwd=str(work_dir))
        return
    r = deshake_radius(amount)
    # crop-zoom hides the mirrored edges: ≤ the search radius and ≤ 5 % per side
    mx, my = min(r, round(0.05 * w)), min(r, round(0.05 * h))
    cw, ch = (w - 2 * mx) // 2 * 2, (h - 2 * my) // 2 * 2
    vf = f"deshake=rx={r}:ry={r}:edge=mirror,crop={cw}:{ch},scale={w}:{h},setsar=1"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *seek, "-vf", vf, *enc, str(out)], check=True, cwd=str(work_dir))


def stabilize_graph(groups: list[tuple[float, list[tuple[float, float]]]]) -> tuple[str, str]:
    """Overlay graph: input i+1 = stabilized window of group i starting at its w0 (seconds)."""
    parts = []
    cur = "0:v"
    for i, (w0, spans) in enumerate(groups):
        en = "+".join(f"between(t,{a:.4f},{b:.4f})" for a, b in spans)
        parts.append(f"[{i + 1}:v]setpts=PTS-STARTPTS+{w0:.4f}/TB[st{i}]")
        parts.append(f"[{cur}][st{i}]overlay=0:0:eof_action=pass:enable='{en}'[sv{i}]")
        cur = f"sv{i}"
    return ";".join(parts), cur


def apply_full_render_stabilize(full_render: Path, edits: dict, clip_start_ms: int, clip_end_ms: int,
                                work_dir: Path) -> Path:
    """Stabilized full_render (new file) or the input unchanged."""
    ranges = ranges_in_render(edits, clip_start_ms, clip_end_ms)
    if not ranges:
        return full_render
    method = stabilize_method()
    if method is None:
        print("[g4c:stabilize] skipped method=none (ffmpeg has neither vidstab nor deshake)", flush=True)
        return full_render
    wd = Path(work_dir)
    try:
        w, h, dur = _probe(full_render)
        by_amount: dict[int, list[tuple[float, float]]] = {}
        for r in ranges:
            by_amount.setdefault(r["amount"], []).append((r["a"], min(r["b"], dur or r["b"])))
        inputs: list[Path] = []
        groups: list[tuple[float, list[tuple[float, float]]]] = []
        for i, (amount, spans) in enumerate(sorted(by_amount.items())):
            w0 = max(0.0, min(a for a, _ in spans) - CONTEXT_MS / 1000)
            w1 = max(b for _, b in spans) + CONTEXT_MS / 1000
            if dur:
                w1 = min(dur, w1)
            seg = wd / f"stab_{i}.mp4"
            stabilize_window(full_render, seg, w0, w1, amount, method, w, h, wd, str(i))
            inputs.append(seg)
            groups.append((w0, spans))
        graph, label = stabilize_graph(groups)
        out = wd / "full_render_stab.mp4"
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(full_render)]
        for p in inputs:
            cmd += ["-i", str(p)]
        cmd += ["-filter_complex", f"{graph};[{label}]format=yuv420p[sv]", "-map", "[sv]", "-map", "0:a?",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy", str(out)]
        subprocess.run(cmd, check=True)
        print(f"[g4c:stabilize] method={method} ranges={len(ranges)} groups={len(groups)}", flush=True)
        return out
    except Exception as exc:
        print(f"[g4c:stabilize] failed method={method} err={type(exc).__name__}: {exc} → original kept", flush=True)
        return full_render
