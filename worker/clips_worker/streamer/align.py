"""Cross-correlate segment audio with VOD audio to fix yt-dlp section drift."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import numpy as np


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
) -> tuple[int, float]:
    """Return (true_start_ms, peak_correlation)."""
    win_lo = max(0.0, nominal_start_s - pad_s)
    win_hi = nominal_end_s + pad_s
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        ref_pcm = td_path / "ref.pcm"
        seg_pcm = td_path / "seg.pcm"
        _extract_pcm(audio_opus, win_lo, win_hi, ref_pcm)
        _extract_pcm(segment_path, 0.0, max(0.1, nominal_end_s - nominal_start_s + 1), seg_pcm)
        ref = _read_pcm(ref_pcm)
        seg = _read_pcm(seg_pcm)
        if len(ref) < 100 or len(seg) < 100:
            return int(nominal_start_s * 1000), 0.0
        n = len(ref) + len(seg)
        corr = np.correlate(ref, seg, mode="full")
        lag = int(np.argmax(corr) - (len(seg) - 1))
        peak = float(corr.max() / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9))
        lag_ms = int(round(lag / 16.0))  # 16kHz samples → ms
        true_start_ms = int(round(nominal_start_s * 1000)) + lag_ms
        if peak < 0.6:
            return int(nominal_start_s * 1000), peak
        return max(0, true_start_ms), peak
