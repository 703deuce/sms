"""Multi-pass talking-mode clip picker."""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from clips_worker.picker.cleanup import finalize_picks
from clips_worker.picker.config import length_bucket
from clips_worker.picker.log_util import picker_info
from clips_worker.picker.fallback import pass1_heuristic_candidates, soft_pass2_fallback
from clips_worker.picker.pass1 import find_moments
from clips_worker.picker.pass2 import score_moments
from clips_worker.picker.sentences import build_sentences
from clips_worker.picker.signals import compute_signals
from clips_worker.picker.titles import SHORT_SOURCE_MAX_MS, ensure_clip_title


def _slice_words(words: list[dict], range_start_ms: int, range_end_ms: int) -> list[dict]:
    return [w for w in words if w["e"] * 1000 >= range_start_ms and w["s"] * 1000 <= range_end_ms]


def pick_talking_clips(
    words: list[dict],
    audio_path: str,
    settings: dict[str, Any],
    range_start_ms: int,
    range_end_ms: int,
    on_headstart_picks: Callable[[list[dict]], None] | None = None,
    *,
    picker_cache: dict[str, Any] | None = None,
    on_picker_checkpoint: Callable[[list[dict] | None, list[dict] | None], None] | None = None,
) -> tuple[list[dict], str | None]:
    """Return (picks, user_message). user_message is set when no clips could be produced."""
    if settings.get("mode") == "captions":
        end = min(range_end_ms, range_start_ms + 180_000)
        return (
            [
                {
                    "start_ms": range_start_ms,
                    "end_ms": end,
                    "title": "Full clip",
                    "hook": "",
                    "reason": "Captions-only mode",
                    "score": 80,
                    "scores": {"hook": "B", "flow": "B", "value": "B", "trend": "B"},
                    "aiMeta": {},
                }
            ],
            None,
        )

    genre = settings.get("genre", "podcast")
    prompt = (settings.get("prompt") or "").strip()
    source_ms = max(1, range_end_ms - range_start_ms)
    clip_length = settings.get("clipLength") or settings.get("clip_length") or "auto"
    bucket = length_bucket(clip_length, genre)
    bucket_max = int(bucket.get("max_ms", 60_000))
    if clip_length == "auto" or clip_length == "Auto":
        bucket_max = min(bucket_max, source_ms)

    picker_info(
        "picker_start",
        words_in=len(words),
        range_start_ms=range_start_ms,
        range_end_ms=range_end_ms,
        source_duration_ms=source_ms,
        genre=genre,
        clip_length=clip_length,
        length_max_ms=bucket_max,
    )

    range_words = _slice_words(words, range_start_ms, range_end_ms)
    sentences = build_sentences(words, range_start_ms, range_end_ms)
    picker_info("sentences_built", count=len(sentences))
    if not sentences:
        return [], "No transcript in the selected time range."

    from clips_worker.stage_log import stage_span

    with stage_span("scene_scan_signals", heartbeat=True):
        signals = compute_signals(sentences, audio_path, sentences)
    sig_by = {s.sentence_idx: s for s in signals}

    from clips_worker.worker_drain import WorkerDrainExit, drain_requested

    visual_moments: list[dict] = []
    video_context: str | None = None
    try:
        from pathlib import Path

        from clips_worker.video_picker import (
            format_moments_for_llm,
            video_picker_enabled,
            watch_upload_range,
        )

        if video_picker_enabled():
            vpath = settings.get("sourceVideoPath")
            if vpath and Path(str(vpath)).is_file():
                import tempfile

                from clips_worker.streamer.config import SCRATCH

                scratch_vp = Path(tempfile.mkdtemp(dir=SCRATCH, prefix="vp_reg_"))
                vm, _curve, _meta = watch_upload_range(
                    Path(str(vpath)),
                    range_start_ms=range_start_ms,
                    range_end_ms=range_end_ms,
                    scratch=scratch_vp,
                )
                if vm:
                    visual_moments = vm
                    video_context = format_moments_for_llm(
                        [
                            {
                                **m,
                                "t_s": (int(m.get("t_ms") or range_start_ms) - range_start_ms) / 1000.0,
                            }
                            for m in vm
                        ]
                    )
                    picker_info("video_picker_regular", moments=len(vm))
    except Exception as exc:
        picker_info("video_picker_regular_skipped", error=str(exc)[:200])

    cache = picker_cache or {}
    scored_from_cache = cache.get("pass2Scored")
    moments_from_cache = cache.get("pass1Moments")
    scored: list[dict] | None = None
    pass2_audit: list[dict] = []

    if isinstance(scored_from_cache, list) and scored_from_cache:
        picker_info("picker_resume_pass2", count=len(scored_from_cache))
        scored = scored_from_cache
        moments = moments_from_cache if isinstance(moments_from_cache, list) else []
    else:
        if isinstance(moments_from_cache, list) and moments_from_cache:
            picker_info("picker_resume_pass1", moments=len(moments_from_cache))
            moments = moments_from_cache
        else:
            with stage_span("picker_pass1", heartbeat=True):
                moments = find_moments(
                    sentences,
                    signals,
                    genre,
                    prompt,
                    visual_moments=visual_moments or None,
                    range_start_ms=range_start_ms,
                )
            if on_picker_checkpoint:
                on_picker_checkpoint(moments, None)
            if drain_requested():
                raise WorkerDrainExit("picker_pass1_checkpointed")
        if not moments:
            moments = [
                {
                    "start_sentence": 0,
                    "end_sentence": min(len(sentences) - 1, max(3, len(sentences) // 2)),
                    "why": "fallback_full_span",
                    "archetype": "story",
                }
            ]
            picker_info("pass1_fallback_span", end_sentence=moments[0]["end_sentence"])

        source_duration_s = source_ms / 1000.0
        if on_headstart_picks and settings.get("mode") not in ("captions", "anything"):
            try:
                heuristic = pass1_heuristic_candidates(
                    moments[:5], sentences, sig_by, genre, source_duration_s=source_duration_s
                )
                if heuristic:
                    early = finalize_picks(
                        heuristic[:2],
                        sentences,
                        sig_by,
                        range_words,
                        range_start_ms,
                        range_end_ms,
                        genre,
                    )
                    if early:
                        picker_info("headstart_picks", count=len(early))
                        on_headstart_picks(early)
            except Exception as exc:
                picker_info("headstart_failed", error=str(exc)[:200])

        with stage_span("picker_pass2", heartbeat=True):
            scored, pass2_audit = score_moments(
                moments,
                sentences,
                signals,
                genre,
                source_duration_s=source_duration_s,
                project_id=str(settings.get("projectId") or settings.get("project_id") or "").strip() or None,
                video_context=video_context or None,
            )
        if on_picker_checkpoint:
            on_picker_checkpoint(moments, scored)
        if drain_requested():
            raise WorkerDrainExit("picker_pass2_checkpointed")
        if not scored:
            scored = pass1_heuristic_candidates(
                moments, sentences, sig_by, genre, source_duration_s=source_duration_s
            )
            if scored:
                picker_info("pass2_empty_heuristic_fallback", count=len(scored))
        if not scored and pass2_audit:
            scored = soft_pass2_fallback(pass2_audit)
            if scored:
                picker_info("pass2_soft_audit_fallback", count=len(scored))

    source_duration_s = source_ms / 1000.0

    with stage_span("selection", heartbeat=True):
        picks = finalize_picks(
            scored, sentences, sig_by, range_words, range_start_ms, range_end_ms, genre
        )
    if not picks and scored:
        picks = finalize_picks(
            scored,
            sentences,
            sig_by,
            range_words,
            range_start_ms,
            range_end_ms,
            genre,
            relax_duration=True,
        )
        if picks:
            picker_info("finalize_relaxed_duration", count=len(picks))
    if not picks and sentences:
        span_fallback = [
            {
                "start_sentence": 0,
                "end_sentence": len(sentences) - 1,
                "title": "Highlight",
                "hook": "",
                "reason": "Short-source span fallback",
                "archetype": "story",
                "final": 6.0,
                "score": 60,
                "low_confidence": True,
            }
        ]
        picks = finalize_picks(
            span_fallback,
            sentences,
            sig_by,
            range_words,
            range_start_ms,
            range_end_ms,
            genre,
            relax_duration=True,
        )
        if picks:
            picker_info("span_fallback_picks", count=len(picks))

    picker_info("after_finalize", count=len(picks))

    if not picks and source_ms <= SHORT_SOURCE_MAX_MS and sentences:
        s0 = max(range_start_ms, int(sentences[0].start_ms))
        e0 = min(range_end_ms, int(sentences[-1].end_ms))
        if e0 - s0 >= 800:
            picks = [
                {
                    "start_ms": s0,
                    "end_ms": e0,
                    "title": "Highlight",
                    "hook": "",
                    "reason": "short_source_emergency",
                    "archetype": "story",
                    "score": 55,
                    "low_confidence": True,
                    "scores": {"hook": "C", "flow": "C", "value": "C", "trend": "C"},
                }
            ]
            picker_info("short_source_emergency_pick", start_ms=s0, end_ms=e0)

    if not picks:
        msg = "No complete, self-contained moments found in this segment."
        picker_info("picker_empty", message=msg)
        return [], msg

    for p in picks:
        ensure_clip_title(p, words, genre, source_ms=source_ms)
        ss, es = p["start_sentence"], p["end_sentence"]
        p["aiMeta"] = {
            "hook": p.get("hook"),
            "archetype": p.get("archetype"),
            "pass1_why": p.get("pass1_why"),
            "score_detail": p.get("score_detail"),
            "scoring": p.get("scoring"),
            "signals": [
                {"sentence": k, **vars(sig_by[sentences[k].idx])}
                for k in range(ss, es + 1)
                if k < len(sentences) and sentences[k].idx in sig_by
            ],
            "low_confidence": p.get("low_confidence", False),
        }
        p["scores"] = p.get("scores") or {}
    picker_info("picker_done", selected=len(picks))
    return picks, None
