"""Step E: snap to sentence boundaries, comedy laugh tail, selection."""
from __future__ import annotations

from clips_worker.picker.config import genre_meta, resolve_genre_key, snap_settings
from clips_worker.picker.extend_setup import extend_pick_to_min_duration
from clips_worker.picker.log_util import picker_info
from clips_worker.picker.selection import select_clips, top_up_selected_picks
from clips_worker.picker.snap_bounds import snap_bounds
from clips_worker.target_clip_len import ABS_MIN_MS, ClipLengthPolicy, resolve_clip_length_policy

# Shortest shipped clip (Opus parity).
MIN_SHIPPED_CLIP_MS = ABS_MIN_MS


def _clamp_boundary_payoff_to_payoff_sentence(pick: dict, sentences) -> None:
    """Stop LLM/visual payoff hints from stretching a clip to EOF."""
    try:
        pi = int(pick.get("payoff_id", pick.get("end_sentence", 0)))
    except (TypeError, ValueError):
        return
    if pi < 0 or pi >= len(sentences):
        return
    payoff_end = int(sentences[pi].end_ms)
    bp = pick.get("boundary_payoff_ms")
    if bp is None:
        return
    try:
        bp_i = int(bp)
    except (TypeError, ValueError):
        return
    if bp_i > payoff_end + 8_000:
        picker_info(
            "boundary_payoff_clamp",
            title=str(pick.get("title", ""))[:60],
            before=bp_i,
            after=payoff_end,
            payoff_id=pi,
        )
        pick["boundary_payoff_ms"] = payoff_end


def _tighten_overspan_sentences(pick: dict, sentences, *, max_ms: int) -> None:
    """Shrink wide pass1 spans toward payoff_id (e.g. meow beat vs whole monologue block)."""
    ss = int(pick["start_sentence"])
    es = int(pick["end_sentence"])
    if ss < 0 or es >= len(sentences) or ss > es:
        return
    try:
        pi = int(pick.get("payoff_id", es))
    except (TypeError, ValueError):
        pi = es
    pi = max(ss, min(pi, es))
    span_ms = int(sentences[es].end_ms) - int(sentences[ss].start_ms)
    if span_ms <= max_ms:
        return
    end_ms = int(sentences[pi].end_ms)
    start_idx = pi
    while start_idx > ss and (end_ms - int(sentences[start_idx - 1].start_ms)) > max_ms:
        start_idx -= 1
    pick["start_sentence"] = start_idx
    pick["end_sentence"] = max(start_idx, pi)
    picker_info(
        "tighten_overspan",
        title=str(pick.get("title", ""))[:60],
        before_ss=ss,
        before_es=es,
        after_ss=start_idx,
        after_es=pick["end_sentence"],
        max_ms=max_ms,
        span_ms_before=span_ms,
    )


def _apply_peak_hook_window(
    pick: dict,
    sentences,
    visual_moments: list[dict] | None,
    range_start_ms: int,
) -> None:
    """Shrink wide spans toward visual peak/hook (e.g. meow beat vs 53s monologue tail)."""
    before = (int(pick["start_ms"]), int(pick["end_ms"]))
    payoff_end = int(pick["end_ms"])
    try:
        pi = int(pick.get("payoff_id", pick.get("end_sentence", 0)))
        if 0 <= pi < len(sentences):
            payoff_end = int(sentences[pi].end_ms)
    except (TypeError, ValueError):
        pass
    bp = pick.get("boundary_payoff_ms")
    if bp is not None:
        try:
            payoff_end = min(payoff_end, int(bp))
        except (TypeError, ValueError):
            pass
    peak_ms: int | None = None
    hook_ms: int | None = None
    if visual_moments:
        for vm in visual_moments:
            try:
                ps = float(vm.get("peak_s") if vm.get("peak_s") is not None else vm.get("t_s") or 0)
                hs = float(vm.get("hook_s") if vm.get("hook_s") is not None else vm.get("start_s") or ps)
            except (TypeError, ValueError):
                continue
            abs_peak = int(ps * 1000) + int(range_start_ms)
            abs_hook = int(hs * 1000) + int(range_start_ms)
            if before[0] - 2000 <= abs_peak <= before[1] + 2000:
                peak_ms = abs_peak
                hook_ms = abs_hook
                break
    if peak_ms is None:
        return
    hook_ms = hook_ms if hook_ms is not None else peak_ms
    new_start = max(before[0], hook_ms - 3000)
    new_end = min(before[1], payoff_end + 700)
    if new_end - new_start < MIN_SHIPPED_CLIP_MS:
        return
    pick["start_ms"] = new_start
    pick["end_ms"] = new_end
    if (new_start, new_end) != before:
        print(
            f"[clipper:bounds] before={before[0]}-{before[1]} after={new_start}-{new_end} "
            f"reason=peak_hook title={str(pick.get('title', ''))[:50]}",
            flush=True,
        )


def min_pick_duration_ms(
    range_start_ms: int,
    range_end_ms: int,
    *,
    relax: bool = False,
    length_policy: ClipLengthPolicy | None = None,
) -> int:
    """Minimum shipped clip length after extend + snap."""
    del length_policy
    span = max(0, int(range_end_ms) - int(range_start_ms))
    if relax and span < MIN_SHIPPED_CLIP_MS:
        return max(1_000, span)
    return MIN_SHIPPED_CLIP_MS


