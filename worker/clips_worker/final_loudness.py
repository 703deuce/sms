"""Post-export audio safety: true-peak limiting and measurable EBU R128 contract.

Run *after* speed, inserts, bookends and duration changes. Failure is fatal,
never silently deliver a clip that misses its requested integrated loudness.
"""
from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path


def measure_ebu_r128(video: Path) -> tuple[float, float]:
    """Returns measured integrated LUFS and oversampled true peak in dBTP."""
    run = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-v", "info", "-i", str(video),
         "-filter_complex", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    summary = run.stderr.rsplit("Summary:", 1)[-1]
    integrated = re.search(r"Integrated loudness:\s*I:\s*(-?\d+(?:\.\d+)?)\s*LUFS", summary)
    peak = re.search(r"True peak:\s*Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS", summary)
    if not (integrated and peak):
        raise RuntimeError("EBU R128 verification did not report integrated loudness and true peak")
    measured = (float(integrated.group(1)), float(peak.group(1)))
    if any(not math.isfinite(v) for v in measured):
        raise RuntimeError("EBU R128 verification produced non-finite measurements")
    return measured


def _limit(in_video: Path, out_video: Path, target_lufs: float, *, ceiling_db: float = -1.6) -> None:
    """Oversampled loudnorm TP ceiling plus final lookahead limiter, copy video."""
    from clips_worker.audio_render import apply_program_loudnorm
    intermediate = out_video.with_suffix(".normalized.mp4")
    # Loudnorm works in 192 kHz floating-point with true-peak control.
    apply_program_loudnorm(in_video, intermediate, target_lufs=target_lufs,
                           true_peak_db=ceiling_db)
    # AAC conversion can create intersample overshoots; conservatively cap.
    limit = 10 ** (ceiling_db / 20.0)
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(intermediate),
        "-af", f"alimiter=limit={limit:.8f}:level=0:latency=1",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        str(out_video),
    ], check=True, capture_output=True)


def finalize_audio(video: Path, work_dir: Path, target_lufs: float,
                   render_meta: dict) -> Path:
    """Normalize/limit the *final* assembly and refuse noncompliant deliverables.

    Two attempts at most. The second increases TP headroom for AAC overshoot.
    No video re-encoding is performed by either audio-only pass.
    """
    if not math.isfinite(target_lufs) or not -36 <= target_lufs <= -8:
        raise ValueError("Unsupported loudness target")
    current = video
    for attempt, ceiling in enumerate((-1.6, -2.2), start=1):
        out = work_dir / f"verified_audio_{attempt}.mp4"
        _limit(current, out, target_lufs, ceiling_db=ceiling)
        i, tp = measure_ebu_r128(out)
        render_meta["measured_lufs"] = i
        render_meta["measured_true_peak_dbtp"] = tp
        render_meta["loudness_target_lufs"] = target_lufs
        render_meta["loudness_verify_attempts"] = attempt
        if abs(i - target_lufs) <= 0.5 and tp <= -1.0:
            render_meta["loudnorm_applied"] = True
            return out
        current = out
    raise RuntimeError(
        f"Final audio verification failed: integrated={i:.1f} LUFS, "
        f"true_peak={tp:.1f} dBTP, target={target_lufs:.1f} LUFS. "
        "Render failed; no noncompliant file was delivered."
    )
