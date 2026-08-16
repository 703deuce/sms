from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("transovo-voice.telemetry")


def log_event(
    event: str,
    *,
    call_id: str | None = None,
    workspace_id: str | None = None,
    agent_id: str | None = None,
    workflow: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "source": "voice-python",
        "event": event,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    if call_id:
        payload["callId"] = call_id
    if workspace_id:
        payload["workspaceId"] = workspace_id
    if agent_id:
        payload["agentId"] = agent_id
    if workflow:
        payload["workflow"] = workflow
    if extra:
        payload.update(extra)
    print(json.dumps(payload), flush=True)


def log_boot_versions() -> None:
    try:
        import livekit.agents as lk_agents
        import livekit.plugins.openai as lk_openai

        log_event(
            "python_voice_dependencies_ready",
            extra={
                "livekit_agents": getattr(lk_agents, "__version__", "unknown"),
                "livekit_openai": getattr(lk_openai, "__version__", "unknown"),
            },
        )
    except Exception as err:
        logger.warning("version probe failed: %s", err)
