from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from livekit.agents import JobContext
from livekit.agents.llm.duplex_adapter import _DuplexRealtimeSession
from livekit.agents.voice.agent import Agent
from livekit.agents.voice.agent_session import AgentSession
from livekit.plugins.openai.realtime import GPTLiveSession

from transovo_voice.telemetry import log_event

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


def _sanitize_text(value: str, max_len: int = 200) -> str:
    text = _EMAIL_RE.sub("[email]", value)
    text = _PHONE_RE.sub("[phone]", text)
    if len(text) > max_len:
        return text[: max_len - 3] + "..."
    return text


def _sanitize_arguments(raw: str | dict[str, Any] | None) -> dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                raw = parsed
            else:
                return {"_preview": _sanitize_text(raw, 120)}
        except json.JSONDecodeError:
            return {"_preview": _sanitize_text(raw, 120)}
    if not isinstance(raw, dict):
        return {"_type": type(raw).__name__}
    out: dict[str, Any] = {}
    for key, val in raw.items():
        if isinstance(val, str):
            out[str(key)] = _sanitize_text(val)
        elif isinstance(val, (int, float, bool)) or val is None:
            out[str(key)] = val
        else:
            out[str(key)] = _sanitize_text(json.dumps(val, default=str), 120)
    return out


def _tool_names_from_delegation_responses(responses: dict[str, Any]) -> list[str]:
    tools = responses.get("tools") or []
    names: list[str] = []
    for tool in tools:
        if not isinstance(tool, dict):
            continue
        fn = tool.get("function")
        if isinstance(fn, dict) and fn.get("name"):
            names.append(str(fn["name"]))
        elif tool.get("name"):
            names.append(str(tool["name"]))
    return sorted(names)


def _summarize_delegation(delegation: dict[str, Any] | None) -> dict[str, Any]:
    if not delegation:
        return {"delegationType": None}
    dtype = delegation.get("type")
    summary: dict[str, Any] = {"delegationType": dtype}
    if dtype == "responses":
        responses = delegation.get("responses") or {}
        if isinstance(responses, dict):
            tool_names = _tool_names_from_delegation_responses(responses)
            summary.update(
                {
                    "responsesModel": responses.get("model"),
                    "responsesToolChoice": responses.get("tool_choice"),
                    "responsesParallelToolCalls": responses.get("parallel_tool_calls"),
                    "responsesToolsLength": len(tool_names),
                    "responsesToolNames": tool_names,
                }
            )
    elif dtype == "client":
        summary["delegationTarget"] = "client"
    return summary


@dataclass(frozen=True)
class VoiceV3GptLiveObservabilityContext:
    call_id: str
    workspace_id: str
    agent_id: str
    room: str
    job_id: str | None
    amy_instruction_chars: int
    astra_instruction_chars: int
    expected_tool_count: int
    expected_tool_names: list[str]


def log_voice_v3_delegation_expected(ctx: VoiceV3GptLiveObservabilityContext) -> None:
    log_event(
        "voice_v3_delegation_expected",
        call_id=ctx.call_id or None,
        workspace_id=ctx.workspace_id or None,
        agent_id=ctx.agent_id or None,
        room=ctx.room,
        extra={
            "jobId": ctx.job_id,
            "amyInstructionChars": ctx.amy_instruction_chars,
            "astraInstructionChars": ctx.astra_instruction_chars,
            "expectedToolCount": ctx.expected_tool_count,
            "expectedToolNames": ctx.expected_tool_names,
        },
    )


