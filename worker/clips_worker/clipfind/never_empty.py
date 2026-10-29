"""Never return zero clips when source has content (C1 §5)."""
from __future__ import annotations

from typing import Any

from clips_worker.clipfind.context import get_ledger
from clips_worker.clipfind.flags import clipfind_flag
from clips_worker.decision_log import decision_log


def source_has_content(*, duration_ms: int, words: list[dict] | None, ledger_nonempty: bool) -> bool:
    if duration_ms < 10_000:
        return False
    if ledger_nonempty:
        return True
    if words and len(words) >= 5:
        return True
    return False


def best_available_from_ledger(max_n: int) -> list[dict]:
    led = get_ledger()
    if not led:
        return []
    dropped = led.dropped_candidates()
    dropped.sort(key=lambda r: float(r.get("score") or 0), reverse=True)
    out: list[dict] = []
    for row in dropped[: max(1, max_n)]:
        start_ms = int(row.get("start_ms") or 0)
        end_ms = int(row.get("end_ms") or start_ms + 15_000)
        out.append(
            {
                "start_ms": start_ms,
                "end_ms": end_ms,
                "title": "Best available moment",
                "hook": "Best available moment",
                "score": float(row.get("score") or 0.3),
                "ai_meta": {
                    "clipfind": {
                        "best_available": True,
                        "low_confidence": True,
                        "cf_id": row.get("cf_id"),
                    }
                },
            }
        )
    return out


def maybe_never_empty_upload_planned(
    planned: list[dict],
    *,
    raw_picks: list[dict],
    duration_ms: int,
    words: list[dict] | None,
    want: int,
) -> list[dict]:
    if planned or not clipfind_flag("CLIPFIND_NEVER_EMPTY"):
        return planned
    led = get_ledger()
    if not source_has_content(
        duration_ms=duration_ms,
        words=words,
        ledger_nonempty=bool(led and led.summary().get("candidateCount")),
    ):
        return planned
    rescue = best_available_from_ledger(max(1, min(3, want)))
    if not rescue and raw_picks:
        rescue = raw_picks[: max(1, min(3, want))]
    if rescue:
        decision_log("clipfind", "never_empty_rescue", count=len(rescue), path="upload")
        return rescue
    return planned
