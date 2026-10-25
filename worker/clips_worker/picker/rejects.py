"""LLM hard-reject reason codes (playbook R1–R12)."""
from __future__ import annotations

import re

_HARD = re.compile(r"^R(1[0-2]|[1-9])\b", re.I)


def is_hard_llm_reject(reason: str | None) -> bool:
    if not reason:
        return False
    return bool(_HARD.match(reason.strip()))
