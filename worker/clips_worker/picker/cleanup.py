"""Step E: snap to sentence boundaries, comedy laugh tail, selection."""
from __future__ import annotations

from clips_worker.picker.config import genre_meta, resolve_genre_key, snap_settings
from clips_worker.picker.log_util import picker_info
from clips_worker.picker.selection import select_clips
from clips_worker.picker.snap_bounds import snap_bounds
from clips_worker.target_clip_len import ABS_MIN_MS, ClipLengthPolicy, resolve_clip_length_policy


def min_pick_duration_ms(
    range_start_ms: int,
    range_end_ms: int,
    *,
    relax: bool = False,
    length_policy: ClipLengthPolicy | None = None,
) -> int:
    """Target minimum clip length; relax for short sources so at least one clip can land."""
    span = max(0, int(range_end_ms) - int(range_start_ms))
    if relax:
        if span < 5_000:
            return max(1_000, span)
        return min(8_000, max(3_000, span // 8))
    if span < 30_000:
        if span < 5_000:
            return max(1_000, span)
        return min(15_000, max(5_000, span))
    if span <= 120_000:
        return min(15_000, max(8_000, span // 4))
    floor = length_policy.min_ms if length_policy else ABS_MIN_MS
    return min(floor, max(8_000, ABS_MIN_MS))


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
    picks = []
    short_pool: list[dict] = []
    dropped_short = 0
    dropped_bounds = 0
    for row in scored:
        ss, es = row["start_sentence"], row["end_sentence"]
        if ss < 0 or es >= len(sentences) or ss > es:
            dropped_bounds += 1
            continue
        start_ms = max(range_start_ms, sentences[ss].start_ms)
        end_ms = min(range_end_ms, sentences[es].end_ms)
        if gkey == "comedy_standup" and laugh_tail:
            lo, hi = float(laugh_tail[0]), float(laugh_tail[1])
            end_ms += int(((lo + hi) / 2) * 1000)
        pick = {**row, "start_ms": start_ms, "end_ms": end_ms}
        if not pick.get("length_max_ms"):
            pick["length_max_ms"] = length_policy.effective_max_duration_ms(pick, range_end_ms)
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
        dur = pick["end_ms"] - pick["start_ms"]
        if dur < min_ms:
            from clips_worker.picker.extend_setup import extend_short_pick_backward

            extend_short_pick_backward(
                pick,
                sentences,
                signals_by_idx,
                words,
                range_start_ms,
                range_end_ms,
                min_ms,
            )
            dur = pick["end_ms"] - pick["start_ms"]
        if dur < min_ms:
            dropped_short += 1
            if dur >= 2_500:
                short_pool.append(pick)
            continue
        picks.append(pick)

    # select_clips runs after snap_bounds; includes R10 near-duplicate dedupe on final ms spans
    selected = select_clips(picks, span_ms)
    if not selected and short_pool:
        selected = select_clips(short_pool, span_ms, force_best=True)
        if selected:
            picker_info("selection_short_pool_fallback", count=len(selected))
    if not selected and picks:
        selected = select_clips(picks, span_ms, force_best=True)
        if selected:
            picker_info("selection_force_best_fallback", count=len(selected))
    picker_info(
        "selection",
        candidates=len(picks),
        selected=len(selected),
        dropped_short=dropped_short,
        dropped_bounds=dropped_bounds,
        relax_duration=relax_duration,
        min_ms=min_ms,
    )
    return selected