def _log_metrics(
    obs: VoiceV3GptLiveObservabilityContext,
    metrics: Any,
    source: str,
) -> None:
    metadata = getattr(metrics, "metadata", None)
    model_name = getattr(metadata, "model_name", None) if metadata else None
    model_provider = getattr(metadata, "model_provider", None) if metadata else None
    log_event(
        "voice_v3_llm_metrics_collected",
        call_id=obs.call_id or None,
        workspace_id=obs.workspace_id or None,
        agent_id=obs.agent_id or None,
        room=obs.room,
        extra={
            "source": source,
            "label": getattr(metrics, "label", None),
            "requestId": getattr(metrics, "request_id", None),
            "modelName": model_name,
            "modelProvider": model_provider,
            "promptTokens": getattr(metrics, "prompt_tokens", None),
            "completionTokens": getattr(metrics, "completion_tokens", None),
            "reasoningTokens": getattr(metrics, "reasoning_tokens", None),
            "totalTokens": getattr(metrics, "total_tokens", None),
            "isLikelyBackendResponses": bool(
                model_name and "live" not in str(model_name).lower() and "gpt-live" not in str(model_name).lower()
            ),
        },
    )


def attach_voice_v3_gpt_live_observability(
    *,
    job_ctx: JobContext,
    agent_session: AgentSession,
    agent: Agent,
    obs: VoiceV3GptLiveObservabilityContext,
) -> None:
    """Observability-only hooks for GPT-Live → Responses → FunctionTool boundaries."""

    try:
        duplex = agent.duplex_session
    except RuntimeError:
        log_event(
            "voice_v3_gpt_live_observability_attach_failed",
            call_id=obs.call_id or None,
            room=obs.room,
            extra={"reason": "no_duplex_session"},
        )
        return

    if not isinstance(duplex, GPTLiveSession):
        log_event(
            "voice_v3_gpt_live_observability_attach_failed",
            call_id=obs.call_id or None,
            room=obs.room,
            extra={"reason": "duplex_not_gpt_live", "duplexType": type(duplex).__name__},
        )
        return

    @duplex.on("openai_client_event_queued")
    def _on_client_event(event: dict[str, Any]) -> None:
        etype = str(event.get("type") or "")
        if etype != "session.start":
            return
        session_cfg = event.get("session") or {}
        instructions = str(session_cfg.get("instructions") or "")
        delegation_summary = _summarize_delegation(session_cfg.get("delegation"))
        log_event(
            "VOICE_V3_GPT_LIVE_SESSION_START_DELEGATION",
            call_id=obs.call_id or None,
            workspace_id=obs.workspace_id or None,
            agent_id=obs.agent_id or None,
            room=obs.room,
            extra={
                "jobId": obs.job_id,
                "eventType": etype,
                "voiceModel": session_cfg.get("model"),
                "amyInstructionChars": len(instructions),
                "expectedToolCount": obs.expected_tool_count,
                "expectedToolNames": obs.expected_tool_names,
                **delegation_summary,
            },
        )

    @duplex.on("openai_server_event_received")
    def _on_server_event(event: dict[str, Any]) -> None:
        etype = str(event.get("type") or "")
        base_extra: dict[str, Any] = {
            "jobId": obs.job_id,
            "eventType": etype,
        }

        if etype == "session.delegation.created":
            delegation = event.get("delegation") or {}
            log_event(
                "voice_v3_gpt_live_delegation_created",
                call_id=obs.call_id or None,
                workspace_id=obs.workspace_id or None,
                agent_id=obs.agent_id or None,
                room=obs.room,
                extra={
                    **base_extra,
                    "delegationId": delegation.get("id"),
                    "delegationTarget": delegation.get("target"),
                },
            )
            return

        if etype == "response.event":
            delegation_id = event.get("delegation_id")
            inner = event.get("event") or {}
            inner_type = str(inner.get("type") or "")
            response = inner.get("response") or {}
            response_id = response.get("id") if isinstance(response, dict) else None
            nested_extra = {
                **base_extra,
                "delegationId": delegation_id,
                "nestedEventType": inner_type,
                "responseId": response_id,
                "backendModel": response.get("model") if isinstance(response, dict) else None,
            }
            log_event(
                "voice_v3_gpt_live_response_event",
                call_id=obs.call_id or None,
                workspace_id=obs.workspace_id or None,
                agent_id=obs.agent_id or None,
                room=obs.room,
                extra=nested_extra,
            )

            if inner_type == "response.created":
                log_event(
                    "VOICE_V3_ASTRA_RESPONSE_STARTED",
                    call_id=obs.call_id or None,
                    workspace_id=obs.workspace_id or None,
                    agent_id=obs.agent_id or None,
                    room=obs.room,
                    extra=nested_extra,
                )
            elif inner_type == "response.output_item.done":
                item = inner.get("item") or {}
                if isinstance(item, dict) and item.get("type") == "function_call":
                    log_event(
                        "VOICE_V3_ASTRA_FUNCTION_CALL_REQUESTED",
                        call_id=obs.call_id or None,
                        workspace_id=obs.workspace_id or None,
                        agent_id=obs.agent_id or None,
                        room=obs.room,
                        extra={
                            **nested_extra,
                            "functionCallId": item.get("call_id") or item.get("id"),
                            "toolName": item.get("name"),
                            "itemStatus": item.get("status"),
                            "sanitizedArguments": _sanitize_arguments(item.get("arguments")),
                        },
                    )
            elif inner_type in ("response.failed", "response.incomplete", "response.completed"):
                err = response.get("error") if isinstance(response, dict) else None
                log_event(
                    "voice_v3_gpt_live_response_terminal",
                    call_id=obs.call_id or None,
                    room=obs.room,
                    extra={
                        **nested_extra,
                        "incompleteDetails": response.get("incomplete_details")
                        if isinstance(response, dict)
                        else None,
                        "errorType": err.get("type") if isinstance(err, dict) else None,
                        "errorCode": err.get("code") if isinstance(err, dict) else None,
                    },
                )
            return

        if etype in ("session.usage.updated", "session.closed", "error"):
            log_event(
                "voice_v3_gpt_live_session_signal",
                call_id=obs.call_id or None,
                room=obs.room,
                extra={
                    **base_extra,
                    "sessionClosedReason": event.get("reason") if etype == "session.closed" else None,
                    "error": _sanitize_text(json.dumps(event.get("error") or {}, default=str))
                    if etype == "error"
                    else None,
                },
            )
        elif etype == "session.started":
            log_event(
                "voice_v3_gpt_live_session_started",
                call_id=obs.call_id or None,
                room=obs.room,
                extra={
                    **base_extra,
                    "sessionId": (event.get("session") or {}).get("id"),
                },
            )

    @duplex.on("function_call")
    def _on_function_call(call: Any) -> None:
        log_event(
            "voice_v3_livekit_function_call_emitted",
            call_id=obs.call_id or None,
            workspace_id=obs.workspace_id or None,
            agent_id=obs.agent_id or None,
            room=obs.room,
            extra={
                "jobId": obs.job_id,
                "functionCallId": getattr(call, "call_id", None) or getattr(call, "id", None),
                "toolName": getattr(call, "name", None),
                "sanitizedArguments": _sanitize_arguments(getattr(call, "arguments", None)),
            },
        )

    @duplex.on("metrics_collected")
    def _on_duplex_metrics(metrics: Any) -> None:
        _log_metrics(obs, metrics, source="gpt_live_duplex")

    @agent_session.on("metrics_collected")
    def _on_session_metrics(ev: Any) -> None:
        metrics = getattr(ev, "metrics", ev)
        _log_metrics(obs, metrics, source="agent_session")

    try:
        rt = agent.realtime_llm_session
        if isinstance(rt, _DuplexRealtimeSession):
            @rt.on("metrics_collected")
            def _on_rt_metrics(metrics: Any) -> None:
                _log_metrics(obs, metrics, source="duplex_realtime_adapter")
    except RuntimeError:
        pass

    log_event(
        "voice_v3_gpt_live_observability_attached",
        call_id=obs.call_id or None,
        workspace_id=obs.workspace_id or None,
        agent_id=obs.agent_id or None,
        room=obs.room,
        extra={"jobId": obs.job_id},
    )
