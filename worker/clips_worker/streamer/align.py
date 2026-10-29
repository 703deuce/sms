"""Verification-only segment offset (Batch AC): cross-correlate clip vs window audio."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import numpy as np

from clips_worker.decision_log import decision_log


def _extract_pcm(audio: Path, start_s: float, end_s: float, dest: Path) -> None:
    dur = max(0.1, end_s - start_s)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start_s:.3f}",
            "-t",
            f"{dur:.3f}",
            "-i",
            str(audio),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "s16le",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _read_pcm(path: Path) -> np.ndarray:
    raw = path.read_bytes()
    if not raw:
        return np.zeros(1, dtype=np.float32)
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def _norm_corr(ref: np.ndarray, seg: np.ndarray) -> tuple[int, float, float]:
    if len(ref) < 160 or len(seg) < 160:
        return 0, 0.0, 0.0
    n = min(len(ref), len(seg))
    ref = ref[:n]
    seg = seg[:n]
    corr = np.correlate(ref, seg, mode="full")
    lag = int(np.argmax(corr) - (len(seg) - 1))
    peak = float(corr.max() / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9))
    mask = np.ones_like(corr, dtype=bool)
    center = int(np.argmax(corr))
    lo = max(0, center - int(0.5 * 16000))
    hi = min(len(corr), center + int(0.5 * 16000))
    mask[lo:hi] = False
    second = float(corr[mask].max()) if mask.any() else 0.0
    peak_ratio = peak / (second + 1e-9)
    return lag, peak, peak_ratio


def verify_segment_offset(
    seg_path: Path,
    window_audio: Path,
    *,
    expected_rel_s: float,
    clip_media_start_s: float,
    probe_s: float = 8.0,
    search_s: float = 30.0,
) -> tuple[float, float, float]:
    """
    Returns (measured_rel_s, confidence, peak_ratio).
    measured_rel_s is segment time that best matches window audio at clip start.
    """
    ref_lo = max(0.0, clip_media_start_s)
    ref_hi = ref_lo + probe_s
    search_lo = max(0.0, expected_rel_s - search_s)
    search_hi = expected_rel_s + search_s + probe_s
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        ref_pcm = td_path / "ref.pcm"
        seg_pcm = td_path / "seg.pcm"
        _extract_pcm(window_audio, ref_lo, ref_hi, ref_pcm)
        _extract_pcm(seg_path, search_lo, search_hi, seg_pcm)
        ref = _read_pcm(ref_pcm)
        seg = _read_pcm(seg_pcm)
        lag_samples, confidence, peak_ratio = _norm_corr(ref, seg)
        measured_rel_s = search_lo + lag_samples / 16000.0
        return measured_rel_s, confidence, peak_ratio


def apply_segment_align_policy(
    *,
    seg_path: Path,
    window_audio: Path,
    expected_rel_s: float,
    clip_media_start_s: float,
    source_kind: str,
    clip_id: str,
    vod_id: str,
) -> tuple[float, bool]:
    measured, confidence, peak_ratio = verify_segment_offset(
        seg_path,
        window_audio,
        expected_rel_s=expected_rel_s,
        clip_media_start_s=clip_media_start_s,
    )
    drift = measured - expected_rel_s
    applied = False
    use_rel = expected_rel_s
    reason = "ok"
    if abs(drift) <= 0.08:
        reason = "within_tolerance"
    elif confidence >= 0.6 and peak_ratio >= 1.5:
        use_rel = measured
        applied = True
        reason = "corrected"
    else:
        reason = "low_confidence"
    decision_log(
        "streamer",
        "segment_align",
        vodId=vod_id,
        clipId=clip_id,
        source_kind=source_kind,
        expected_start_s=round(expected_rel_s, 4),
        measured_offset_s=round(measured, 4),
        drift_ms=int(round(drift * 1000)),
        confidence=round(confidence, 4),
        peak_ratio=round(peak_ratio, 4),
        applied=applied,
        reason=reason,
    )
    return use_rel, applied


def align_segment_ms(*args, **kwargs):
    """Legacy shim: returns nominal ms in window coords + peak 1.0."""
    nominal_start_s = kwargs.get("nominal_start_s")
    if nominal_start_s is None and len(args) >= 3:
        nominal_start_s = args[2]
    ms = int(round(float(nominal_start_s or 0) * 1000))
    return ms, 1.0
