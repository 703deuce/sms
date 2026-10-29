"""C2 boundary hooks — flag-gated; always fall back to caller values."""
from __future__ import annotations

from typing import Any

from clips_worker.clipfind.beats import (
    ClipBeats,
    apply_beats_to_bounds,
    compute_beats_heuristic,
    log_beats_shadow,
)
from clips_worker.clipfind.flags import clipfind_flag, clipfind_fallback
from clips_worker.decision_log import decision_log


def setup_lead_ms_for_coerce(*, evidence_backed: bool, default_lead_ms: int) -> int:
    if not clipfind_flag("CLIPFIND_SETUP_LOOKBACK"):
        return default_lead_ms
    if not evidence_backed:
        return default_lead_ms
    from clips_worker.clipfind.beats import SETUP_LOOKBACK_MAX_S

    return int(SETUP_LOOKBACK_MAX_S * 1000)


def merge_window_with_beats(
    start_ms: int,
    end_ms: int,
    *,
    boundary_setup_ms: int | None,
    boundary_payoff_ms: int | None,
    range_start_ms: int,
    range_end_ms: int | None,
    beats: ClipBeats | None,
) -> tuple[int, int]:
    """After vanilla merge_window_with_boundaries, optionally expand via beats."""
    if beats is None:
        return start_ms, end_ms
    return apply_beats_to_bounds(
        start_ms,
        end_ms,
        beats,
        range_start_ms=range_start_ms,
        range_end_ms=range_end_ms,
    )


def compute_and_shadow_beats(
    *,
    cf_id: str,
    start_ms: int,
    end_ms: int,
    range_start_ms: int = 0,
    range_end_ms: int | None = None,
    llm_row: dict | None = None,
    gemini_moment: dict | None = None,
    words: list[dict] | None = None,
    visual_curve: list[float] | None = None,
    channels: dict[str, Any] | None = None,
) -> ClipBeats | None:
    ch = channels or {}
    beats = compute_beats_heuristic(
        start_ms=start_ms,
        end_ms=end_ms,
        range_start_ms=range_start_ms,
        range_end_ms=range_end_ms,
        gemini_moment=gemini_moment,
        llm_row=llm_row,
        words=words,
        visual_curve=visual_curve,
        audio_energy=ch.get("_raw_audio"),
        chat_energy=ch.get("_raw_chat"),
    )
    log_beats_shadow(cf_id, beats, start_ms=start_ms, end_ms=end_ms)
    return beats


def apply_reaction_tail_to_end_ms(
    end_ms: int,
    *,
    beats: ClipBeats | None,
    range_end_ms: int,
    sentence_final_end_ms: int,
) -> int:
    if not clipfind_flag("CLIPFIND_REACTION_TAIL") or beats is None:
        return end_ms
    try:
        target = min(range_end_ms, beats.reaction_end_ms)
        floor = min(range_end_ms, sentence_final_end_ms + 300)
        return max(end_ms, max(floor, target))
    except Exception as exc:
        clipfind_fallback("apply_reaction_tail_to_end_ms", type(exc).__name__)
        return end_ms


def trim_over_max_preserve_payoff(
    start_ms: int,
    end_ms: int,
    max_ms: int,
    beats: ClipBeats | None,
) -> tuple[int, int]:
    if not clipfind_flag("CLIPFIND_TRIM_SETUP_FIRST") or beats is None:
        if end_ms - start_ms > max_ms:
            return start_ms, start_ms + max_ms
        return start_ms, end_ms
    try:
        span = end_ms - start_ms
        if span <= max_ms:
            return start_ms, end_ms
        payoff_floor = beats.payoff_ms + 1000
        min_start = max(start_ms, beats.event_ms - 3000)
        s = max(min_start, end_ms - max_ms)
        s = min(s, payoff_floor - max_ms)
        s = max(start_ms, s)
        e = end_ms
        if e - s > max_ms:
            e = s + max_ms
        if e < payoff_floor:
            s = max(start_ms, payoff_floor - max_ms)
            e = max(e, min(end_ms, s + max_ms))
        return s, e
    except Exception as exc:
        clipfind_fallback("trim_over_max_preserve_payoff", type(exc).__name__)
        if end_ms - start_ms > max_ms:
            return start_ms, start_ms + max_ms
        return start_ms, end_ms


def validate_render_window(
    *,
    start_ms: int,
    end_ms: int,
    beats: ClipBeats | None,
) -> dict[str, Any]:
    if not clipfind_flag("CLIPFIND_VALIDATE_WINDOW"):
        return {"skipped": True, "reason": "flag_off"}
    if beats is None:
        decision_log("clipfind", "validate_skipped_no_beats", start_ms=start_ms, end_ms=end_ms)
        return {"skipped": True, "reason": "no_beats"}
    try:
        margin = 300
        ok_event = start_ms + margin <= beats.event_ms <= end_ms - margin
        ok_payoff = start_ms + margin <= beats.payoff_ms <= end_ms - margin
        aftermath_only = start_ms > beats.event_ms or start_ms >= beats.payoff_ms - 1000
        valid = ok_event and ok_payoff and not aftermath_only
        out: dict[str, Any] = {
            "valid": valid,
            "aftermath_only": aftermath_only,
            "ok_event": ok_event,
            "ok_payoff": ok_payoff,
        }
        if not valid and clipfind_flag("CLIPFIND_VALIDATE_WINDOW"):
            ns = min(start_ms, beats.event_ms - 2000, beats.setup_start_ms)
            ne = max(end_ms, beats.reaction_end_ms)
            out["repair"] = {"start_ms": int(ns), "end_ms": int(ne)}
        decision_log("clipfind", "validate_window", start_ms=start_ms, end_ms=end_ms, **out)
        return out
    except Exception as exc:
        clipfind_fallback("validate_render_window", type(exc).__name__)
        return {"skipped": True, "reason": type(exc).__name__}
