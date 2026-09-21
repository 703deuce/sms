from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from transovo_voice.voice_v3.gpt_live_delegation_telemetry import (
    attach_gpt_live_delegation_telemetry,
    parse_client_delegation_event,
    parse_server_delegation_event,
    record_delegation_provider_event,
)
from transovo_voice.voice_v3.tool_client import VoiceV3CallContext


@dataclass
class _StubForensics:
    ctx: VoiceV3CallContext
    _gpt_live_session_id: str | None = "live_u1_test"
    _events: list[dict[str, Any]] = field(default_factory=list)
    _delegation_active_response: dict[str, str] = field(default_factory=dict)

    def append(self, kind: str, **detail: Any) -> None:
        self._events.append({"kind": kind, "detail": detail})


def test_parse_server_ignores_audio_and_transcript_envelopes() -> None:
    assert parse_server_delegation_event({"type": "session.output_audio.delta", "delta": "x"}) is None
    assert parse_server_delegation_event({"type": "session.input_transcript.delta"}) is None
    assert parse_server_delegation_event({"type": "response.event", "event": {"type": "response.audio.delta"}}) is None


def test_parse_session_delegation_created() -> None:
    detail = parse_server_delegation_event(
        {"type": "session.delegation.created", "delegation_id": "dlg_sess_1"}
    )
    assert detail is not None
    assert detail["envelope_type"] == "session.delegation.created"
    assert detail["delegation_id"] == "dlg_sess_1"


def test_parse_server_response_created_preserves_resp_id() -> None:
    detail = parse_server_delegation_event(
        {
            "type": "response.event",
            "delegation_id": "dlg_1",
            "event": {
                "type": "response.created",
                "response": {"id": "resp_abc123", "model": "gpt-5.6-sol"},
            },
        }
    )
    assert detail is not None
    assert detail["inner_type"] == "response.created"
    assert detail["response_id"] == "resp_abc123"
    assert detail["delegation_id"] == "dlg_1"
    assert detail["response_model"] == "gpt-5.6-sol"


def test_parse_server_function_call_output_item_done() -> None:
    detail = parse_server_delegation_event(
        {
            "type": "response.event",
            "delegation_id": "dlg_2",
            "event": {
                "type": "response.output_item.done",
                "response": {"id": "resp_xyz"},
                "item": {
                    "type": "function_call",
                    "status": "completed",
                    "id": "fc_item_1",
                    "call_id": "call_Test123",
                    "name": "update_intake",
                    "arguments": '{"large": "must not be persisted", "foo": 1}',
                },
            },
        }
    )
    assert detail is not None
    assert detail["call_id"] == "call_Test123"
    assert detail["function_name"] == "update_intake"
    assert "arguments" not in detail
    assert detail["argument_key_names"] == ["foo", "large"]


def test_parse_server_skips_incomplete_function_call_status() -> None:
    assert (
        parse_server_delegation_event(
            {
                "type": "response.event",
                "event": {
                    "type": "response.output_item.done",
                    "item": {
                        "type": "function_call",
                        "status": "in_progress",
                        "call_id": "call_x",
                        "name": "book",
                    },
                },
            }
        )
        is None
    )


def test_parse_server_skips_non_function_output_item() -> None:
    assert (
        parse_server_delegation_event(
            {
                "type": "response.event",
                "event": {
                    "type": "response.output_item.done",
                    "item": {"type": "message", "status": "completed"},
                },
            }
        )
        is None
    )


def test_parse_server_response_failed_and_incomplete() -> None:
    failed = parse_server_delegation_event(
        {
            "type": "response.event",
            "delegation_id": "dlg_f",
            "event": {
                "type": "response.failed",
                "response": {"id": "resp_fail", "status": "failed", "error": {"code": "x", "type": "server_error"}},
            },
        }
    )
    assert failed is not None
    assert failed["inner_type"] == "response.failed"
    inc = parse_server_delegation_event(
        {
            "type": "response.event",
            "event": {
                "type": "response.incomplete",
                "response": {"id": "resp_inc", "incomplete_details": {"reason": "max_output_tokens"}},
            },
        }
    )
    assert inc is not None
    assert inc["inner_type"] == "response.incomplete"


def test_parse_client_tool_result_and_continuation() -> None:
    tool = parse_client_delegation_event(
        {
            "type": "response.item.create",
            "event_id": "tool_output_1",
            "item": {
                "type": "function_call_output",
                "call_id": "call_Test123",
                "output": '{"secret": "not persisted"}',
            },
        }
    )
    assert tool is not None
    assert tool["call_id"] == "call_Test123"
    assert "output" not in tool

    cont = parse_client_delegation_event(
        {"type": "response.create", "event_id": "response_create_1"}
    )
    assert cont is not None
    assert cont["client_event_id"] == "response_create_1"

    assert parse_client_delegation_event({"type": "session.input_audio.append"}) is None


