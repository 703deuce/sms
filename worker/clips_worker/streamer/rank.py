"""Shared streamer moment ranking (signals + fusion)."""
from __future__ import annotations

from pathlib import Path

from clips_worker.streamer.clip_cues import (
    chat_clip_cue_seconds,
    collect_clip_cue_events,
    streamer_clip_cue_seconds,
    viewer_clip_cue_seconds,
)
from clips_worker.streamer.fusion import FusionPick, fuse_moments
from clips_worker.streamer.signals import audio_signal_per_second, transcript_signal_per_second
from clips_worker.streamer.signals.chat import chat_signal_per_second
from clips_worker.streamer.signals.viewer_clips import viewer_clips_signal_per_second


def rank_moments(
    *,
    audio_path: Path,
    words: list[dict],
    duration_ms: int,
    settings: dict,
    chapters: list[dict] | None = None,
    llm_ranker=None,
    use_llm: bool = True,
    chat_messages: list[dict] | None = None,
    viewer_clips: list[dict] | None = None,
) -> tuple[list[FusionPick], dict]:
    duration_s = max(1, int(duration_ms / 1000))
    audio_sig = audio_signal_per_second(audio_path, duration_s)
    transcript_sig = transcript_signal_per_second(words, duration_s)
    streamer_cues = streamer_clip_cue_seconds(words, duration_s)
    chat_sig = chat_signal_per_second(chat_messages or [], duration_s) if chat_messages else None
    chat_cues = chat_clip_cue_seconds(chat_messages or [], duration_s) if chat_messages else None
    viewer_sig = viewer_clips_signal_per_second(viewer_clips or [], duration_s) if viewer_clips else None
    viewer_cues = viewer_clip_cue_seconds(viewer_clips or [], duration_s) if viewer_clips else None
    clip_cues = [
        max(streamer_cues[i] if i < len(streamer_cues) else 0.0, chat_cues[i] if chat_cues and i < len(chat_cues) else 0.0, viewer_cues[i] if viewer_cues and i < len(viewer_cues) else 0.0)
        for i in range(duration_s)
    ]
    cue_events = collect_clip_cue_events(
        words=words,
        duration_s=duration_s,
        chat_messages=chat_messages,
        viewer_clips=viewer_clips,
    )
    signals = {
        "audio": audio_sig,
        "transcript": transcript_sig,
        "chat": chat_sig,
        "viewerClips": viewer_sig,
        "clipCues": clip_cues,
    }
    ranker = llm_ranker
    if ranker is None and use_llm:
        from clips_worker.streamer.llm_rank import make_llm_ranker

        ranker = make_llm_ranker(words, meta={"duration_s": duration_s})
    return fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=words,
        settings=settings,
        chapters=chapters,
        llm_ranker=ranker,
        cue_events=cue_events,
    )
