"""LLM reject reason codes (playbook R1–R12) and hard vs soft classification."""
from __future__ import annotations

import re
from typing import Any

_HARD = re.compile(r"^R(1[0-2]|[1-9])\b", re.I)


def is_hard_llm_reject(
    reason: str | None,
    moment: dict[str, Any] | None = None,
    *,
    gemini_provenance: bool | None = None,
) -> bool:
    """True when an LLM reject should drop the moment (transcript-only pass 2).

    Gemini-provenance moments: no R-code is hard. Pass 2 may tighten bounds and
    supply scores; objective rejects (bad timestamps, too short after bounds) are
    handled elsewhere, not via R-codes.
    """
    if not reason:
        return False
    if gemini_provenance is None and moment is not None:
        from clips_worker.picker.final_score import moment_has_gemini_provenance

        gemini_provenance = moment_has_gemini_provenance(moment)
    if gemini_provenance:
        return False
    return bool(_HARD.match(reason.strip()))


def llm_dialogue_reject_blocks_moment(
    row: dict[str, Any],
    moment: dict[str, Any] | None = None,
    *,
    gemini_provenance: bool | None = None,
) -> bool:
    """Whether pass 2 should treat the LLM reject flag as dropping this moment."""
    if not row.get("reject"):
        return False
    if gemini_provenance is None and moment is not None:
        from clips_worker.picker.final_score import moment_has_gemini_provenance

        gemini_provenance = moment_has_gemini_provenance(moment)
    if gemini_provenance:
        return False
    return True
