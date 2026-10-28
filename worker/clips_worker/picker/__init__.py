"""Multi-pass talking-mode clip picker."""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from clips_worker.picker.cleanup import finalize_picks
from clips_worker.content_detection import (
    layout_genre_hint,
    log_ignored_legacy_content_settings,
    normalize_content_genre,
    normalize_content_mode,
)
from clips_worker.picker.config import PICKER_LLM_GENRE
from clips_worker.job_telemetry import record_video_picker_stats
from clips_worker.target_clip_len import resolve_clip_length_policy
from clips_worker.picker.log_util import picker_info
from clips_worker.picker.fallback import pass1_heuristic_candidates
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

    layout_genre = layout_genre_hint(settings)
    picker_genre = PICKER_LLM_GENRE
    prompt = (settings.get("prompt") or "").strip()
    content_mode = normalize_content_mode(settings.get("mode"))
    content_genre = normalize_content_genre(settings.get("genre"))
    legacy = log_ignored_legacy_content_settings(settings)
    if legacy:
        picker_info("picker_legacy_content_settings_ignored", **legacy)
    source_ms = max(1, range_end_ms - range_start_ms)
    clip_length = settings.get("clipLength") or settings.get("clip_length") or "auto"
    length_policy = resolve_clip_length_policy(settings)

    picker_info(
        "picker_start",
        words_in=len(words),
        range_start_ms=range_start_ms,
        range_end_ms=range_end_ms,
        source_duration_ms=source_ms,
        genre=picker_genre,
        content_mode=content_mode,
        content_genre=content_genre,
        layout_genre=layout_genre,
        clip_length=clip_length,
        target_clip_len_s=length_policy.target_s,
        length_max_ms=length_policy.max_ms,
        length_mode=length_policy.mode,
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
    from pathlib import Path

    from clips_worker.video_picker import (
        format_moments_for_llm,
        video_picker_enabled,
        watch_upload_range,
    )

    if video_picker_enabled():
        vpath = settings.get("sourceVideoPath")
        if not vpath or not Path(str(vpath)).is_file():
            from clips_worker.picker.picker_errors import log_picker_error

            log_picker_error("gemini", "sourceVideoPath missing or not a file", None)
            picker_info("video_picker_regular_fail_open", reason="missing_source_video")
        else:
            import tempfile

            from clips_worker.picker.work_scratch import video_picker_scratch_dir

            scratch_vp = Path(tempfile.mkdtemp(dir=video_picker_scratch_dir(), prefix="vp_reg_"))
            vm, _curve, vp_meta = watch_upload_range(
                Path(str(vpath)),
                range_start_ms=range_start_ms,
                range_end_ms=range_end_ms,
                scratch=scratch_vp,
                target_clip_len_s=settings.get("target_clip_len_s"),
                sentences=sentences,
            )
            record_video_picker_stats(
                vp_meta,
                vm or [],
                range_start_ms=range_start_ms,
                sections=vp_meta.get("sections"),
            )
            if not vp_meta.get("ok"):
                from clips_worker.picker.picker_errors import VideoPickerRetryableError

                delay = 90
                if isinstance(vp_meta.get("quota"), dict):
                    from clips_worker.picker.picker_errors import parse_retry_delay_seconds
                    from clips_worker.video_picker import _quota_is_daily

                    if not _quota_is_daily(vp_meta["quota"]):
                        rd = parse_retry_delay_seconds(vp_meta["quota"].get("retryDelay"))
                        if rd is not None:
                            delay = int(min(120, max(30, rd + 5)))
                raise VideoPickerRetryableError(
                    str(vp_meta.get("error") or "video_picker failed")[:400],
                    delay_seconds=delay,
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
                picker_info(
                    "video_picker_regular",
                    moments=len(vm),
                    ok=True,
                    est_usd=vp_meta.get("est_usd"),
                    prompt_tokens=vp_meta.get("prompt_tokens"),
                    output_tokens=vp_meta.get("output_tokens"),
                )
            else:
                raise VideoPickerRetryableError(
                    "video_picker returned ok without moments",
                    delay_seconds=90,
                )

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
                    picker_genre,
                    prompt,
                    visual_moments=visual_moments or None,
                    range_start_ms=range_start_ms,
                    length_policy=length_policy,
                )
            from clips_worker.picker.signal_candidates import (
                merge_pass1_moments,
                propose_signal_action_moments,
                propose_silence_gap_moments,
            )
            from clips_worker.picker.visual_moment_seeds import (
                pass1_moments_from_visual,
                visual_moments_need_supplement,
            )

            visual_seeds = pass1_moments_from_visual(
                visual_moments,
                sentences,
                range_start_ms=range_start_ms,
            )
            if visual_seeds:
                moments = merge_pass1_moments(moments, visual_seeds)

            need_signal = visual_moments_need_supplement(
                visual_moments,
                range_start_ms=range_start_ms,
                range_end_ms=range_end_ms,
            )
            if need_signal:
                signal_moments = propose_signal_action_moments(
                    sentences,
                    signals,
                    range_start_ms=range_start_ms,
                    range_end_ms=range_end_ms,
                    genre=picker_genre,
                    max_window_ms=length_policy.max_ms,
                    video_picker_ran=bool(visual_moments),
                )
                gap_moments = propose_silence_gap_moments(
                    sentences,
                    range_start_ms=range_start_ms,
                    range_end_ms=range_end_ms,
                )
                extra = merge_pass1_moments(signal_moments, gap_moments)
                if extra:
                    picker_info(
                        "pass1_signal_supplement",
                        need_signal=need_signal,
                        visual_moments=len(visual_moments),
                        added=len(extra),
                    )
                    moments = merge_pass1_moments(moments, extra)
            if on_picker_checkpoint:
                on_picker_checkpoint(moments, None)
            if drain_requested():
                raise WorkerDrainExit("picker_pass1_checkpointed")
        if not moments:
            from clips_worker.picker.picker_errors import log_picker_error

            log_picker_error("openai", "pass1 returned no moments", None)
            raise RuntimeError("pass1 returned no moments")

        source_duration_s = source_ms / 1000.0
        if on_headstart_picks and content_mode not in ("captions",):
            try:
                heuristic = pass1_heuristic_candidates(
                    moments[:5],
                    sentences,
                    sig_by,
                    picker_genre,
                    source_duration_s=source_duration_s,
                )
                if heuristic:
                    early = finalize_picks(
                        heuristic[:2],
                        sentences,
                        sig_by,
                        range_words,
                        range_start_ms,
                        range_end_ms,
                        picker_genre,
                        length_policy=length_policy,
                    )
                    if early:
                        picker_info("headstart_picks", count=len(early))
                        on_headstart_picks(early)
            except Exception as exc:
                picker_info("headstart_failed", error=str(exc)[:200])

        with stage_span("picker_pass2", heartbeat=True):
            from clips_worker.picker.final_score import inherit_gemini_scores_on_pass1_moments

            inherit_gemini_scores_on_pass1_moments(
                moments,
                visual_moments or None,
                sentences,
                range_start_ms=range_start_ms,
            )
            scored, pass2_audit = score_moments(
                moments,
                sentences,
                signals,
                picker_genre,
                source_duration_s=source_duration_s,
                project_id=str(settings.get("projectId") or settings.get("project_id") or "").strip() or None,
                video_context=video_context or None,
                range_start_ms=range_start_ms,
                visual_moments=visual_moments or None,
                length_policy=length_policy,
                range_end_ms=range_end_ms,
            )
        if on_picker_checkpoint:
            on_picker_checkpoint(moments, scored)
        if drain_requested():
            raise WorkerDrainExit("picker_pass2_checkpointed")
        if not scored:
            from clips_worker.picker.picker_errors import log_picker_error

            log_picker_error("openai", "pass2 returned no scored moments", None)
            raise RuntimeError("pass2 returned no scored moments")

    source_duration_s = source_ms / 1000.0

    with stage_span("selection", heartbeat=True):
        picks = finalize_picks(
            scored,
            sentences,
            sig_by,
            range_words,
            range_start_ms,
            range_end_ms,
            picker_genre,
            visual_moments=visual_moments or None,
            length_policy=length_policy,
            source_duration_ms=source_ms,
            settings=settings,
        )
    if not picks and scored:
        picks = finalize_picks(
            scored,
            sentences,
            sig_by,
            range_words,
            range_start_ms,
            range_end_ms,
            picker_genre,
            relax_duration=True,
            visual_moments=visual_moments or None,
            length_policy=length_policy,
            source_duration_ms=source_ms,
            settings=settings,
        )
        if picks:
            picker_info("finalize_relaxed_duration", count=len(picks))

    picker_info("after_finalize", count=len(picks))

    if not picks:
        msg = "No complete, self-contained moments found in this segment."
        picker_info("picker_empty", message=msg)
        return [], msg

    for p in picks:
        ensure_clip_title(p, words, layout_genre, source_ms=source_ms)
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