def finalize_picks(
    scored: list[dict],
    sentences,
    signals_by_idx: dict,
    words: list[dict],
    range_start_ms: int,
    range_end_ms: int,
    genre: str = "podcast",
    *,
    relax_duration: bool = False,
    visual_moments: list[dict] | None = None,
    length_policy: ClipLengthPolicy | None = None,
    source_duration_ms: int | None = None,
    settings: dict | None = None,
) -> list[dict]:
    if length_policy is None:
        length_policy = resolve_clip_length_policy({"clipLength": "auto"})
    gkey = resolve_genre_key(genre)
    gmeta = genre_meta(genre)
    snap = snap_settings()
    laugh_tail = gmeta.get("preferences", {}).get("end_after_laugh_s") or snap.get("comedy_laugh_tail_s")

    span_ms = max(1, range_end_ms - range_start_ms)
    min_ms = min_pick_duration_ms(
        range_start_ms, range_end_ms, relax=relax_duration, length_policy=length_policy
    )
    source_fits_min = span_ms >= MIN_SHIPPED_CLIP_MS

    picks: list[dict] = []
    dropped_bounds = 0
    dropped_cannot_min = 0
    for row in scored:
        ss, es = row["start_sentence"], row["end_sentence"]
        if ss < 0 or es >= len(sentences) or ss > es:
            dropped_bounds += 1
            picker_info(
                "finalize_drop",
                reason="invalid_sentence_bounds",
                title=str(row.get("title", ""))[:80],
                start_sentence=ss,
                end_sentence=es,
                score=row.get("final", row.get("score")),
            )
            continue
        if not source_fits_min:
            dropped_cannot_min += 1
            picker_info(
                "finalize_drop",
                reason="source_span_below_min_clip_ms",
                title=str(row.get("title", ""))[:80],
                source_span_ms=span_ms,
                min_clip_ms=MIN_SHIPPED_CLIP_MS,
                score=row.get("final", row.get("score")),
            )
            continue
        pick_row = {**row}
        max_ms = int(
            pick_row.get("length_max_ms")
            or length_policy.effective_max_duration_ms(pick_row, range_end_ms)
        )
        if max_ms < MIN_SHIPPED_CLIP_MS:
            dropped_cannot_min += 1
            picker_info(
                "finalize_drop",
                reason="length_max_below_min_clip_ms",
                title=str(row.get("title", ""))[:80],
                length_max_ms=max_ms,
                min_clip_ms=MIN_SHIPPED_CLIP_MS,
                score=row.get("final", row.get("score")),
            )
            continue
        _tighten_overspan_sentences(pick_row, sentences, max_ms=max_ms)
        ss, es = pick_row["start_sentence"], pick_row["end_sentence"]
        start_ms = max(range_start_ms, sentences[ss].start_ms)
        end_ms = min(range_end_ms, sentences[es].end_ms)
        if gkey == "comedy_standup" and laugh_tail:
            lo, hi = float(laugh_tail[0]), float(laugh_tail[1])
            end_ms += int(((lo + hi) / 2) * 1000)
        pick = {**pick_row, "start_ms": start_ms, "end_ms": end_ms}
        if not pick.get("length_max_ms"):
            pick["length_max_ms"] = length_policy.effective_max_duration_ms(pick, range_end_ms)
        max_ms = int(pick.get("length_max_ms") or max_ms)
        _clamp_boundary_payoff_to_payoff_sentence(pick, sentences)
        if visual_moments and not pick.get("boundary_setup_ms") and not pick.get("boundary_payoff_ms"):
            try:
                from clips_worker.visual_boundaries import infer_boundaries_from_moments, visual_boundaries_enabled

                if visual_boundaries_enabled():
                    setup_ms, payoff_ms = infer_boundaries_from_moments(
                        pick["start_ms"],
                        pick["end_ms"],
                        visual_moments,
                        range_start_ms=range_start_ms,
                    )
                    if setup_ms is not None:
                        pick["boundary_setup_ms"] = setup_ms
                    if payoff_ms is not None:
                        pick["boundary_payoff_ms"] = payoff_ms
            except Exception:
                pass
        snap_bounds(pick, words, sentences, range_start_ms, range_end_ms)
        _apply_peak_hook_window(pick, sentences, visual_moments, range_start_ms)
        extend_pick_to_min_duration(
            pick,
            sentences,
            signals_by_idx,
            words,
            range_start_ms,
            range_end_ms,
            min_ms=min_ms,
            max_ms=max_ms,
        )
        dur = int(pick["end_ms"]) - int(pick["start_ms"])
        if dur < MIN_SHIPPED_CLIP_MS:
            dropped_cannot_min += 1
            picker_info(
                "finalize_drop",
                reason="cannot_extend_to_min_clip_ms",
                title=str(pick.get("title", ""))[:80],
                start_ms=int(pick["start_ms"]),
                end_ms=int(pick["end_ms"]),
                duration_ms=dur,
                min_clip_ms=MIN_SHIPPED_CLIP_MS,
                length_max_ms=max_ms,
                score=pick.get("final", pick.get("score")),
            )
            continue
        picks.append(pick)

    duration_ms = int(source_duration_ms or span_ms)
    selected = select_clips(picks, duration_ms)
    from clips_worker.picker.pick_quota import finalize_regular_picks_with_quota

    selected = finalize_regular_picks_with_quota(
        selected,
        picks,
        settings=settings if isinstance(settings, dict) else {},
        source_duration_ms=duration_ms,
    )
    from clips_worker.clip_span_resolve import resolve_overlaps

    selected = resolve_overlaps(selected, min_clip_ms=MIN_SHIPPED_CLIP_MS)
    picker_info(
        "finalize_done",
        pass2_in=len(scored),
        candidates=len(picks),
        selected=len(selected),
        dropped_bounds=dropped_bounds,
        dropped_cannot_min=dropped_cannot_min,
        relax_duration=relax_duration,
        min_shipped_clip_ms=MIN_SHIPPED_CLIP_MS,
    )
    return selected
