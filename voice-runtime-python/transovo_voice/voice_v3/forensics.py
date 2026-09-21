from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient, VoiceV3CallContext


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _metrics_to_dict(metrics: Any) -> dict[str, Any]:
    if metrics is None:
        return {}
    if isinstance(metrics, dict):
        return dict(metrics)
    if hasattr(metrics, "model_dump"):
        try:
            return metrics.model_dump()
        except Exception:
            pass
    out: dict[str, Any] = {}
    for key in (
        "started_speaking_at",
        "stopped_speaking_at",
        "e2e_latency",
        "playback_latency",
        "llm_node_ttft",
        "tts_node_ttfb",
    ):
        if hasattr(metrics, key):
            val = getattr(metrics, key)
            if val is not None:
                out[key] = val
    return out


def _sanitize_tool_detail(value: Any, max_len: int = 500) -> Any:
    if value is None:
        return None
    if isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        lowered = value.lower()
        if "bearer " in lowered or "api_key" in lowered or "authorization" in lowered:
            return "[redacted]"
        return value if len(value) <= max_len else value[: max_len - 1] + "…"
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            key = str(k).lower()
            if any(
                token in key
                for token in (
                    "token",
                    "secret",
                    "password",
                    "authorization",
                    "api_key",
                    "refresh",
                    "cookie",
                )
            ):
                out[str(k)] = "[redacted]"
            else:
                out[str(k)] = _sanitize_tool_detail(v, max_len=max_len)
        return out
    if isinstance(value, list):
        return [_sanitize_tool_detail(v, max_len=max_len) for v in value[:24]]
    return str(value)[:max_len]


