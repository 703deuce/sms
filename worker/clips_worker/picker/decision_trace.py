"""FIX3: per-clip picker/snap audit trail (stored on clip aiMeta, logged without secrets)."""
from __future__ import annotations

from typing import Any

from clips_worker.picker.log_util import picker_info


def init_pick_trace(
    pick: dict[str, Any],
    *,
    reason: str | None = None,
    raw_start_ms: int | None = None,
    raw_end_ms: int | None = None,
    score: Any = None,
) -> dict[str, Any]:
    trace: dict[str, Any] = {
        "why": (reason or pick.get("reason") or pick.get("hook") or "")[:500],
        "rawStartMs": int(raw_start_ms if raw_start_ms is not None else pick.get("start_ms", 0)),
        "rawEndMs": int(raw_end_ms if raw_end_ms is not None else pick.get("end_ms", 0)),
        "score": score if score is not None else pick.get("final", pick.get("score")),
        "steps": [],
    }
    pick["pickerTrace"] = trace
    return trace


def trace_step(pick: dict[str, Any], step: str, **fields: Any) -> None:
    tr = pick.get("pickerTrace")
    if not isinstance(tr, dict):
        tr = init_pick_trace(pick)
    entry = {"step": step, **{k: v for k, v in fields.items() if v is not None}}
    steps = tr.setdefault("steps", [])
    if isinstance(steps, list):
        steps.append(entry)
    picker_info(
        "pick_trace",
        title=str(pick.get("title", ""))[:60],
        step=step,
        start_ms=int(pick.get("start_ms", 0)),
        end_ms=int(pick.get("end_ms", 0)),
        **{k: v for k, v in fields.items() if isinstance(v, (int, float, str, bool))},
    )


def finalize_trace(pick: dict[str, Any]) -> dict[str, Any]:
    tr = pick.get("pickerTrace")
    if not isinstance(tr, dict):
        tr = init_pick_trace(pick)
    tr["finalStartMs"] = int(pick.get("start_ms", 0))
    tr["finalEndMs"] = int(pick.get("end_ms", 0))
    tr["finalScore"] = pick.get("final", pick.get("score"))
    pick["pickerTrace"] = tr
    return tr
