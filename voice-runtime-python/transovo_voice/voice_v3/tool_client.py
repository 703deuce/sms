from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

from transovo_voice.integrations.backend_client import TransovoBackend


@dataclass
class VoiceV3CallContext:
    room_name: str
    sip_participant_identity: str
    caller_e164: str | None
    dialed_e164: str | None
    sip_call_id: str | None
    provider_call_id: str | None
    trunk_id: str | None
    rule_id: str | None
    telnyx_call_screening_raw: str | None
    live_session_id: str
    call_id: str
    workspace_id: str
    agent_id: str


class TransovoV3ToolClient:
    def __init__(self, backend: TransovoBackend, call_context: VoiceV3CallContext) -> None:
        self._backend = backend
        self._ctx = call_context

    async def resolve_session_config(self) -> dict[str, Any]:
        payload = {
            "roomName": self._ctx.room_name,
            "sipParticipantIdentity": self._ctx.sip_participant_identity,
            "callerE164": self._ctx.caller_e164,
            "dialedE164": self._ctx.dialed_e164,
            "sipCallId": self._ctx.sip_call_id,
            "providerCallId": self._ctx.provider_call_id,
            "trunkId": self._ctx.trunk_id,
            "ruleId": self._ctx.rule_id,
            "telnyxCallScreeningRaw": self._ctx.telnyx_call_screening_raw,
        }
        return await self._backend.call("resolve_voice_v3_livekit_session", payload)

    async def execute(
        self,
        *,
        tool_name: str,
        arguments: dict[str, Any],
        function_call_id: str | None = None,
    ) -> dict[str, Any]:
        fc_id = function_call_id or f"lk_fc_{uuid.uuid4().hex[:12]}"
        payload = {
            "liveSessionId": self._ctx.live_session_id,
            "toolName": tool_name,
            "arguments": arguments,
            "functionCallId": fc_id,
        }
        result = await self._backend.call("execute_voice_v3_livekit_tool", payload)
        if isinstance(result, dict):
            return result
        return {"ok": False, "status": "error", "code": "INVALID_RESULT", "message": "bad backend shape"}

    async def commit_caller_utterance(self, utterance: str) -> dict[str, Any]:
        payload = {
            "liveSessionId": self._ctx.live_session_id,
            "utterance": utterance,
        }
        result = await self._backend.call("commit_voice_v3_livekit_caller_utterance", payload)
        return result if isinstance(result, dict) else {"committed": False}

    async def append_forensic_events(
        self,
        *,
        events: list[dict[str, Any]],
        canonical_turns: list[dict[str, Any]] | None = None,
        checkpoint: bool = False,
    ) -> None:
        payload = {
            "liveSessionId": self._ctx.live_session_id,
            "callId": self._ctx.call_id,
            "workspaceId": self._ctx.workspace_id,
            "agentId": self._ctx.agent_id,
            "events": events,
            "canonicalTurns": canonical_turns or [],
            "checkpoint": checkpoint,
        }
        await self._backend.call("append_voice_v3_forensic_events", payload)

    async def flush_forensics(self, **payload: Any) -> None:
        body = {
            "liveSessionId": self._ctx.live_session_id,
            "callId": self._ctx.call_id,
            "workspaceId": self._ctx.workspace_id,
            "agentId": self._ctx.agent_id,
            **payload,
        }
        await self._backend.call("flush_voice_v3_forensics", body)

    @staticmethod
    def serialize_tool_result(result: dict[str, Any]) -> str:
        return json.dumps(result, separators=(",", ":"), ensure_ascii=False)
