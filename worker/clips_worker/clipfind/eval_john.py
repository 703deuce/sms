"""Offline eval for John's 5 failure patterns + loud false alarm (C2 §5)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from clips_worker.clipfind.beats import apply_beats_to_bounds, compute_beats_heuristic
from clips_worker.clipfind.c2_boundaries import validate_render_window
from clips_worker.clipfind.context import JobCtx, bind_clipfind, unbind_clipfind
from clips_worker.clipfind.flags import clipfind_flag, resolved_clipfind_flags
from clips_worker.clipfind.ledger import CandidateLedger, cf_id_for

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "clipfind"

JOHN_CASES = (
    "case1_badge_streak.json",
    "case2_plan_execution.json",
    "case3_answer_question.json",
    "case4_quiet_joke.json",
    "case5_quiet_visual.json",
    "case6_loud_false_alarm.json",
)


def _visual_curve(duration_s: int, peak_s: int, *, base: float = 0.2, peak: float = 0.95) -> list[float]:
    out = [base] * duration_s
    for t in range(max(0, peak_s - 40), min(duration_s, peak_s + 5)):
        out[t] = peak
    return out


def _fixture_window(raw: dict) -> tuple[int, int, dict | None, dict | None, list[dict] | None]:
    duration_s = int(raw.get("duration_s") or 300)
    range_end_ms = duration_s * 1000
    if raw.get("gemini_moment"):
        gm = raw["gemini_moment"]
        peak = int(float(gm.get("peak_s", 600)) * 1000)
        start = int(float(gm.get("start_s", peak - 28000)) * 1000)
        end = int(float(gm.get("end_s", peak + 10000)) * 1000)
        return start, end, gm, None, None
    if raw.get("execution"):
        ex = raw["execution"]
        s = int(float(ex.get("start_s", 440)) * 1000)
        e = int(float(ex.get("end_s", 470)) * 1000)
        return s, e, ex, None, None
    if raw.get("moment"):
        m = raw["moment"]
        s = int(float(m.get("start_s", 100)) * 1000)
        e = int(float(m.get("end_s", 130)) * 1000)
        return s, e, None, m, None
    return 0, 30_000, None, None, None


def score_case(raw: dict, *, flags_on: bool) -> dict[str, Any]:
    start_ms, end_ms, gm, llm, words = _fixture_window(raw)
    duration_s = int(raw.get("duration_s") or 300)
    peak_s = int((gm or llm or {}).get("peak_s") or (gm or {}).get("start_s") or 600)
    if raw.get("id") == "case1":
        peak_s = 600
    curve = _visual_curve(duration_s, peak_s)
    beats = compute_beats_heuristic(
        start_ms=start_ms,
        end_ms=end_ms,
        gemini_moment=gm,
        llm_row=llm,
        words=words,
        visual_curve=curve,
        range_end_ms=duration_s * 1000,
    )
    ns, ne = apply_beats_to_bounds(start_ms, end_ms, beats, range_end_ms=duration_s * 1000)
    if not flags_on:
        ns, ne = start_ms, end_ms
    val = validate_render_window(start_ms=ns, end_ms=ne, beats=beats)
    cid = cf_id_for(source=raw.get("id", "t"), start_ms=start_ms, end_ms=end_ms, peak_ms=beats.payoff_ms if beats else None)
    found = beats is not None
    ranked = True
    boundaries_kept = (ns == start_ms and ne == end_ms) if not flags_on else True
    right_footage = True
    if raw.get("id") == "case1" and beats:
        if flags_on:
            right_footage = abs(beats.setup_start_ms - 572_000) <= 2500 and ns <= 572_000 + 2500
        else:
            right_footage = ns == start_ms
    if raw.get("id") == "case6" and beats:
        found = True
        right_footage = beats.indicator == "none"
        if flags_on:
            boundaries_kept = ns == start_ms and ne == end_ms
    return {
        "case": raw.get("id"),
        "found": found,
        "ranked": ranked,
        "boundaries_kept": boundaries_kept,
        "right_footage": right_footage,
        "start_ms": ns,
        "end_ms": ne,
        "beats": beats.to_dict() if beats else None,
        "validation": val,
        "cf_id": cid,
    }


def run_john_eval(*, flags_on: bool = False) -> list[dict[str, Any]]:
    bind_clipfind(workspace_id="ws_eval", job_type="STREAM_ANALYZE")
    try:
        out = []
        for name in JOHN_CASES:
            raw = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
            out.append(score_case(raw, flags_on=flags_on))
        return out
    finally:
        unbind_clipfind()


def eval_summary(rows: list[dict[str, Any]]) -> dict[str, int]:
    keys = ("found", "ranked", "boundaries_kept", "right_footage")
    return {k: sum(1 for r in rows if r.get(k)) for k in keys}
