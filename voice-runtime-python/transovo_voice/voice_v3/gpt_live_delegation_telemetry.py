from __future__ import annotations

import json
import logging
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from transovo_voice.voice_v3.forensics import VoiceV3CallForensics

from transovo_voice.telemetry import log_event

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

# New canonical forensic kinds (reports prefer these).
_KIND_SERVER = {
    "response.created": "GPT_LIVE_BACKEND_RESPONSE_CREATED",
    "response.output_item.done": "GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED",
    "response.completed": "GPT_LIVE_BACKEND_RESPONSE_COMPLETED",
    "response.failed": "GPT_LIVE_BACKEND_RESPONSE_FAILED",
    "response.incomplete": "GPT_LIVE_BACKEND_RESPONSE_INCOMPLETE",
}

# Legacy aliases still emitted once for backward-compatible reports/DB rows.
_KIND_SERVER_LEGACY = {
    "response.created": "GPT_LIVE_DELEGATION_RESPONSE_CREATED",
    "response.output_item.done": "GPT_LIVE_DELEGATION_FUNCTION_CALL_EMITTED",
    "response.completed": "GPT_LIVE_DELEGATION_RESPONSE_COMPLETED",
    "response.failed": "GPT_LIVE_DELEGATION_RESPONSE_FAILED",
    "response.incomplete": "GPT_LIVE_DELEGATION_RESPONSE_INCOMPLETE",
}


def _safe_str(value: Any, max_len: int = 200) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def _argument_key_names(arguments: Any) -> list[str] | None:
    if arguments is None:
        return None
    if isinstance(arguments, dict):
        return sorted(str(k) for k in arguments.keys())[:48]
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
            if isinstance(parsed, dict):
                return sorted(str(k) for k in parsed.keys())[:48]
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def parse_session_delegation_created(raw: dict[str, Any]) -> dict[str, Any] | None:
    if raw.get("type") != "session.delegation.created":
        return None
    delegation_id = _safe_str(raw.get("delegation_id"))
    if not delegation_id:
        delegation_id = _safe_str(raw.get("id"))
    detail: dict[str, Any] = {
        "direction": "server",
        "envelope_type": "session.delegation.created",
        "provider_event_type": "session.delegation.created",
        "delegation_id": delegation_id,
    }
    session_id = _safe_str(raw.get("session_id"))
    if session_id:
        detail["provider_session_id"] = session_id
    return detail


