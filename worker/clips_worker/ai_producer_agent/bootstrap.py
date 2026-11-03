"""Register worker dispatch handlers without touching streamer/clipper modules."""

from __future__ import annotations

from typing import Any, Callable


def register_dispatch(dispatch: dict[str, Callable[..., Any]]) -> None:
    if "AI_PRODUCER_AGENT_ANALYZE" in dispatch:
        return
    from clips_worker.ai_producer_agent.job import handle_ai_producer_agent_analyze

    dispatch["AI_PRODUCER_AGENT_ANALYZE"] = handle_ai_producer_agent_analyze
