"""Ken Burns style zoom on rendered clip (output timeline)."""
from __future__ import annotations

import subprocess
from pathlib import Path

ZOOM_PUNCH_RISE_S = 0.25
ZOOM_PUNCH_HOLD_S = 1.0
ZOOM_PUNCH_RELEASE_S = 0.4
ZOOM_MIN_GAP_S = 4.0
ZOOM_MAX_INTENSITY = 1.15
ZOOM_DEFAULT_INTENSITY = 1.12
ZOOM_PUNCH_DURATION_S = ZOOM_PUNCH_RISE_S
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
    out: list[tuple[float, float]] = [(0.0, 1.0)]
    for t in peaks:
        t_rise = min(duration_s, t + ZOOM_PUNCH_RISE_S)
        t_hold = min(duration_s, t_rise + ZOOM_PUNCH_HOLD_S)
        t_end = min(duration_s, t_hold + ZOOM_PUNCH_RELEASE_S)
        out.append((max(0.0, t), 1.0))
        out.append((t_rise, peak_z))
        out.append((t_hold, peak_z))
        out.append((t_end, 1.0))
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
    """Piecewise-linear zoom factor over output time ``t`` (1 before the first / after the last key).

    FV4a: a BALANCED ``if(lt(t,..))`` tree (depth log2 n). The old linear ``if(between(..),..,if(..))``
    chain added one nesting level per segment, so a full-length video with more than ~25 emphasis
    punches went past ffmpeg's ~100-level expression limit and the zoom pass died with EINVAL
    ("Invalid argument") — after the whole render had already run (12-min export, 31 Oct).
    """
    if not keyframes:
        return "1"
    if all(z == 1.0 for _, z in keyframes):
        return "1"
    from clips_worker.ffexpr import balanced_piecewise

    pieces: list[str] = ["1"]
    thresholds: list[str] = []
    for i in range(len(keyframes) - 1):
        t0, z0 = keyframes[i]
        t1, z1 = keyframes[i + 1]
        if abs(t1 - t0) < 1e-6:
            continue
        if abs(z0 - z1) < 1e-6:
            seg = f"{z0:.6f}"
        else:
            slope = (z1 - z0) / (t1 - t0)
            seg = f"({z0:.6f}+{slope:.6f}*(t-{t0:.4f}))"
        if not thresholds:
            thresholds.append(f"{t0:.4f}")
        elif thresholds[-1] != f"{t0:.4f}":
            # gap between segments (not produced by build_zoom_keyframes) → 1 there, as before
            pieces.append("1")
            thresholds.append(f"{t0:.4f}")
        pieces.append(seg)
        thresholds.append(f"{t1:.4f}")
    if not thresholds:
        return "1"
    pieces.append("1")  # after the last key (build_zoom_keyframes always ends at zoom 1.0)
    return balanced_piecewise("t", thresholds, pieces)


def _centre_offset_expr(z_expr: str, size: int) -> str:
    """E6: crop offset that keeps the zoom centred.

    ``scale ... eval=frame`` changes the frame size per frame, but crop's ``iw``/``ih`` are fixed when the
    filter is configured (at zoom 1.0), so ``(iw-w)/2`` stayed 0 and every punch zoomed toward the
    top-left corner (measured: centre 360,640 -> 413,736 at 1.15x). Recompute the scaled size from ``t``
    with the same expression the scale filter uses, so the offset is exact per frame.
    """
    return f"(trunc({size}*({z_expr})/2)*2-{size})/2"


def apply_zoom(
    video: Path,
    out: Path,
    keyframes: list[tuple[float, float]],
    duration_s: float,
    w: int,
    h: int,
    *,
    facecam_only: bool = False,
    facecam_band_h: int | None = None,
) -> None:
    from clips_worker.edits_render import probe_video_size

    w, h = probe_video_size(video)
    w = max(2, w - (w % 2))
    h = max(2, h - (h % 2))
    if not keyframes or all(z == 1.0 for _, z in keyframes):
        subprocess.check_call(["cp", str(video), str(out)])
        return
    z_expr = _scale_factor_expr(keyframes)
    if z_expr == "1":
        subprocess.check_call(["cp", str(video), str(out)])
        return
    if facecam_only:
        band_h = max(2, min(h - 2, facecam_band_h or int(h * 0.35)))
        band_h = band_h - (band_h % 2)
        rest_h = max(2, h - band_h)
        rest_h = rest_h - (rest_h % 2)
        vf = (
            f"split[full][full2];"
            f"[full]crop={w}:{band_h}:0:0,"
            f"scale=w='trunc(iw*({z_expr})/2)*2':h='trunc(ih*({z_expr})/2)*2':eval=frame,"
            f"crop=w={w}:h={band_h}:x='{_centre_offset_expr(z_expr, w)}':y='{_centre_offset_expr(z_expr, band_h)}'"
            f":exact=1[topz];"
            f"[full2]crop={w}:{rest_h}:0:{band_h}[bot];"
            f"[topz][bot]vstack=inputs=2"
        )
    else:
        vf = (
            f"scale=w='trunc(iw*({z_expr})/2)*2':h='trunc(ih*({z_expr})/2)*2':eval=frame,"
            f"crop=w={w}:h={h}:x='{_centre_offset_expr(z_expr, w)}':y='{_centre_offset_expr(z_expr, h)}':exact=1"
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
            # FV4a: same encode as the other export passes (was libx264 defaults: preset medium,
            # ~2-3x slower on a full-length 1080p video).
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "copy",
            str(out),
        ],
    )
