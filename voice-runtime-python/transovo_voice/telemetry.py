from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("transovo-voice.telemetry")

SERVICE_NAME = "transovo-voice"


def log_event(
    event: str,
    *,
    call_id: str | None = None,
    workspace_id: str | None = None,
    agent_id: str | None = None,
    workflow: str | None = None,
    room: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "service": SERVICE_NAME,
        "source": "voice-python",
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if call_id:
        payload["callId"] = call_id
    if workspace_id:
        payload["workspaceId"] = workspace_id
    if agent_id:
        payload["agentId"] = agent_id
    if workflow:
        payload["workflow"] = workflow
    if room:
        payload["room"] = room
    if extra:
        payload.update(extra)
    print(json.dumps(payload), flush=True)


def log_boot_versions() -> None:
    try:
        import livekit.agents as lk_agents
        import livekit.plugins.openai as lk_openai

        from transovo_voice.build_identity import get_voice_build_identity

        log_event(
            "python_voice_dependencies_ready",
            extra={
                "livekit_agents": getattr(lk_agents, "__version__", "unknown"),
                "livekit_openai": getattr(lk_openai, "__version__", "unknown"),
                **get_voice_build_identity(),
            },
        )
    except Exception as err:
        logger.warning("version probe failed: %s", err)
