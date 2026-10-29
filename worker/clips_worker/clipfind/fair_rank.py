"""Fair stream/upload ranking — percentiles + OR-gate (C1). Pure CPU, no LLM."""
from __future__ import annotations

import re
from typing import Any

from clips_worker.decision_log import decision_log

_PLAN_RE = re.compile(r"\b(plan|let's go|on three|push)\b", re.I)


def span_iou_ms(a0: int, a1: int, b0: int, b1: int) -> float:
    inter = max(0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return inter / union if union > 0 else 0.0


def _window_peaks(curve: list[float] | None, duration_s: int, *, win_s: int = 30, step_s: int = 5) -> list[float]:
    if not curve:
        return []
    peaks: list[float] = []
    for start in range(0, max(1, duration_s - win_s + 1), step_s):
        end = min(duration_s, start + win_s)
        if end <= start:
            continue
        seg = curve[start:end]
        peaks.append(max(seg) if seg else 0.0)
    return peaks


def _percentile(value: float, population: list[float]) -> float:
    if not population:
        return 0.0
    below = sum(1 for v in population if v <= value)
    return below / len(population)


def _family_scores(
    *,
    start_ms: int,
    end_ms: int,
    duration_s: int,
    channels: dict[str, Any],
    gemini_score: float | None,
    llm_score: float | None,
    transcript_score: float | None,
) -> tuple[dict[str, float], dict[str, bool]]:
    """Return family percentile map and channel availability."""
    avail: dict[str, bool] = {}
    fam: dict[str, float] = {}

    def curve_pct(key: str, family: str) -> None:
        curve = channels.get(key)
        if not isinstance(curve, list) or not curve:
            avail[key] = False
            return
        peaks = _window_peaks(curve, duration_s)
        if not peaks:
            avail[key] = False
            return
        lo = max(0, start_ms // 1000)
        hi = min(len(curve), end_ms // 1000 + 1)
        if lo >= hi:
            val = 0.0
        else:
            val = max(curve[lo:hi])
        avail[key] = True
        fam[family] = max(fam.get(family, 0.0), _percentile(val, peaks))

    curve_pct("_raw_video", "visual")
    curve_pct("_raw_transcript", "talk")
    curve_pct("_raw_audio", "reaction")
    curve_pct("_raw_reaction", "reaction")
    curve_pct("_raw_chat", "reaction")
    curve_pct("_raw_viewerClips", "human")
    curve_pct("_raw_clipCues", "human")

    if gemini_score is not None:
        avail["gemini"] = True
        fam["visual"] = max(fam.get("visual", 0.0), float(gemini_score))
    if llm_score is not None:
        avail["llm"] = True
        fam["talk"] = max(fam.get("talk", 0.0), float(llm_score) / 100.0)
    if transcript_score is not None:
        avail["transcript"] = True
        fam["talk"] = max(fam.get("talk", 0.0), float(transcript_score))

    return fam, avail


def classify_gate(families: dict[str, float]) -> str:
    visual = families.get("visual", 0.0)
    talk = families.get("talk", 0.0)
    human = families.get("human", 0.0)
    reaction = families.get("reaction", 0.0)
    high = [k for k, v in families.items() if v >= 0.85]
    mid = [k for k, v in families.items() if v >= 0.70]
    if visual >= 0.85 or talk >= 0.85 or human >= 0.85:
        return "ADVANCE"
    if len(set(mid)) >= 2:
        return "ADVANCE"
    if reaction >= 0.85 and not (visual >= 0.70 or talk >= 0.70 or human >= 0.70):
        return "INVESTIGATE"
    return "POOL"


def fair_rank_skipped_short(duration_s: int, min_windows: int = 20) -> bool:
    if duration_s < 150:
        return True
    peaks = _window_peaks([0.0] * duration_s, duration_s)
    return len(peaks) < min_windows


def rank_candidates_fair(
    candidates: list[dict],
    *,
    duration_s: int,
    channels: dict[str, Any],
    transcript_ok: bool = True,
) -> list[dict]:
    if fair_rank_skipped_short(duration_s):
        decision_log("clipfind", "fair_rank_skipped_short", duration_s=duration_s)
        return []
    ranked: list[dict] = []
    for cand in candidates:
        start_ms = int(cand.get("start_ms", 0))
        end_ms = int(cand.get("end_ms", start_ms + 1000))
        fam, avail = _family_scores(
            start_ms=start_ms,
            end_ms=end_ms,
            duration_s=duration_s,
            channels=channels,
            gemini_score=float(cand["gemini_score"]) if cand.get("gemini_score") is not None else None,
            llm_score=float(cand.get("llm_score")) if cand.get("llm_score") is not None else None,
            transcript_score=float(cand.get("transcript_score")) if cand.get("transcript_score") is not None else None,
        )
        gate = classify_gate(fam)
        quality = float(cand.get("gemini_score") or (float(cand.get("llm_score") or 0) / 100.0) or 0.0)
        max_fam = max(fam.values()) if fam else 0.0
        avail_fams = [k for k, v in fam.items() if v > 0]
        agreement = (
            sum(1 for v in fam.values() if v >= 0.70) / max(1, len(avail_fams))
            if avail_fams
            else 0.0
        )
        rank_score = 0.60 * quality + 0.25 * max_fam + 0.15 * agreement
        row = {
            **cand,
            "fair_gate": gate,
            "fair_rank_score": rank_score,
            "fair_families": fam,
        }
        if _PLAN_RE.search(str(cand.get("title") or cand.get("hook") or "")):
            row["plan_hint"] = True
        ranked.append(row)
    ranked.sort(
        key=lambda r: (
            0 if r.get("fair_gate") == "ADVANCE" else (1 if r.get("fair_gate") == "INVESTIGATE" else 2),
            -float(r.get("fair_rank_score") or 0),
        ),
    )
    return ranked


def apply_fair_rank_to_fusion_picks(picks: list[Any], fair_rows: list[dict]) -> None:
    """Mutate FusionPick scores when CLIPFIND_FAIR_RANK is on."""
    by_id = {str(r.get("id")): r for r in fair_rows if r.get("id")}
    for p in picks:
        cid = str(getattr(p, "scores", {}).get("candidate_id") or "")
        row = by_id.get(cid)
        if not row:
            continue
        p.scores = dict(p.scores or {})
        p.scores["legacy_total"] = p.score
        p.score = int(round(float(row.get("fair_rank_score") or 0) * 100))
        meta = dict(p.ai_meta or {})
        cf = dict(meta.get("clipfind") or {})
        cf["fair_gate"] = row.get("fair_gate")
        cf["fair_families"] = row.get("fair_families")
        meta["clipfind"] = cf
        p.ai_meta = meta
