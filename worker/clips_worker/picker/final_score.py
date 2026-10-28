"""Combined Gemini + transcript ranking (Rick C7)."""
from __future__ import annotations

from typing import Any

VIDEO_WEIGHT = 1.5
TRANSCRIPT_WEIGHT = 1.0
_SCORE_DENOM = VIDEO_WEIGHT + TRANSCRIPT_WEIGHT


def normalize_gemini_score(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    if v > 1.0 and v <= 100.0:
        v = v / 100.0
    return max(0.0, min(1.0, v))


def normalize_transcript_score(pick: dict[str, Any]) -> float:
    if pick.get("transcript_score") is not None:
        try:
            t = float(pick["transcript_score"])
            return max(0.0, min(1.0, t if t <= 1.0 else t / 100.0))
        except (TypeError, ValueError):
            pass
    if pick.get("score_0_100") is not None:
        return max(0.0, min(1.0, float(pick["score_0_100"]) / 100.0))
    if pick.get("score") is not None:
        s = float(pick["score"])
        if s > 10:
            return max(0.0, min(1.0, s / 100.0))
        return max(0.0, min(1.0, s / 10.0))
    if pick.get("final") is not None:
        return max(0.0, min(1.0, float(pick["final"]) / 10.0))
    return 0.0


def gemini_score_from_record(record: dict[str, Any]) -> float | None:
    for key in ("gemini_score", "visual_score"):
        if record.get(key) is not None:
            return normalize_gemini_score(record.get(key))
    return None


def inherit_gemini_scores_on_pass1_moments(
    moments: list[dict],
    visual_moments: list[dict] | None,
    sentences: list,
    *,
    range_start_ms: int,
) -> None:
    """Gap/transcript candidates overlapping a Gemini span inherit its score."""
    if not visual_moments or not moments:
        return
    from clips_worker.video_picker import moment_abs_span_ms

    for m in moments:
        if gemini_score_from_record(m) is not None:
            continue
        try:
            ss = int(m["start_sentence"])
            es = int(m["end_sentence"])
        except (TypeError, ValueError, KeyError):
            continue
        if ss < 0 or es >= len(sentences) or ss > es:
            continue
        lo = int(sentences[ss].start_ms)
        hi = int(sentences[es].end_ms)
        best: float | None = None
        for vm in visual_moments:
            s_ms, e_ms = moment_abs_span_ms(vm, range_start_ms)
            overlap = max(0, min(hi, e_ms) - max(lo, s_ms))
            if overlap <= 0:
                continue
            g = normalize_gemini_score(vm.get("score"))
            if g is None:
                continue
            if best is None or g > best:
                best = g
        if best is not None:
            m["gemini_score"] = best
            m["from_visual"] = True


def moment_has_gemini_provenance(moment: dict[str, Any]) -> bool:
    if moment.get("from_visual_watch") or moment.get("from_visual") or moment.get("visual_origin"):
        return True
    return gemini_score_from_record(moment) is not None


def combined_final_score(gemini: float | None, transcript: float) -> float:
    g = normalize_gemini_score(gemini) if gemini is not None else 0.0
    t = max(0.0, min(1.0, transcript))
    return (VIDEO_WEIGHT * g + TRANSCRIPT_WEIGHT * t) / _SCORE_DENOM


def apply_combined_scores(pick: dict[str, Any], *, log: bool = True, stage: str = "rank") -> float:
    """Write gemini_score, transcript_score, final_score (+ legacy score/final)."""
    g = gemini_score_from_record(pick)
    if g is not None:
        pick["gemini_score"] = g
    t = normalize_transcript_score(pick)
    pick["transcript_score"] = round(t, 4)
    fs = combined_final_score(g, t)
    pick["final_score"] = round(fs, 4)
    pick["final"] = round(fs * 10.0, 2)
    pick["score"] = int(round(fs * 100))
    if log:
        try:
            from clips_worker.decision_log import decision_log

            decision_log(
                stage,
                "combined_score",
                title=str(pick.get("title") or "")[:80],
                start_ms=int(pick.get("start_ms") or 0),
                end_ms=int(pick.get("end_ms") or 0),
                gemini_score=g if g is not None else None,
                transcript_score=t,
                final_score=fs,
            )
        except Exception:
            pass
    return fs


def rank_sort_key(pick: dict[str, Any]) -> tuple[float, float, float, int]:
    fs = float(pick.get("final_score") or combined_final_score(
        gemini_score_from_record(pick),
        normalize_transcript_score(pick),
    ))
    g = gemini_score_from_record(pick) or 0.0
    end_ms = int(pick.get("end_ms") or 0)
    return (-fs, -g, -end_ms)
