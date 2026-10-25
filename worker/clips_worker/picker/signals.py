"""Step A: per-sentence local signals (no API)."""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass

import numpy as np

from clips_worker.picker.sentences import Sentence


@dataclass
class SentenceSignals:
    sentence_idx: int
    words_per_sec: float
    rms_z: float
    pitch_z: float
    pause_before_ms: int
    pause_after_ms: int
    laugh: bool
    overlap: bool
    question: bool
    has_entity: bool


ENTITY_RE = re.compile(
    r"(\$[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})+\b|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b)"
)
QUESTION_START = re.compile(r"^(who|what|when|where|why|how|is|are|do|does|did|can|could|would|should)\b", re.I)


def load_audio_16k(path: str) -> tuple[np.ndarray, int]:
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0, 16000


def _rms_frames(audio: np.ndarray, sr: int, hop_ms: int = 20) -> tuple[np.ndarray, np.ndarray]:
    hop = int(sr * hop_ms / 1000)
    n = len(audio) // hop
    times = np.arange(n) * hop_ms / 1000.0
    rms = np.array([np.sqrt(np.mean(audio[i * hop : (i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    return times, rms


def _pitch_variance_z(audio: np.ndarray, sr: int, s: float, e: float) -> float:
    seg = audio[int(s * sr) : int(e * sr)]
    if len(seg) < sr * 0.15:
        return 0.0
    try:
        import librosa

        f0, _, _ = librosa.pyin(seg, fmin=80, fmax=400, sr=sr, frame_length=1024)
        voiced = f0[~np.isnan(f0)]
        if len(voiced) < 3:
            return 0.0
        return float(np.std(voiced))
    except Exception:
        hop = sr // 50
        env = np.array([np.mean(seg[i : i + hop] ** 2) for i in range(0, len(seg) - hop, hop)])
        return float(np.std(env)) if len(env) else 0.0


def compute_signals(
    sentences: list[Sentence],
    audio_path: str,
    all_sentences: list[Sentence],
) -> list[SentenceSignals]:
    audio, sr = load_audio_16k(audio_path)
    times, rms = _rms_frames(audio, sr)
    rms_db = 20 * np.log10(rms + 1e-12)

    def sent_rms(s: Sentence) -> float:
        lo, hi = s.start_ms / 1000.0, s.end_ms / 1000.0
        mask = (times >= lo) & (times <= hi)
        return float(np.mean(rms_db[mask])) if mask.any() else float(np.mean(rms_db))

    by_spk: dict[str, list[float]] = {}
    pitch_raw: list[float] = []
    for s in sentences:
        by_spk.setdefault(s.speaker, []).append(sent_rms(s))
        pitch_raw.append(_pitch_variance_z(audio, sr, s.start_ms / 1000.0, s.end_ms / 1000.0))

    spk_rms_mean = {k: float(np.mean(v)) for k, v in by_spk.items()}
    spk_rms_std = {k: float(np.std(v) or 1.0) for k, v in by_spk.items()}
    pitch_mean, pitch_std = float(np.mean(pitch_raw)), float(np.std(pitch_raw) or 1.0)

    # overlap: another speaker's sentence starts within 300ms
    overlap_idx: set[int] = set()
    for i, s in enumerate(sentences):
        for j, o in enumerate(all_sentences):
            if i == j or s.speaker == o.speaker:
                continue
            if abs(s.start_ms - o.start_ms) <= 300:
                overlap_idx.add(i)
                break

    out: list[SentenceSignals] = []
    for i, s in enumerate(sentences):
        dur_s = max(0.05, (s.end_ms - s.start_ms) / 1000.0)
        wc = max(1, len(s.text.split()))
        pause_before = s.start_ms - (sentences[i - 1].end_ms if i > 0 else s.start_ms)
        pause_after = (sentences[i + 1].start_ms if i + 1 < len(sentences) else s.end_ms) - s.end_ms
        rms_val = sent_rms(s)
        rms_z = (rms_val - spk_rms_mean.get(s.speaker, rms_val)) / spk_rms_std.get(s.speaker, 1.0)
        pz = (pitch_raw[i] - pitch_mean) / pitch_std

        laugh = False
        if pause_before > 200:
            gap_lo = (s.start_ms - pause_before) / 1000.0
            gap_hi = s.start_ms / 1000.0
            mask = (times >= gap_lo) & (times <= gap_hi)
            if mask.any() and np.max(rms_db[mask]) > np.percentile(rms_db, 85):
                laugh = True

        text = s.text.strip()
        question = text.endswith("?") or bool(QUESTION_START.match(text))
        entity = bool(ENTITY_RE.search(text))

        out.append(
            SentenceSignals(
                sentence_idx=s.idx,
                words_per_sec=wc / dur_s,
                rms_z=round(rms_z, 2),
                pitch_z=round(pz, 2),
                pause_before_ms=int(max(0, pause_before)),
                pause_after_ms=int(max(0, pause_after)),
                laugh=laugh,
                overlap=i in overlap_idx,
                question=question,
                has_entity=entity,
            )
        )
    return out