@dataclass
class VoiceV3CallForensics:
    ctx: VoiceV3CallContext
    job_id: str
    room_name: str
    _t0: float = field(default_factory=time.perf_counter)
    _events: list[dict[str, Any]] = field(default_factory=list)
    _canonical_turns: dict[str, dict[str, Any]] = field(default_factory=dict)
    _turn_sequence: int = 0
    _gpt_live_session_id: str | None = None
    _gpt_live_usage: dict[str, Any] | None = None
    _backend_llm_usage: list[dict[str, Any]] = field(default_factory=list)
    _checkpoint_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    _last_checkpoint_at: float = 0.0

    def _monotonic_ms(self) -> int:
        return int((time.perf_counter() - self._t0) * 1000)

    def append(self, kind: str, **detail: Any) -> None:
        self._events.append(
            {
                "kind": kind,
                "occurred_at_utc": _utc_now(),
                "monotonic_ms_from_call_start": self._monotonic_ms(),
                "source": "python",
                "detail": _sanitize_tool_detail(detail) if detail else {},
            },
        )

    def note_gpt_live_session(self, session_id: str | None) -> None:
        if not session_id:
            return
        if self._gpt_live_session_id is None:
            self._gpt_live_session_id = session_id
            self.append("GPT_LIVE_SESSION_AVAILABLE", session_id=session_id)
            return
        if session_id != self._gpt_live_session_id:
            self.append(
                "GPT_LIVE_SESSION_CHANGED",
                old_session_id=self._gpt_live_session_id,
                new_session_id=session_id,
            )
            self._gpt_live_session_id = session_id

    def _merge_canonical_turn(
        self,
        *,
        role: str,
        text: str,
        conversation_item_id: str | None,
        committed_via: str,
        speech: dict[str, Any] | None,
        turn_key: str | None = None,
    ) -> None:
        cleaned = text.strip()
        if not cleaned:
            return
        key = turn_key or conversation_item_id or f"{role}:{committed_via}:{self._turn_sequence + 1}"
        row = self._canonical_turns.get(key)
        if not row:
            self._turn_sequence += 1
            row = {
                "turnKey": key,
                "role": role,
                "sequence": self._turn_sequence,
                "text": cleaned,
                "conversationItemId": conversation_item_id,
                "committedVia": [committed_via],
                "speech": speech or {},
                "textAvailableAt": _utc_now(),
            }
            self._canonical_turns[key] = row
        else:
            via = row.get("committedVia") or []
            if committed_via not in via:
                via.append(committed_via)
                row["committedVia"] = via
            if len(cleaned) >= len(str(row.get("text") or "")):
                row["text"] = cleaned
            if speech:
                row["speech"] = {**(row.get("speech") or {}), **speech}
            row["textAvailableAt"] = _utc_now()

    def attach_session(self, session: Any, agent: Any) -> None:
        @session.on("conversation_item_added")
        def _on_conversation_item(ev: Any) -> None:
            try:
                item = getattr(ev, "item", None)
                role = getattr(item, "role", None)
                if role not in ("user", "assistant"):
                    return
                text = getattr(item, "text_content", None) or getattr(item, "raw_text_content", None)
                if not text:
                    return
                metrics = _metrics_to_dict(getattr(item, "metrics", None))
                item_id = getattr(item, "id", None)
                kind = "AGENT_TURN_COMMITTED" if role == "assistant" else "USER_TURN_COMMITTED"
                self.append(
                    kind,
                    conversation_item_id=item_id,
                    role=role,
                    text=text,
                    metrics=metrics,
                    sequence_hint=self._turn_sequence + 1,
                )
                self._merge_canonical_turn(
                    role=str(role),
                    text=str(text),
                    conversation_item_id=str(item_id) if item_id else None,
                    committed_via=kind,
                    speech=metrics,
                    turn_key=str(item_id) if item_id else None,
                )
            except Exception:
                log_event("voice_v3_forensics_conversation_item_failed", room=self.room_name)

        @session.on("metrics_collected")
        def _on_metrics(ev: Any) -> None:
            try:
                metrics = getattr(ev, "metrics", None)
                if metrics is None:
                    return
                label = type(metrics).__name__
                dumped: dict[str, Any]
                if hasattr(metrics, "model_dump"):
                    dumped = metrics.model_dump()
                elif isinstance(metrics, dict):
                    dumped = dict(metrics)
                else:
                    dumped = {"repr": str(metrics)[:400]}
                if "Realtime" in label or "GPT" in label:
                    self._gpt_live_usage = dumped
                    self.append("GPT_LIVE_METRICS_COLLECTED", metrics_label=label, **dumped)
                else:
                    self._backend_llm_usage.append(dumped)
                    self.append("BACKEND_LLM_METRICS_COLLECTED", metrics_label=label, **dumped)
            except Exception:
                log_event("voice_v3_forensics_metrics_failed", room=self.room_name)

        @session.on("session_usage_updated")
        def _on_usage(ev: Any) -> None:
            try:
                usage = getattr(ev, "usage", None)
                if usage is None:
                    return
                dumped = usage.model_dump() if hasattr(usage, "model_dump") else usage
                self.append("SESSION_USAGE_UPDATED", usage=dumped)
            except Exception:
                log_event("voice_v3_forensics_usage_failed", room=self.room_name)

        @session.on("error")
        def _on_error(ev: Any) -> None:
            try:
                self.append(
                    "AGENTSESSION_ERROR",
                    error_type=type(ev).__name__,
                    message=str(getattr(ev, "error", ev))[:500],
                )
            except Exception:
                pass

        @session.on("close")
        def _on_close(ev: Any) -> None:
            try:
                self.append(
                    "AGENTSESSION_CLOSED",
                    reason=str(getattr(ev, "reason", ""))[:200],
                )
            except Exception:
                pass

        async def _watch_gpt_live_session() -> None:
            while True:
                try:
                    duplex = getattr(agent, "duplex_session", None)
                    sid = getattr(duplex, "session_id", None) if duplex else None
                    self.note_gpt_live_session(sid)
                except Exception:
                    pass
                await asyncio.sleep(2.0)

        asyncio.create_task(_watch_gpt_live_session())

    def note_tool_started(self, tool_name: str, function_call_id: str | None) -> None:
        self.append(
            "FUNCTION_TOOL_STARTED",
            tool=tool_name,
            call_id=function_call_id,
        )

    def note_tool_completed(
        self,
        tool_name: str,
        function_call_id: str | None,
        elapsed_ms: int,
        result: dict[str, Any],
    ) -> None:
        self.append(
            "FUNCTION_TOOL_COMPLETED",
            tool=tool_name,
            call_id=function_call_id,
            elapsed_ms=elapsed_ms,
            ok=result.get("ok"),
            status=result.get("status"),
            code=result.get("code"),
        )

    async def maybe_checkpoint(self, client: TransovoV3ToolClient, *, force: bool = False) -> None:
        now = time.monotonic()
        if not force and self._last_checkpoint_at and now - self._last_checkpoint_at < 45.0:
            return
        async with self._checkpoint_lock:
            now = time.monotonic()
            if not force and self._last_checkpoint_at and now - self._last_checkpoint_at < 45.0:
                return
            self._last_checkpoint_at = now
            asyncio.create_task(self._send_checkpoint(client))

    async def _send_checkpoint(self, client: TransovoV3ToolClient) -> None:
        try:
            await client.append_forensic_events(
                events=self._events[-120:],
                canonical_turns=list(self._canonical_turns.values()),
                checkpoint=True,
            )
        except Exception as err:
            log_event(
                "voice_v3_forensics_checkpoint_failed",
                call_id=self.ctx.call_id or None,
                extra={"error": str(err)},
            )

    def _history_snapshot(self, session: Any) -> Any:
        try:
            history = getattr(session, "history", None)
            if history is None:
                return None
            if hasattr(history, "to_dict"):
                return history.to_dict()
            items = []
            for item in list(history):
                if hasattr(item, "model_dump"):
                    items.append(item.model_dump())
                else:
                    items.append(str(item)[:500])
            return items
        except Exception:
            return None

    def _session_report_snapshot(self, job_ctx: Any, session: Any) -> Any:
        try:
            report = job_ctx.make_session_report(session)
            if hasattr(report, "model_dump"):
                return report.model_dump()
            return json.loads(json.dumps(report, default=str))
        except Exception as err:
            return {"error": str(err)[:300]}

    async def flush(
        self,
        client: TransovoV3ToolClient,
        job_ctx: Any,
        session: Any | None,
        *,
        error_message: str | None = None,
    ) -> None:
        self.append("VOICE_V3_SESSION_END")
        history = self._history_snapshot(session) if session else None
        report = self._session_report_snapshot(job_ctx, session) if session else None
        usage = None
        if session is not None:
            try:
                usage = session.usage.model_dump() if hasattr(session.usage, "model_dump") else None
            except Exception:
                usage = None

        payload = {
            "events": self._events,
            "canonicalTurns": list(self._canonical_turns.values()),
            "sessionHistory": history,
            "sessionReport": report,
            "gptLiveUsage": self._gpt_live_usage,
            "backendLlmUsage": self._backend_llm_usage,
            "sessionUsage": usage,
            "gptLiveSessionId": self._gpt_live_session_id,
            "liveKitJobId": self.job_id,
            "roomName": self.room_name,
            "errorMessage": error_message,
        }
        try:
            await client.flush_forensics(**payload)
        except Exception as err:
            log_event(
                "voice_v3_forensics_flush_failed",
                call_id=self.ctx.call_id or None,
                extra={"error": str(err)},
            )
