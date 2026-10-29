"""Shadow fair-rank comparison — logs only (C1 §4)."""
from __future__ import annotations

import copy
import time
from typing import Any

from clips_worker.clipfind.context import get_ledger
from clips_worker.clipfind.fair_rank import rank_candidates_fair
from clips_worker.clipfind.flags import clipfind_flag
from clips_worker.decision_log import decision_log


def run_fusion_shadow(
    *,
    picks_before_sort: list[Any],
    candidates: list[dict],
    duration_s: int,
    channels: dict[str, Any],
    primary_n: int,
) -> dict[str, Any] | None:
    if not clipfind_flag("CLIPFIND_SHADOW_RANK"):
        return None
    t0 = time.perf_counter()
    try:
        fair_rows = rank_candidates_fair(
            copy.deepcopy(candidates),
            duration_s=duration_s,
            channels=channels,
        )
        if not fair_rows:
            return {"skipped": "fair_rank_skipped_short"}
        old_top = [
            (
                _cf(p),
                getattr(p, "start_ms", 0),
                getattr(p, "end_ms", 0),
                getattr(p, "score", 0),
            )
            for p in sorted(picks_before_sort, key=lambda x: -getattr(x, "score", 0))[:primary_n]
        ]
        new_top = [
            (
                str(r.get("cf_id") or r.get("id")),
                int(r.get("start_ms", 0)),
                int(r.get("end_ms", 0)),
                int(round(float(r.get("fair_rank_score") or 0) * 100)),
            )
            for r in fair_rows[:primary_n]
        ]
        old_ids = {x[0] for x in old_top if x[0]}
        new_ids = {x[0] for x in new_top if x[0]}
        overlap = len(old_ids & new_ids) / max(1, len(old_ids | new_ids))
        led = get_ledger()
        new_only = []
        for r in fair_rows[: primary_n + 5]:
            cid = str(r.get("cf_id") or r.get("id"))
            if cid in old_ids:
                continue
            new_only.append(
                {
                    "cf_id": cid,
                    "gate": r.get("fair_gate"),
                    "families": r.get("fair_families"),
                    "old_fate": led.old_fate(cid) if led else None,
                }
            )
        old_only = []
        for tup in old_top:
            if tup[0] and tup[0] not in new_ids:
                old_only.append({"cf_id": tup[0], "old_fate": led.old_fate(tup[0]) if led else None})
        payload = {
            "v": 1,
            "old_top": old_top,
            "new_top": new_top,
            "overlap_at_n": round(overlap, 4),
            "new_only": new_only[:10],
            "old_only": old_only[:10],
            "investigate_count": sum(1 for r in fair_rows if r.get("fair_gate") == "INVESTIGATE"),
            "pool_count": sum(1 for r in fair_rows if r.get("fair_gate") == "POOL"),
            "ms": round((time.perf_counter() - t0) * 1000, 2),
        }
        if payload["ms"] > 300:
            decision_log("clipfind", "shadow_skipped", reason="time_cap_ms", ms=payload["ms"])
            return None
        decision_log("clipfind", "shadow", **{k: v for k, v in payload.items() if k != "v"})
        return payload
    except Exception as exc:
        decision_log("clipfind", "shadow_skipped", reason=type(exc).__name__)
        return None


def _cf(p: Any) -> str:
    meta = getattr(p, "ai_meta", None) or {}
    cf = meta.get("clipfind") or {}
    if cf.get("cf_id"):
        return str(cf["cf_id"])
    return f"{getattr(p, 'start_ms', 0)}_{getattr(p, 'end_ms', 0)}"


def run_upload_selection_shadow(
    *,
    picks: list[dict],
    source_duration_ms: int,
) -> dict[str, Any] | None:
    """Shadow fair-rank on upload picks before overlap selection (C1.1)."""
    if not clipfind_flag("CLIPFIND_SHADOW_RANK"):
        return None
    t0 = time.perf_counter()
    try:
        duration_s = max(1, int(source_duration_ms / 1000))
        from clips_worker.clipfind.fair_rank import fair_rank_skipped_short

        if fair_rank_skipped_short(duration_s) and not clipfind_flag("CLIPFIND_UPLOAD_FAIR_RANK"):
            return {"skipped": "fair_rank_skipped_short"}
        cands = []
        for p in picks:
            cands.append(
                {
                    "id": str(p.get("clipfind", {}).get("cf_id") or f"{p.get('start_ms')}_{p.get('end_ms')}"),
                    "cf_id": p.get("clipfind", {}).get("cf_id"),
                    "start_ms": int(p["start_ms"]),
                    "end_ms": int(p["end_ms"]),
                    "gemini_score": p.get("gemini_score"),
                    "transcript_score": p.get("transcript_score") or p.get("final_score"),
                    "title": p.get("title"),
                    "hook": p.get("hook"),
                }
            )
        fair_rows = rank_candidates_fair(cands, duration_s=duration_s, channels={})
        if not fair_rows:
            return {"skipped": "no_fair_rows"}
        ranked = sorted(picks, key=lambda x: -float(x.get("final_score") or 0))
        n = min(5, len(ranked))
        old_top = [
            (
                str(p.get("clipfind", {}).get("cf_id") or f"{p['start_ms']}_{p['end_ms']}"),
                int(p["start_ms"]),
                int(p["end_ms"]),
                int(float(p.get("final_score") or 0) * 100),
            )
            for p in ranked[:n]
        ]
        new_top = [
            (
                str(r.get("cf_id") or r.get("id")),
                int(r.get("start_ms", 0)),
                int(r.get("end_ms", 0)),
                int(round(float(r.get("fair_rank_score") or 0) * 100)),
            )
            for r in fair_rows[:n]
        ]
        old_ids = {x[0] for x in old_top if x[0]}
        new_ids = {x[0] for x in new_top if x[0]}
        overlap = len(old_ids & new_ids) / max(1, len(old_ids | new_ids))
        led = get_ledger()
        payload = {
            "v": 1,
            "path": "upload",
            "old_top": old_top,
            "new_top": new_top,
            "overlap_at_n": round(overlap, 4),
            "investigate_count": sum(1 for r in fair_rows if r.get("fair_gate") == "INVESTIGATE"),
            "pool_count": sum(1 for r in fair_rows if r.get("fair_gate") == "POOL"),
            "new_only": [
                {
                    "cf_id": str(r.get("cf_id") or r.get("id")),
                    "gate": r.get("fair_gate"),
                    "old_fate": led.old_fate(str(r.get("cf_id") or r.get("id"))) if led else None,
                }
                for r in fair_rows[: n + 5]
                if str(r.get("cf_id") or r.get("id")) not in old_ids
            ][:10],
            "ms": round((time.perf_counter() - t0) * 1000, 2),
        }
        if payload["ms"] > 300:
            decision_log("clipfind", "shadow_skipped", reason="time_cap_ms", ms=payload["ms"], path="upload")
            return None
        decision_log("clipfind", "shadow", **{k: v for k, v in payload.items() if k != "v"})
        return payload
    except Exception as exc:
        decision_log("clipfind", "shadow_skipped", reason=type(exc).__name__, path="upload")
        return None
