"""Upload transcript gate demote (C1 §2g) — behind CLIPFIND_GATES_DEMOTE."""
from __future__ import annotations

from typing import Any

from clips_worker.clipfind.flags import clipfind_flag
from clips_worker.decision_log import decision_log
from clips_worker.picker.config import genre_meta, global_config


def try_gates_demote_instead_of_reject(
    scored: dict[str, Any],
    *,
    scores: dict[str, float],
    genre: str,
    teaser: bool,
    visual_payoff_moment: bool,
) -> bool:
    """Return True when a gate reject becomes a demote (flag on, within 1pt of gate)."""
    if not clipfind_flag("CLIPFIND_GATES_DEMOTE"):
        return False
    reason = str(scored.get("reject_reason") or "")
    if "llm_reject" in reason or "mid-thought" in reason:
        return False
    if visual_payoff_moment or teaser:
        return False
    g = global_config()
    G = genre_meta(genre)
    gates = {**(g.get("hard_gates") or {}), **(G.get("gates") or {})}
    sc_min = float(gates.get("self_contained_min", 5))
    pay_min = float(gates.get("payoff_min", 4))
    sc = float(scores.get("self_contained", 0))
    pay = float(scores.get("payoff", 0))
    demote = False
    if "self_contained" in reason and sc >= sc_min - 1.0 and sc < sc_min:
        demote = True
    elif "payoff below gate" in reason and pay >= pay_min - 1.0 and pay < pay_min:
        demote = True
    elif "payoff below global" in reason and pay >= 3.0 and pay < 4.0:
        demote = True
    if not demote:
        return False
    decision_log(
        "clipfind",
        "gates_demote",
        reason=reason[:80],
        self_contained=sc,
        payoff=pay,
    )
    scored.pop("reject", None)
    scored["gate_demoted"] = True
    scored["reject_reason"] = ""
    return True
