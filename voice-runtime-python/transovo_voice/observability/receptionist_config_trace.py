from __future__ import annotations

import json
import logging
from typing import Any

from transovo_voice.telemetry import log_event
from transovo_voice.userdata import SessionUserData

logger = logging.getLogger("transovo-voice.receptionist-trace")


def _booking_mode_from_capabilities(caps: list[str], tools: list[str]) -> str:
    if "book_appointments" not in caps:
        return "BOOKING_DISABLED"
    if "send_booking_link" in tools:
        return "SEND_LINK"
    if "calendly_booking" in tools:
        return "CALENDLY"
    if "find_appointment_slots" in tools or "book_appointment" in tools:
        return "CALENDAR_DIRECT"
    return "BOOKING_ENABLED_UNKNOWN_TOOLS"


def log_receptionist_runtime_config_load(
    ud: SessionUserData,
    bootstrap: dict[str, Any],
    *,
    bootstrap_path: str,
    published_mode: str = "production",
) -> None:
    caps = list(ud.receptionist.capabilities if ud.receptionist else [])
    tools = list(ud.enabled_builtin_tools or [])
    transfer_enabled = bool(
        ud.receptionist
        and ud.receptionist.transfer_policy
        and (
            ud.receptionist.transfer_policy.destination_e164
            or ud.receptionist.transfer_policy.emergency_destination_e164
        )
    )
    booking_mode = _booking_mode_from_capabilities(caps, tools)
    voice = (
        str(bootstrap.get("liveVoiceId") or bootstrap.get("voiceId") or "unknown")
    )
    agent_version = bootstrap.get("agentVersionId") or ud.agent_version_id
    revision = bootstrap.get("wizardConfigRevision")

    summary = {
        "agent": ud.agent_id,
        "call": ud.call_id,
        "published_version": agent_version,
        "published_mode": published_mode,
        "bootstrap_path": bootstrap_path,
        "wizard_revision": revision,
        "booking": booking_mode,
        "transfer": transfer_enabled,
        "voice": voice,
        "tools": tools,
        "capabilities": caps,
    }
    line = "[RECEPTIONIST][RUNTIME_LOAD]\n" + "\n".join(
        f"{k}={json.dumps(v) if isinstance(v, (list, dict)) else v}" for k, v in summary.items()
    )
    logger.info(line)
    log_event(
        "receptionist_runtime_load",
        call_id=ud.call_id,
        workspace_id=ud.workspace_id,
        agent_id=ud.agent_id,
        extra=summary,
    )
