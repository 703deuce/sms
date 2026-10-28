"""Seed pass-1 candidates from Gemini video-watch moments (activity-agnostic)."""
from __future__ import annotations

from clips_worker.picker.log_util import picker_info
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.final_score import normalize_gemini_score


def _ms_for_moment(m: dict, range_start_ms: int, key: str) -> int | None:
    if m.get(f"{key}_ms") is not None:
        return int(m[key + "_ms"])
    try:
        return range_start_ms + int(float(m.get(key + "_s") or 0) * 1000)
    except (TypeError, ValueError):
        return None


def visual_moments_need_supplement(
    visual_moments: list[dict],
    *,
    range_start_ms: int,
    range_end_ms: int,
) -> bool:
    """True when Gemini spans are too few or cover <55% of timeline (mixed uploads)."""
    if not visual_moments:
        return True
    if len(visual_moments) < 3:
        return True
    span = max(1, range_end_ms - range_start_ms)
    covered = 0
    for m in visual_moments:
        lo = _ms_for_moment(m, range_start_ms, "start")
        hi = _ms_for_moment(m, range_start_ms, "end")
        if lo is None or hi is None or hi <= lo:
            continue
        covered += hi - lo
    ratio = covered / span
    if ratio < 0.55:
        picker_info("visual_moments_sparse_coverage", ratio=round(ratio, 3), count=len(visual_moments))
        return True
    peaks: list[float] = []
    for m in visual_moments:
        p = _ms_for_moment(m, range_start_ms, "peak")
        if p is not None:
            peaks.append(p / 1000.0)
    if peaks and max(peaks) < (range_end_ms - range_start_ms) / 1000.0 * 0.45:
        picker_info("visual_moments_late_peak_missing", max_peak_s=round(max(peaks), 1))
        return True
    return False


def pass1_moments_from_visual(
    visual_moments: list[dict],
    sentences: list[Sentence],
    *,
    range_start_ms: int,
) -> list[dict]:
    if not visual_moments or not sentences:
        return []
    out: list[dict] = []
    for m in visual_moments:
        lo = _ms_for_moment(m, range_start_ms, "start")
        hi = _ms_for_moment(m, range_start_ms, "end")
        peak = _ms_for_moment(m, range_start_ms, "peak")
        if lo is None or hi is None or hi <= lo:
            continue
        anchor = peak or lo + (hi - lo) // 2
        ss = es = None
        for i, s in enumerate(sentences):
            if ss is None and s.end_ms >= lo:
                ss = i
            if s.start_ms <= anchor <= s.end_ms:
                anchor = i
            if s.start_ms < hi:
                es = i
        if ss is None:
            ss = 0
        if es is None:
            es = len(sentences) - 1
        cats = m.get("category") or []
        if isinstance(cats, str):
            cats = [c.strip() for c in cats.split("+") if c.strip()]
        arch = cats[0] if cats else "visual_watch"
        what = str(m.get("what_happened") or m.get("reason") or "").strip()
        out.append(
            {
                "start_sentence": int(ss),
                "end_sentence": int(es),
                "anchor_id": int(anchor),
                "archetype": arch,
                "locator": "",
                "why": what[:500] or "Gemini video-watch moment",
                "from_visual_watch": True,
                "visual_origin": True,
                "gemini_score": normalize_gemini_score(m.get("score")),
                "visual_score": float(m.get("score") or 0),
            }
        )
    if out:
        picker_info("pass1_visual_seeds", count=len(out))
    return out
