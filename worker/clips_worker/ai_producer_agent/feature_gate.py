"""AI Producer Agent worker gate — refuse jobs when product flag is off (default off)."""

from __future__ import annotations

import os

AI_PRODUCER_AGENT_JOB_TYPES = frozenset({"AI_PRODUCER_AGENT_ANALYZE"})


def ai_producer_agent_enabled() -> bool:
    raw = (os.environ.get("AI_PRODUCER_AGENT_ENABLED") or os.environ.get("NEXT_PUBLIC_AI_PRODUCER_AGENT") or "").strip().lower()
    return raw in ("1", "true", "on", "yes")
