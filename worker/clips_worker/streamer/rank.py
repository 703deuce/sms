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
from clips_worker.streamer.config import stream_chat_reaction_weight, stream_chat_signal_enabled
from clips_worker.streamer.signals.chat import chat_signal_per_second
from clips_worker.streamer.signals.markers import markers_signal_per_second
from clips_worker.streamer.signals.speaker_change import speaker_change_signal_per_second
from clips_worker.streamer.signals.viewer_clips import viewer_clips_signal_per_second
from clips_worker.streamer.boundaries import snap_fusion_pick


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
    vod_signal_curves: dict[str, list[float]] | None = None,
    video_signal: list[float] | None = None,
    video_moments: list[dict] | None = None,
    transcript_ok: bool = True,
) -> tuple[list[FusionPick], dict]:
    duration_s = max(1, int(duration_ms / 1000))
    chat_sig: list[float] | None = None
    if stream_chat_signal_enabled() and chat_messages:
        chat_sig = chat_signal_per_second(chat_messages, duration_s)
    if vod_signal_curves:
        audio_sig = list(vod_signal_curves.get("audio") or [])
        reaction_sig = list(vod_signal_curves.get("reaction") or [])
        if len(reaction_sig) < duration_s:
            reaction_sig.extend([0.0] * (duration_s - len(reaction_sig)))
        reaction_sig = reaction_sig[:duration_s]
        if chat_sig:
            w = stream_chat_reaction_weight(settings)
            reaction_sig = [
                max(reaction_sig[i], w * (chat_sig[i] if i < len(chat_sig) else 0.0))
                for i in range(duration_s)
            ]
        audio_sig = [
            max(audio_sig[i] if i < len(audio_sig) else 0.0, reaction_sig[i])
            for i in range(duration_s)
        ]
        transcript_sig = list(vod_signal_curves.get("transcript") or [])
        speaker_sig = list(vod_signal_curves.get("speakerChange") or [])
        if len(audio_sig) < duration_s:
            audio_sig.extend([0.0] * (duration_s - len(audio_sig)))
        if len(transcript_sig) < duration_s:
            transcript_sig.extend([0.0] * (duration_s - len(transcript_sig)))
        if len(speaker_sig) < duration_s:
            speaker_sig.extend([0.0] * (duration_s - len(speaker_sig)))
        audio_sig = audio_sig[:duration_s]
        transcript_sig = transcript_sig[:duration_s]
        speaker_sig = speaker_sig[:duration_s]
    else:
        audio_sig = audio_signal_per_second(audio_path, duration_s)
        transcript_sig = transcript_signal_per_second(words, duration_s)
        speaker_sig = speaker_change_signal_per_second(words, duration_s)
    streamer_cues = streamer_clip_cue_seconds(words, duration_s)
    if chat_sig is None and stream_chat_signal_enabled() and chat_messages:
        chat_sig = chat_signal_per_second(chat_messages, duration_s)
    chat_cues = (
        chat_clip_cue_seconds(chat_messages or [], duration_s)
        if stream_chat_signal_enabled() and chat_messages
        else None
    )
    viewer_sig = viewer_clips_signal_per_second(viewer_clips or [], duration_s) if viewer_clips else None
    marker_sig = markers_signal_per_second(chapters, duration_s) if chapters else None
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
    video_sig = None
    if video_signal and len(video_signal) >= duration_s:
        video_sig = video_signal[:duration_s]
    elif video_signal:
        video_sig = list(video_signal) + [0.0] * (duration_s - len(video_signal))

    signals = {
        "audio": audio_sig,
        "transcript": transcript_sig,
        "chat": chat_sig,
        "viewerClips": viewer_sig,
        "clipCues": clip_cues,
        "markers": marker_sig,
        "speakerChange": speaker_sig,
        "video": video_sig,
    }
    ranker = llm_ranker
    if ranker is None and use_llm and transcript_ok:
        from clips_worker.streamer.llm_rank import make_llm_ranker

        ranker = make_llm_ranker(
            words,
            video_moments=video_moments,
            chat_messages=chat_messages,
            viewer_clips=viewer_clips,
            cue_events=cue_events,
            range_start_ms=0,
        )
    elif ranker is None and use_llm and not transcript_ok:
        from clips_worker.decision_log import decision_log

        decision_log("stream_rank", "rescorer_skipped_no_transcript", word_count=len(words))
        ranker = None
    picks, payload = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=words,
        settings=settings,
        chapters=chapters,
        llm_ranker=ranker,
        cue_events=cue_events,
        video_moments=video_moments,
        transcript_ok=transcript_ok,
    )
    from clips_worker.target_clip_len import enrich_settings_with_clip_length, resolve_clip_length_policy

    settings = enrich_settings_with_clip_length(settings)
    range_end = duration_ms
    length_max_ms = resolve_clip_length_policy(settings).max_ms
    snapped = [
        snap_fusion_pick(
            p,
            words,
            range_start_ms=0,
            range_end_ms=range_end,
            length_max_ms=length_max_ms,
        )
        for p in picks
    ]
    from clips_worker.decision_log import decision_log

    decision_log(
        "stream_rank",
        "finish",
        pick_count=len(snapped),
        duration_ms=duration_ms,
    )
    return snapped, payload