def parse_server_delegation_event(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Return structured delegation lifecycle fields, or None if event should be ignored."""
    created = parse_session_delegation_created(raw)
    if created is not None:
        return created

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
    response_model = _safe_str(response.get("model")) if response else None
    response_status = _safe_str(response.get("status")) if response else None
    provider_created_at = _safe_str(response.get("created_at")) if response else None
    provider_completed_at = _safe_str(response.get("completed_at")) if response else None

    detail: dict[str, Any] = {
        "direction": "server",
        "envelope_type": "response.event",
        "inner_type": inner_type,
        "provider_event_type": inner_type,
        "delegation_id": delegation_id,
        "response_id": response_id,
    }
    if response_model:
        detail["response_model"] = response_model
    if response_status:
        detail["response_status"] = response_status
    if provider_created_at:
        detail["provider_created_at"] = provider_created_at
    if provider_completed_at:
        detail["provider_completed_at"] = provider_completed_at

    usage = response.get("usage") if response else None
    if isinstance(usage, dict) and usage:
        detail["usage_summary"] = {
            k: usage[k]
            for k in (
                "input_tokens",
                "output_tokens",
                "total_tokens",
                "input_tokens_details",
                "output_tokens_details",
            )
            if k in usage
        }

    if inner_type == "response.output_item.done":
        item = inner.get("item")
        if not isinstance(item, dict):
            return None
        item_type = _safe_str(item.get("type"))
        if item_type != "function_call":
            return None
        item_status = _safe_str(item.get("status"))
        if item_status != "completed":
            return None
        arg_keys = _argument_key_names(item.get("arguments"))
        detail.update(
            {
                "item_id": _safe_str(item.get("id")),
                "item_type": item_type,
                "item_status": item_status,
                "call_id": _safe_str(item.get("call_id")),
                "function_name": _safe_str(item.get("name")),
            }
        )
        if arg_keys:
            detail["argument_key_names"] = arg_keys
        if not detail.get("call_id"):
            return None

    if inner_type in ("response.failed", "response.incomplete"):
        err = response.get("error") if response else None
        if isinstance(err, dict):
            detail["error_code"] = _safe_str(err.get("code"))
            detail["error_type"] = _safe_str(err.get("type"))
            detail["error_message"] = _safe_str(err.get("message"), 300)
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
        "provider_event_type": etype,
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

    return detail


def _forensics_kind_for_detail(detail: dict[str, Any], *, legacy: bool = False) -> str:
    if detail.get("envelope_type") == "session.delegation.created":
        return "GPT_LIVE_BACKEND_DELEGATION_CREATED"
    if detail.get("direction") == "client":
        if detail.get("client_event_type") == "response.create":
            return (
                "GPT_LIVE_DELEGATION_RESPONSE_CREATE"
                if legacy
                else "GPT_LIVE_BACKEND_CONTINUATION_QUEUED"
            )
        return (
            "GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED"
            if legacy
            else "GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED"
        )
    inner = detail.get("inner_type")
    mapping = _KIND_SERVER_LEGACY if legacy else _KIND_SERVER
    return mapping.get(str(inner), "GPT_LIVE_DELEGATION_SERVER_EVENT")


def _apply_delegation_correlation_state(forensics: VoiceV3CallForensics, detail: dict[str, Any]) -> None:
    """Passive in-memory state for deterministic response_id ↔ delegation_id correlation."""
    delegation_id = detail.get("delegation_id")
    if not delegation_id:
        return
    inner = detail.get("inner_type")
    response_id = detail.get("response_id")
    if inner == "response.created" and response_id:
        forensics._delegation_active_response[str(delegation_id)] = str(response_id)
        return
    if inner == "response.output_item.done" and not response_id:
        active = forensics._delegation_active_response.get(str(delegation_id))
        if active:
            detail["response_id"] = active
    if inner in ("response.completed", "response.failed", "response.incomplete") and response_id:
        forensics._delegation_active_response[str(delegation_id)] = str(response_id)


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
        _apply_delegation_correlation_state(forensics, detail)
        if forensics._gpt_live_session_id:
            detail["gpt_live_session_id"] = forensics._gpt_live_session_id
        if forensics.ctx.call_id:
            detail["voice_call_id"] = forensics.ctx.call_id
        kind = _forensics_kind_for_detail(detail, legacy=False)
        forensics.append(kind, **detail)
    except Exception:
        logger.exception("gpt_live_delegation_telemetry_record_failed")


def attach_gpt_live_delegation_telemetry(
    forensics: VoiceV3CallForensics,
    duplex_session: Any,
    *,
    delegation_context: Any | None = None,
) -> None:
    """Passive listeners on GPTLiveSession; fail-open."""

    def _on_server(raw: dict[str, Any]) -> None:
        if not isinstance(raw, dict):
            return
        if delegation_context is not None:
            note = getattr(delegation_context, "note_openai_server_event", None)
            if callable(note):
                note(raw)
        etype = str(raw.get("type") or "")
        if "responses_validation_failed" in etype or etype == "responses.validation.failed":
            log_event(
                "voice_v3_responses_validation_failed",
                extra={"event": raw},
            )
        record_delegation_provider_event(forensics, raw, direction="server")

    def _on_client(raw: dict[str, Any]) -> None:
        if not isinstance(raw, dict):
            return
        record_delegation_provider_event(forensics, raw, direction="client")

    duplex_session.on("openai_server_event_received", _on_server)
    duplex_session.on("openai_client_event_queued", _on_client)
    forensics.append("GPT_LIVE_DELEGATION_TELEMETRY_ATTACHED")