def test_record_delegation_appends_lifecycle_kinds() -> None:
    forensics = _StubForensics(
        ctx=VoiceV3CallContext(
            room_name="r",
            sip_participant_identity="",
            caller_e164=None,
            dialed_e164=None,
            sip_call_id=None,
            provider_call_id=None,
            trunk_id=None,
            rule_id=None,
            live_session_id="lk_test",
            call_id="lk_test",
            workspace_id="ws",
            agent_id="ag",
        )
    )
    record_delegation_provider_event(
        forensics,
        {
            "type": "response.event",
            "delegation_id": "dlg_chain",
            "event": {"type": "response.created", "response": {"id": "resp_1"}},
        },
        direction="server",
    )
    record_delegation_provider_event(
        forensics,
        {
            "type": "response.event",
            "delegation_id": "dlg_chain",
            "event": {
                "type": "response.output_item.done",
                "item": {
                    "type": "function_call",
                    "status": "completed",
                    "call_id": "call_1",
                    "name": "update_intake",
                },
            },
        },
        direction="server",
    )
    record_delegation_provider_event(
        forensics,
        {
            "type": "response.item.create",
            "event_id": "e1",
            "item": {"type": "function_call_output", "call_id": "call_1"},
        },
        direction="client",
    )
    record_delegation_provider_event(
        forensics,
        {"type": "response.create", "event_id": "rc1"},
        direction="client",
    )
    kinds = [e["kind"] for e in forensics._events]
    assert "GPT_LIVE_BACKEND_RESPONSE_CREATED" in kinds
    assert "GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED" in kinds
    assert forensics._events[1]["detail"].get("response_id") == "resp_1"
    assert "GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED" in kinds
    assert "GPT_LIVE_BACKEND_CONTINUATION_QUEUED" in kinds


def test_record_delegation_fail_open_on_broken_forensics() -> None:
    class _Broken:
        ctx = None
        _delegation_active_response = {}

        def append(self, *_a: Any, **_k: Any) -> None:
            raise RuntimeError("boom")

    record_delegation_provider_event(
        _Broken(),
        {"type": "response.event", "event": {"type": "response.created", "response": {"id": "r"}}},
        direction="server",
    )


def test_attach_registers_provider_listeners() -> None:
    forensics = _StubForensics(
        ctx=VoiceV3CallContext(
            room_name="r",
            sip_participant_identity="",
            caller_e164=None,
            dialed_e164=None,
            sip_call_id=None,
            provider_call_id=None,
            trunk_id=None,
            rule_id=None,
            live_session_id="lk_test",
            call_id="lk_test",
            workspace_id="ws",
            agent_id="ag",
        )
    )

    class _Duplex:
        def __init__(self) -> None:
            self.handlers: dict[str, list] = {}

        def on(self, event: str, handler) -> None:
            self.handlers.setdefault(event, []).append(handler)

        def emit_server(self, raw: dict) -> None:
            for h in self.handlers.get("openai_server_event_received", []):
                h(raw)

    duplex = _Duplex()
    attach_gpt_live_delegation_telemetry(forensics, duplex)
    assert "openai_server_event_received" in duplex.handlers
    assert "openai_client_event_queued" in duplex.handlers
    duplex.emit_server(
        {
            "type": "response.event",
            "event": {
                "type": "response.output_item.done",
                "item": {
                    "type": "function_call",
                    "status": "completed",
                    "call_id": "call_x",
                    "name": "find_availability",
                },
            },
        }
    )
    assert any(e["kind"] == "GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED" for e in forensics._events)


def test_malformed_event_does_not_crash_attach_handler() -> None:
    forensics = _StubForensics(
        ctx=VoiceV3CallContext(
            room_name="r",
            sip_participant_identity="",
            caller_e164=None,
            dialed_e164=None,
            sip_call_id=None,
            provider_call_id=None,
            trunk_id=None,
            rule_id=None,
            live_session_id="lk_test",
            call_id="lk_test",
            workspace_id="ws",
            agent_id="ag",
        )
    )

    class _Duplex:
        def __init__(self) -> None:
            self.handlers: dict[str, list] = {}

        def on(self, event: str, handler) -> None:
            self.handlers.setdefault(event, []).append(handler)

        def emit_server(self, raw) -> None:
            for h in self.handlers.get("openai_server_event_received", []):
                h(raw)

    duplex = _Duplex()
    attach_gpt_live_delegation_telemetry(forensics, duplex)
    duplex.emit_server("not a dict")
    duplex.emit_server({"type": "response.event", "event": "broken"})
