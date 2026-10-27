"""Ken Burns style zoom on rendered clip (output timeline)."""
from __future__ import annotations

import subprocess
from pathlib import Path

ZOOM_PUNCH_DURATION_S = 0.4
ZOOM_MIN_GAP_S = 6.0
ZOOM_MAX_INTENSITY = 1.12
ZOOM_DEFAULT_INTENSITY = 1.08
ZOOM_LAYOUT_SWITCH_GUARD_S = 0.35


def clamp_zoom_intensity(intensity: float | None) -> float:
    try:
        n = float(intensity)
    except (TypeError, ValueError):
        return ZOOM_DEFAULT_INTENSITY
    return min(ZOOM_MAX_INTENSITY, max(1.0, n))


def layout_switch_times_from_words(words: list[dict]) -> list[float]:
    times: list[float] = []
    for i in range(1, len(words)):
        a = words[i - 1].get("spk")
        b = words[i].get("spk")
        if a is not None and b is not None and a != b:
            times.append(float(words[i]["s"]))
    return times


def _near_layout_switch(t: float, switches: list[float], guard: float) -> bool:
    return any(abs(t - sw) <= guard for sw in switches)


def pick_zoom_peak_times(
    candidate_times: list[float],
    duration_s: float,
    layout_switches: list[float] | None = None,
) -> list[float]:
    switches = layout_switches or []
    sorted_t = sorted(t for t in candidate_times if 0 < t < duration_s)
    kept: list[float] = []
    for t in sorted_t:
        if _near_layout_switch(t, switches, ZOOM_LAYOUT_SWITCH_GUARD_S):
            continue
        if kept and t - kept[-1] < ZOOM_MIN_GAP_S:
            continue
        kept.append(t)
    return kept


def build_zoom_keyframes(
    words: list[dict],
    emphasis: list[int],
    duration_s: float,
    intensity: float,
    layout_switches: list[float] | None = None,
) -> list[tuple[float, float]]:
    peak_z = clamp_zoom_intensity(intensity)
    if duration_s <= 0:
        return [(0.0, 1.0)]
    switches = layout_switches if layout_switches is not None else layout_switch_times_from_words(words)
    candidates: list[float] = []
    for idx in emphasis or []:
        for w in words:
            wi = int(w.get("i", w.get("idx", -1)))
            if wi == idx:
                candidates.append(float(w["s"]))
                break
    peaks = pick_zoom_peak_times(candidates, duration_s, switches)
    half = ZOOM_PUNCH_DURATION_S / 2.0
    out: list[tuple[float, float]] = [(0.0, 1.0)]
    for t in peaks:
        t0 = max(0.0, t - half)
        t1 = min(duration_s, t + half)
        out.append((t0, 1.0))
        out.append(((t0 + t1) / 2.0, peak_z))
        out.append((t1, 1.0))
    out.append((duration_s, 1.0))
    out.sort(key=lambda x: x[0])
    deduped: list[tuple[float, float]] = []
    for t, z in out:
        if deduped and abs(deduped[-1][0] - t) < 0.001:
            deduped[-1] = (t, z)
        else:
            deduped.append((t, z))
    return deduped


def _scale_factor_expr(keyframes: list[tuple[float, float]]) -> str:
    if not keyframes:
        return "1"
    if all(z == 1.0 for _, z in keyframes):
        return "1"
    parts: list[str] = []
    for i in range(len(keyframes) - 1):
        t0, z0 = keyframes[i]
        t1, z1 = keyframes[i + 1]
        if abs(t1 - t0) < 1e-6:
            continue
        if abs(z0 - z1) < 1e-6:
            seg = f"if(between(t,{t0:.4f},{t1:.4f}),{z0:.6f}"
        else:
            slope = (z1 - z0) / (t1 - t0)
            seg = f"if(between(t,{t0:.4f},{t1:.4f}),{z0:.6f}+{slope:.6f}*(t-{t0:.4f})"
        parts.append(seg)
    expr = parts[0] if len(parts) == 1 else ",".join(parts) + ",1" + ")" * len(parts)
    return expr


def apply_zoom(video: Path, out: Path, keyframes: list[tuple[float, float]], duration_s: float, w: int, h: int) -> None:
    if not keyframes or all(z == 1.0 for _, z in keyframes):
        subprocess.check_call(["cp", str(video), str(out)])
        return
    z_expr = _scale_factor_expr(keyframes)
    if z_expr == "1":
        subprocess.check_call(["cp", str(video), str(out)])
        return
    vf = (
        f"scale=w='trunc(iw*({z_expr}))':h='trunc(ih*({z_expr}))':eval=frame,"
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
