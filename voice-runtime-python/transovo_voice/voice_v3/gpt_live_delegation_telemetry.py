from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from transovo_voice.voice_v3.forensics import VoiceV3CallForensics

logger = logging.getLogger("transovo-voice.voice_v3.gpt_live_delegation_telemetry")

_SERVER_INNER_TYPES = frozenset(
    {
        "response.created",
        "response.output_item.done",
        "response.completed",
        "response.failed",
        "response.incomplete",
    }
)

_CLIENT_TYPES = frozenset({"response.item.create", "response.create"})


def _safe_str(value: Any, max_len: int = 200) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def parse_server_delegation_event(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Return structured delegation lifecycle fields, or None if event should be ignored."""
    if raw.get("type") != "response.event":
        return None
    inner = raw.get("event")
    if not isinstance(inner, dict):
        return None
    inner_type = _safe_str(inner.get("type"), 80)
    if inner_type not in _SERVER_INNER_TYPES:
        return None

    delegation_id = _safe_str(raw.get("delegation_id"))
    response = inner.get("response") if isinstance(inner.get("response"), dict) else {}
    response_id = _safe_str(response.get("id")) if response else None
    provider_created_at = _safe_str(response.get("created_at")) if response else None
    provider_completed_at = _safe_str(response.get("completed_at")) if response else None

    detail: dict[str, Any] = {
        "direction": "server",
        "envelope_type": "response.event",
        "inner_type": inner_type,
        "delegation_id": delegation_id,
        "response_id": response_id,
    }
    if provider_created_at:
        detail["provider_created_at"] = provider_created_at
    if provider_completed_at:
        detail["provider_completed_at"] = provider_completed_at

    if inner_type == "response.output_item.done":
        item = inner.get("item")
        if not isinstance(item, dict):
            return None
        item_type = _safe_str(item.get("type"))
        if item_type != "function_call":
            return None
        detail.update(
            {
                "item_id": _safe_str(item.get("id")),
                "item_type": item_type,
                "item_status": _safe_str(item.get("status")),
                "call_id": _safe_str(item.get("call_id")),
                "function_name": _safe_str(item.get("name")),
            }
        )
        if not detail.get("call_id"):
            return None

    if inner_type in ("response.failed", "response.incomplete"):
        err = response.get("error") if response else None
        if isinstance(err, dict):
            detail["error_code"] = _safe_str(err.get("code"))
            detail["error_type"] = _safe_str(err.get("type"))
        incomplete = response.get("incomplete_details") if response else None
        if isinstance(incomplete, dict):
            detail["incomplete_reason"] = _safe_str(incomplete.get("reason"))

    return detail


def parse_client_delegation_event(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Return structured outbound delegation fields, or None if event should be ignored."""
    etype = _safe_str(raw.get("type"), 80)
    if etype not in _CLIENT_TYPES:
        return None

    detail: dict[str, Any] = {
        "direction": "client",
        "client_event_type": etype,
        "client_event_id": _safe_str(raw.get("event_id")),
    }

    if etype == "response.item.create":
        item = raw.get("item")
        if not isinstance(item, dict):
            return None
        item_type = _safe_str(item.get("type"))
        if item_type != "function_call_output":
            return None
        detail["item_type"] = item_type
        detail["call_id"] = _safe_str(item.get("call_id"))
        if not detail.get("call_id"):
            return None
        # Do not persist tool output body (arguments/output text).

    return detail


def _forensics_kind_for_detail(detail: dict[str, Any]) -> str:
    if detail.get("direction") == "client":
        if detail.get("client_event_type") == "response.create":
            return "GPT_LIVE_DELEGATION_RESPONSE_CREATE"
        return "GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED"
    inner = detail.get("inner_type")
    mapping = {
        "response.created": "GPT_LIVE_DELEGATION_RESPONSE_CREATED",
        "response.output_item.done": "GPT_LIVE_DELEGATION_FUNCTION_CALL_EMITTED",
        "response.completed": "GPT_LIVE_DELEGATION_RESPONSE_COMPLETED",
        "response.failed": "GPT_LIVE_DELEGATION_RESPONSE_FAILED",
        "response.incomplete": "GPT_LIVE_DELEGATION_RESPONSE_INCOMPLETE",
    }
    return mapping.get(str(inner), "GPT_LIVE_DELEGATION_SERVER_EVENT")


def record_delegation_provider_event(forensics: VoiceV3CallForensics, raw: dict[str, Any], *, direction: str) -> None:
    try:
        if direction == "server":
            detail = parse_server_delegation_event(raw)
        elif direction == "client":
            detail = parse_client_delegation_event(raw)
        else:
            return
        if detail is None:
            return
        if forensics._gpt_live_session_id:
            detail["gpt_live_session_id"] = forensics._gpt_live_session_id
        if forensics.ctx.call_id:
            detail["voice_call_id"] = forensics.ctx.call_id
        kind = _forensics_kind_for_detail(detail)
        forensics.append(kind, **detail)
    except Exception:
        logger.exception("gpt_live_delegation_telemetry_record_failed")


def attach_gpt_live_delegation_telemetry(forensics: VoiceV3CallForensics, duplex_session: Any) -> None:
    """Passive listeners on GPTLiveSession; fail-open."""

    def _on_server(raw: dict[str, Any]) -> None:
        if not isinstance(raw, dict):
            return
        record_delegation_provider_event(forensics, raw, direction="server")

    def _on_client(raw: dict[str, Any]) -> None:
        if not isinstance(raw, dict):
            return
        record_delegation_provider_event(forensics, raw, direction="client")

    duplex_session.on("openai_server_event_received", _on_server)
    duplex_session.on("openai_client_event_queued", _on_client)
    forensics.append("GPT_LIVE_DELEGATION_TELEMETRY_ATTACHED")
