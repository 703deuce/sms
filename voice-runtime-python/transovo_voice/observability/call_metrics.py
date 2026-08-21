from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from livekit.agents import AgentSession

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.telemetry import log_event
from transovo_voice.userdata import SessionUserData

T = TypeVar("T")


class CallObservability:
    """Per-call timing, tool, and response-speed telemetry."""

    def __init__(
        self,
        *,
        ud: SessionUserData,
        backend: TransovoBackend,
        template_id: str,
        job_started_at: float,
    ) -> None:
        self._ud = ud
        self._backend = backend
        self._template_id = template_id
        self._job_started_at = job_started_at
        self._bootstrap_ms: int | None = None
        self._worker_ready_ms: int | None = None
        self._first_user_speech_at: float | None = None
        self._first_agent_response_at: float | None = None
        self._tool_calls = 0

    async def mark_bootstrap_complete(self) -> None:
        self._bootstrap_ms = int((time.perf_counter() - self._job_started_at) * 1000)
        asyncio.create_task(
            self._record(
                "bootstrap_complete",
                metrics={
                    "bootstrapMs": self._bootstrap_ms,
                    "agentTemplate": self._template_id,
                },
            ),
        )

    async def mark_worker_ready(self) -> None:
        self._worker_ready_ms = int((time.perf_counter() - self._job_started_at) * 1000)
        asyncio.create_task(
            self._record(
                "worker_ready",
                metrics={
                    "bootstrapMs": self._bootstrap_ms,
                    "workerReadyMs": self._worker_ready_ms,
                    "agentTemplate": self._template_id,
                },
            ),
        )

    async def mark_first_agent_response(self, *, source: str) -> None:
        if self._first_agent_response_at is not None:
            return
        self._first_agent_response_at = time.perf_counter()
        response_ms = int((self._first_agent_response_at - self._job_started_at) * 1000)
        user_to_agent_ms = None
        if self._first_user_speech_at is not None:
            user_to_agent_ms = int(
                (self._first_agent_response_at - self._first_user_speech_at) * 1000,
            )
        asyncio.create_task(
            self._record(
                "first_agent_response",
                metrics={
                    "firstAgentResponseMs": response_ms,
                    "userToAgentResponseMs": user_to_agent_ms,
                    "responseSource": source,
                    "agentTemplate": self._template_id,
                },
                latency_ms=response_ms,
            ),
        )

    async def record_tool_call(
        self,
        *,
        tool_type: str,
        status: str,
        latency_ms: int,
        args: dict[str, Any] | None = None,
        output: Any | None = None,
        error: str | None = None,
    ) -> None:
        self._tool_calls += 1
        log_event(
            "tool_call",
            call_id=self._ud.call_id,
            workspace_id=self._ud.workspace_id,
            agent_id=self._ud.agent_id,
            extra={
                "toolType": tool_type,
                "status": status,
                "latencyMs": latency_ms,
                "toolCallCount": self._tool_calls,
                "agent_template": self._template_id,
            },
        )
        await self._record(
            "tool_call",
            tool_type=tool_type,
            tool_status="completed" if status == "completed" else "failed",
            tool_args=args,
            tool_output=output,
            tool_error=error,
            latency_ms=latency_ms,
            metrics={"toolCallCount": self._tool_calls},
        )

    async def finalize(self) -> None:
        duration_ms = int((time.perf_counter() - self._job_started_at) * 1000)
        await self._record(
            "call_summary",
            metrics={
                "callDurationMs": duration_ms,
                "bootstrapMs": self._bootstrap_ms,
                "workerReadyMs": self._worker_ready_ms,
                "toolCallCount": self._tool_calls,
                "agentTemplate": self._template_id,
            },
        )

    def attach_session(self, session: AgentSession) -> None:
        @session.on("user_input_transcribed")
        def _on_user_input(ev: Any) -> None:
            if self._first_user_speech_at is None:
                self._first_user_speech_at = time.perf_counter()

        @session.on("agent_speech_committed")
        def _on_agent_speech(_ev: Any) -> None:
            import asyncio

            asyncio.create_task(self.mark_first_agent_response(source="agent_speech_committed"))

        @session.on("function_tools_executed")
        def _on_tools(ev: Any) -> None:
            import asyncio

            async def _persist() -> None:
                for call in getattr(ev, "function_calls", []) or []:
                    name = getattr(call, "name", None) or getattr(call, "tool_name", "unknown")
                    await self.record_tool_call(
                        tool_type=str(name),
                        status="completed",
                        latency_ms=0,
                        args=getattr(call, "arguments", None) or {},
                    )

            asyncio.create_task(_persist())

    async def _record(
        self,
        kind: str,
        *,
        metrics: dict[str, Any] | None = None,
        tool_type: str | None = None,
        tool_status: str | None = None,
        tool_args: dict[str, Any] | None = None,
        tool_output: Any | None = None,
        tool_error: str | None = None,
        latency_ms: int | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "workspaceId": self._ud.workspace_id,
            "callId": self._ud.call_id,
            "agentId": self._ud.agent_id,
            "kind": kind,
        }
        if metrics:
            payload["metrics"] = metrics
        if tool_type:
            payload["toolType"] = tool_type
        if tool_status:
            payload["toolStatus"] = tool_status
        if tool_args:
            payload["toolArgs"] = tool_args
        if tool_output is not None:
            payload["toolOutput"] = tool_output
        if tool_error:
            payload["toolError"] = tool_error
        if latency_ms is not None:
            payload["latencyMs"] = latency_ms

        log_event(
            "call_telemetry",
            call_id=self._ud.call_id,
            workspace_id=self._ud.workspace_id,
            agent_id=self._ud.agent_id,
            extra={"kind": kind, **(metrics or {}), "toolType": tool_type},
        )

        import asyncio

        async def _send() -> None:
            try:
                await self._backend.call("record_call_telemetry", payload)
            except Exception as err:
                log_event(
                    "call_telemetry_failed",
                    call_id=self._ud.call_id,
                    workspace_id=self._ud.workspace_id,
                    agent_id=self._ud.agent_id,
                    extra={"kind": kind, "error": str(err)},
                )

        asyncio.create_task(_send())


def observe_tool(
    observability: CallObservability,
    tool_type: str,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """Decorator for template tool functions — records latency + outcome."""

    def decorator(fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            started = time.perf_counter()
            try:
                result = await fn(*args, **kwargs)
                latency_ms = int((time.perf_counter() - started) * 1000)
                await observability.record_tool_call(
                    tool_type=tool_type,
                    status="completed",
                    latency_ms=latency_ms,
                    output=str(result)[:500] if result is not None else None,
                )
                return result
            except Exception as err:
                latency_ms = int((time.perf_counter() - started) * 1000)
                await observability.record_tool_call(
                    tool_type=tool_type,
                    status="failed",
                    latency_ms=latency_ms,
                    error=str(err),
                )
                raise

        return wrapper

    return decorator
