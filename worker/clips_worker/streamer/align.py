"""Cross-correlate segment audio with VOD audio to fix yt-dlp section drift."""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

CORR_WINDOW_S = 5.0
DRIFT_LOG_THRESHOLD_MS = 200


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
    arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    return arr / 32768.0


def align_segment_ms(
    segment_path: Path,
    audio_opus: Path,
    nominal_start_s: float,
    nominal_end_s: float,
    pad_s: float = 15.0,
    *,
    log_context: dict | None = None,
) -> tuple[int, float]:
    """Return (true_start_ms, peak_correlation). Uses ~5s audio fingerprint at segment start."""
    nominal_start_ms = int(round(nominal_start_s * 1000))
    win_lo = max(0.0, nominal_start_s - pad_s)
    win_hi = min(nominal_end_s + pad_s, nominal_start_s + pad_s + CORR_WINDOW_S + 2.0)
    seg_dur = max(CORR_WINDOW_S, min(CORR_WINDOW_S + 1.0, nominal_end_s - nominal_start_s + 0.5))
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        ref_pcm = td_path / "ref.pcm"
        seg_pcm = td_path / "seg.pcm"
        _extract_pcm(audio_opus, win_lo, win_hi, ref_pcm)
        _extract_pcm(segment_path, 0.0, seg_dur, seg_pcm)
        ref = _read_pcm(ref_pcm)
        seg = _read_pcm(seg_pcm)
        if len(ref) < 100 or len(seg) < 100:
            return nominal_start_ms, 0.0
        corr = np.correlate(ref, seg, mode="full")
        lag = int(np.argmax(corr) - (len(seg) - 1))
        peak = float(corr.max() / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9))
        lag_ms = int(round(lag / 16.0))  # 16kHz samples → ms
        true_start_ms = nominal_start_ms + lag_ms
        if peak < 0.6:
            return nominal_start_ms, peak
        true_start_ms = max(0, true_start_ms)
        drift_ms = true_start_ms - nominal_start_ms
        if log_context and abs(drift_ms) > DRIFT_LOG_THRESHOLD_MS:
            print(
                "[clipper:stream] segment_align_drift "
                f"vodId={log_context.get('vodId')} clipId={log_context.get('clipId')} "
                f"nominalStartMs={nominal_start_ms} trueStartMs={true_start_ms} "
                f"driftMs={drift_ms} peak={peak:.3f}",
                file=sys.stderr,
                flush=True,
            )
        return true_start_ms, peak
