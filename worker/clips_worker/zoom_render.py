"""Ken Burns style zoom on rendered clip (output timeline)."""
from __future__ import annotations

import subprocess
from pathlib import Path


def _build_zoom_expr(keyframes: list[tuple[float, float]], duration_s: float) -> str:
    if not keyframes:
        return "1"
    parts: list[str] = []
    for t, z in keyframes:
        parts.append(f"if(between(t,{t:.3f},{duration_s:.3f}),{z:.4f}")
    inner = parts[0] if len(parts) == 1 else ",".join(parts) + ",1" + ")" * len(parts)
    return inner


def build_zoom_keyframes(words: list[dict], emphasis: list[int], duration_s: float, intensity: float) -> list[tuple[float, float]]:
    peaks: set[float] = set()
    for idx in emphasis or []:
        for w in words:
            wi = int(w.get("i", w.get("idx", -1)))
            if wi == idx:
                peaks.add(float(w["s"]))
    t = 0.0
    while t < duration_s:
        peaks.add(t)
        t += 7.0
    out: list[tuple[float, float]] = [(0.0, 1.0)]
    for t in sorted(peaks):
        if t <= 0 or t >= duration_s:
            continue
        out.append((max(0.0, t - 0.15), 1.0))
        out.append((t, intensity))
        out.append((min(duration_s, t + 0.4), intensity))
        out.append((min(duration_s, t + 0.55), 1.0))
    out.append((duration_s, 1.0))
    return out


def apply_zoom(video: Path, out: Path, keyframes: list[tuple[float, float]], duration_s: float, w: int, h: int) -> None:
    if not keyframes or all(z == 1.0 for _, z in keyframes):
        subprocess.check_call(["cp", str(video), str(out)])
        return
    # Piecewise zoom via zoompan (simplified: constant mild zoom when any peak exists)
    z = max(z for _, z in keyframes)
    if z <= 1.01:
        subprocess.check_call(["cp", str(video), str(out)])
        return
    vf = (
        f"scale={int(w * z)}:{int(h * z)},"
        f"crop={w}:{h}:(iw-{w})/2:(ih-{h})/2"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-vf",
            vf,
            "-c:a",
            "copy",
            str(out),
        ],
    )
