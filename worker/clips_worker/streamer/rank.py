"""Shared streamer moment ranking (signals + fusion)."""
from __future__ import annotations

from pathlib import Path

from clips_worker.streamer.fusion import FusionPick, fuse_moments
from clips_worker.streamer.signals import audio_signal_per_second, transcript_signal_per_second


def rank_moments(
    *,
    audio_path: Path,
    words: list[dict],
    duration_ms: int,
    settings: dict,
    chapters: list[dict] | None = None,
    llm_ranker=None,
) -> tuple[list[FusionPick], dict]:
    duration_s = max(1, int(duration_ms / 1000))
    audio_sig = audio_signal_per_second(audio_path, duration_s)
    transcript_sig = transcript_signal_per_second(words, duration_s)
    signals = {
        "audio": audio_sig,
        "transcript": transcript_sig,
        "chat": None,
        "viewerClips": None,
    }
    return fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=words,
        settings=settings,
        chapters=chapters,
        llm_ranker=llm_ranker,
    )
