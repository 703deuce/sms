"""End-to-end SIP diagnostic trace for MCTB 571 (+15714073615)."""

from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from livekit.agents import JobContext
    from livekit import rtc

LOG_SOURCE = "mctb-sip-e2e"
MCTB_571_E164 = "+15714073615"
DIAGNOSTIC_PHRASE = "Transovo SIP diagnostic connected."

_SECRET_KEY = re.compile(r"password|secret|auth|token|credential", re.I)

STAGE_ORDER = [
    "telnyxInbound",
    "livekitSipReceived",
    "dispatch",
    "roomReady",
    "participantJoined",
    "jobDispatched",
    "workerReceived",
    "roomConnected",
    "diagnosticStarted",
    "audioStarted",
    "audioCompleted",
    "disconnect",
]

WATCHDOG_FAILURES = {
    "sip_participant": "SIP_PARTICIPANT_NOT_CREATED",
    "room_connect": "WORKER_ROOM_CONNECT_TIMEOUT",
    "participant_active": "SIP_PARTICIPANT_NEVER_ACTIVE",
    "diagnostic_audio": "DIAGNOSTIC_AUDIO_TIMEOUT",
    "job_received": "WORKER_JOB_NOT_RECEIVED",
}

_active_traces: dict[str, MctbSipE2eTrace] = {}
_handled_correlation_ids: set[str] = set()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_attrs(attrs: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in attrs.items():
        if _SECRET_KEY.search(key):
            continue
        text = str(value)
        if len(text) > 300:
            text = f"{text[:300]}…"
        out[key] = text
    return out


def _extract_forwarded(attrs: dict[str, str]) -> str | None:
    for key, value in attrs.items():
        lowered = key.lower()
        if "diversion" in lowered or "forward" in lowered or "history-info" in lowered:
            return str(value)[:300]
    return None


def derive_correlation_id(attrs: dict[str, str], *, room_name: str, job_id: str) -> str:
    sip_call_id = (
        attrs.get("sip.callId")
        or attrs.get("sip.call-id")
        or attrs.get("sip.callID")
    )
    if sip_call_id:
        return str(sip_call_id).strip()
    return f"livekit:{room_name}:{job_id}"


def is_correlation_already_handled(correlation_id: str) -> bool:
    return correlation_id in _handled_correlation_ids


def mark_correlation_handled(correlation_id: str) -> None:
    _handled_correlation_ids.add(correlation_id)


@dataclass
class MctbSipE2eTrace:
    correlation_id: str
    job_id: str
    room_name: str
    room_sid: str | None = None
    participant_id: str | None = None
    participant_identity: str | None = None
    from_e164: str | None = None
    to_e164: str | None = None
    forwarded_from: str | None = None
    sip_attrs: dict[str, str] = field(default_factory=dict)
    t0: float = field(default_factory=time.perf_counter)
    stage_ms: dict[str, int] = field(default_factory=dict)
    last_successful_stage: str | None = None
    failure_stage: str | None = None
    failure_reason: str | None = None
    finalized: bool = False
    _watchdog_tasks: list[asyncio.Task[Any]] = field(default_factory=list, repr=False)
    _backend_report: Any | None = field(default=None, repr=False)

    @classmethod
    def create(
        cls,
        *,
        correlation_id: str,
        job_id: str,
        room_name: str,
        room_sid: str | None = None,
        attrs: dict[str, str] | None = None,
        from_e164: str | None = None,
        to_e164: str | None = None,
        backend_report: Any | None = None,
    ) -> MctbSipE2eTrace:
        attrs = attrs or {}
        trace = cls(
            correlation_id=correlation_id,
            job_id=job_id,
            room_name=room_name,
            room_sid=room_sid,
            from_e164=from_e164,
            to_e164=to_e164,
            forwarded_from=_extract_forwarded(attrs),
            sip_attrs=_safe_attrs(attrs),
            _backend_report=backend_report,
        )
        _active_traces[correlation_id] = trace
        return trace

    @classmethod
    def get(cls, correlation_id: str) -> MctbSipE2eTrace | None:
        return _active_traces.get(correlation_id)

    def _elapsed_ms(self) -> int:
        return int((time.perf_counter() - self.t0) * 1000)

    def mark_stage(self, stage: str) -> None:
        if stage not in self.stage_ms:
            self.stage_ms[stage] = self._elapsed_ms()
        self.last_successful_stage = stage

    def fail(self, *, stage: str, reason: str) -> None:
        self.failure_stage = stage
        self.failure_reason = reason

    def log(self, event: str, **fields: Any) -> None:
        payload: dict[str, Any] = {
            "source": LOG_SOURCE,
            "event": event,
            "timestamp": _now_iso(),
            "correlationId": self.correlation_id,
            "jobId": self.job_id,
            "roomName": self.room_name,
        }
        if self.room_sid:
            payload["roomSid"] = self.room_sid
        if self.participant_id:
            payload["participantId"] = self.participant_id
        if self.participant_identity:
            payload["participantIdentity"] = self.participant_identity
        if self.from_e164:
            payload["fromE164"] = self.from_e164
        if self.to_e164:
            payload["toE164"] = self.to_e164
        if self.forwarded_from:
            payload["forwardedFrom"] = self.forwarded_from
        payload.update(fields)
        print(json.dumps(payload, default=str), flush=True)
        if self._backend_report is not None:
            asyncio.create_task(self._backend_report(event, payload))

    def log_telnyx_sip_inbound_seen(self) -> None:
        attrs = self.sip_attrs
        self.mark_stage("telnyxInbound")
        self.log(
            "telnyx_sip_inbound_seen",
            sipCallId=self.correlation_id,
            **{"from": self.from_e164},
            **{"to": self.to_e164},
            diversion=self.forwarded_from,
            forwardedFrom=self.forwarded_from,
            requestUri=attrs.get("sip.requestUri") or attrs.get("sip.request-uri"),
            transport=attrs.get("sip.transport") or attrs.get("sip.via"),
            contentLength=attrs.get("sip.contentLength") or attrs.get("sip.content-length"),
            contentType=attrs.get("sip.contentType") or attrs.get("sip.content-type"),
            hasSdp=attrs.get("sip.hasSdp") or attrs.get("sip.inviteHasSdp"),
            supported=attrs.get("sip.supported"),
            require=attrs.get("sip.require"),
            pEarlyMedia=attrs.get("sip.pEarlyMedia") or attrs.get("sip.PEarlyMedia"),
            contact=attrs.get("sip.contact"),
            userAgent=attrs.get("sip.userAgent") or attrs.get("sip.user-agent"),
            server=attrs.get("sip.server"),
            note="earliest_observable_point_livekit_sip_ingress",
        )

    def log_telnyx_to_livekit_invite_attempted(self) -> None:
        attrs = self.sip_attrs
        self.log(
            "telnyx_to_livekit_invite_attempted",
            provider_trace_only=True,
            targetFqdn=attrs.get("sip.trunkHost") or "sms-6w01zoya.sip.livekit.cloud",
            targetSipUri=attrs.get("sip.requestUri"),
            calledDid=self.to_e164,
            callerAni=self.from_e164,
            sipCallId=self.correlation_id,
            transport=attrs.get("sip.transport"),
            codecs=attrs.get("sip.codecs"),
            hasOutboundSdp=attrs.get("sip.hasSdp"),
            note="not_observable_from_application_code",
        )

    def log_livekit_sip_session_received(self, participant: "rtc.RemoteParticipant") -> None:
        self.participant_id = participant.sid
        self.participant_identity = participant.identity
        attrs = dict(participant.attributes or {})
        self.sip_attrs = _safe_attrs(attrs)
        self.mark_stage("livekitSipReceived")
        self.log(
            "livekit_sip_session_received",
            sipParticipantId=participant.sid,
            participantIdentity=participant.identity,
            participantName=participant.name,
            roomName=self.room_name,
            roomSid=self.room_sid,
            **{"from": self.from_e164},
            **{"to": self.to_e164},
            trunkId=attrs.get("sip.trunkId") or attrs.get("sip.trunkID"),
            dispatchRuleId=attrs.get("sip.dispatchRuleId") or attrs.get("sip.ruleId"),
            metadata=attrs.get("sip.metadata"),
            attributes=_safe_attrs(attrs),
            callStatus=attrs.get("sip.callStatus") or attrs.get("sip.status"),
            sipCallId=attrs.get("sip.callId") or attrs.get("sip.call-id") or self.correlation_id,
        )
        self.log("sip_participant_created", sipCallStatus=attrs.get("sip.callStatus"))
        self.log("sip_participant_joining", sipCallStatus=attrs.get("sip.callStatus"))

    def log_dispatch_evaluated(self, *, agent_name: str) -> None:
        self.mark_stage("dispatch")
        self.log(
            "livekit_dispatch_evaluated",
            toE164=self.to_e164,
            fromE164=self.from_e164,
            matched=True,
            dispatchRuleId=self.sip_attrs.get("sip.dispatchRuleId"),
            dispatchTarget=agent_name,
            roomName=self.room_name,
            agentName=agent_name,
            explicitWorkspaceId=None,
            explicitAgentId=None,
            mctb_sip_route_selected=True,
            reasonIfNotMatched=None,
            note="571_bypasses_ai_dispatch_worker_branch",
        )
        self.mark_stage("jobDispatched")
        self.log(
            "livekit_job_dispatched",
            jobId=self.job_id,
            roomName=self.room_name,
            roomSid=self.room_sid,
            participantIdentity=self.participant_identity,
            targetWorker=agent_name,
            dispatchRuleId=self.sip_attrs.get("sip.dispatchRuleId"),
            createdAt=_now_iso(),
        )

    def log_room_ready(self, *, created_new: bool, participant_count: int) -> None:
        self.mark_stage("roomReady")
        self.log(
            "livekit_room_ready",
            roomName=self.room_name,
            roomSid=self.room_sid,
            createdNew=created_new,
            participantCount=participant_count,
            sipParticipantExpected=True,
        )

    def log_room_missing(self, reason: str) -> None:
        self.fail(stage="roomReady", reason=reason)
        self.log("livekit_room_missing", reason=reason)

    def log_participant_joined(self) -> None:
        self.mark_stage("participantJoined")
        self.log(
            "sip_participant_joined",
            participantId=self.participant_id,
            participantIdentity=self.participant_identity,
            roomName=self.room_name,
            roomSid=self.room_sid,
            sipCallStatus=self.sip_attrs.get("sip.callStatus"),
        )

    def log_participant_active(self) -> None:
        self.log(
            "sip_participant_active",
            participantId=self.participant_id,
            participantIdentity=self.participant_identity,
            roomName=self.room_name,
            roomSid=self.room_sid,
            sipCallStatus="active",
        )

    def log_worker_job_received(self) -> None:
        self.mark_stage("workerReceived")
        self.log(
            "worker_job_received",
            jobId=self.job_id,
            roomName=self.room_name,
            roomSid=self.room_sid,
            participantIdentity=self.participant_identity,
            participantId=self.participant_id,
            sipCallId=self.correlation_id,
        )

    def log_worker_room_connect_start(self) -> None:
        self.log("worker_room_connect_start", jobId=self.job_id)

    def log_worker_room_connected(self, elapsed_ms: int) -> None:
        self.mark_stage("roomConnected")
        self.log(
            "worker_room_connected",
            jobId=self.job_id,
            roomName=self.room_name,
            roomSid=self.room_sid,
            elapsedMs=elapsed_ms,
        )

    def log_worker_room_connect_failed(self, *, elapsed_ms: int, error: str) -> None:
        self.fail(stage="roomConnected", reason=error)
        self.log(
            "worker_room_connect_failed",
            jobId=self.job_id,
            roomName=self.room_name,
            roomSid=self.room_sid,
            elapsedMs=elapsed_ms,
            error=error,
        )

    def log_mctb_diagnostic_started(self) -> None:
        self.mark_stage("diagnosticStarted")
        self.log(
            "mctb_sip_diagnostic_started",
            toE164=self.to_e164,
            fromE164=self.from_e164,
            forwardedFrom=self.forwarded_from,
            roomName=self.room_name,
            participantId=self.participant_id,
            jobId=self.job_id,
        )

    def log_mctb_diagnostic_skipped(self, reason: str) -> None:
        self.log("mctb_sip_diagnostic_skipped", reason=reason)

    def log_diagnostic_audio_start(self) -> None:
        self.mark_stage("audioStarted")
        self.log(
            "diagnostic_audio_start",
            roomName=self.room_name,
            participantId=self.participant_id,
            jobId=self.job_id,
        )

    def log_diagnostic_audio_complete(self) -> None:
        self.mark_stage("audioCompleted")
        self.log(
            "diagnostic_audio_complete",
            roomName=self.room_name,
            participantId=self.participant_id,
            jobId=self.job_id,
        )

    def log_diagnostic_audio_failed(self, error: str) -> None:
        self.fail(stage="audioStarted", reason=error)
        self.log(
            "diagnostic_audio_failed",
            roomName=self.room_name,
            participantId=self.participant_id,
            jobId=self.job_id,
            error=error,
        )

    def log_sip_call_final_state(
        self,
        *,
        disconnect_reason: str,
        sip_status: str | None = None,
    ) -> None:
        self.mark_stage("disconnect")
        self.log(
            "sip_call_final_state",
            sipCallId=self.correlation_id,
            roomName=self.room_name,
            participantId=self.participant_id,
            jobId=self.job_id,
            disconnectReason=disconnect_reason,
            sipStatus=sip_status,
            elapsedMs=self._elapsed_ms(),
        )

    def log_job_not_dispatched(self, reason: str) -> None:
        self.fail(stage="jobDispatched", reason=reason)
        self.log(
            "livekit_job_not_dispatched",
            reason=reason,
            roomName=self.room_name,
            participantIdentity=self.participant_identity,
            matchedRule=self.sip_attrs.get("sip.dispatchRuleId"),
        )

    def log_watchdog_failure(self, watchdog_key: str) -> None:
        reason = WATCHDOG_FAILURES.get(watchdog_key, watchdog_key.upper())
        self.fail(stage=self.last_successful_stage or "telnyxInbound", reason=reason)
        self.log(
            "mctb_sip_watchdog_timeout",
            watchdog=watchdog_key,
            failureReason=reason,
            lastSuccessfulStage=self.last_successful_stage,
            elapsedMs=self._elapsed_ms(),
        )

    def _cancel_watchdogs(self) -> None:
        for task in self._watchdog_tasks:
            if not task.done():
                task.cancel()
        self._watchdog_tasks.clear()

    def start_watchdog(self, key: str, timeout_s: float) -> None:
        async def _watch() -> None:
            try:
                await asyncio.sleep(timeout_s)
                if not self.finalized:
                    self.log_watchdog_failure(key)
                    await self.finalize()
            except asyncio.CancelledError:
                pass

        self._watchdog_tasks.append(asyncio.create_task(_watch()))

    def start_standard_watchdogs(self) -> None:
        self.start_watchdog("room_connect", 15.0)
        self.start_watchdog("participant_active", 15.0)
        self.start_watchdog("diagnostic_audio", 20.0)

    async def finalize(self) -> None:
        if self.finalized:
            return
        self.finalized = True
        self._cancel_watchdogs()
        summary_stages = {
            "telnyxInboundMs": self.stage_ms.get("telnyxInbound", -1),
            "livekitSipReceivedMs": self.stage_ms.get("livekitSipReceived", -1),
            "dispatchMs": self.stage_ms.get("dispatch", -1),
            "participantJoinedMs": self.stage_ms.get("participantJoined", -1),
            "jobDispatchedMs": self.stage_ms.get("jobDispatched", -1),
            "workerReceivedMs": self.stage_ms.get("workerReceived", -1),
            "roomConnectedMs": self.stage_ms.get("roomConnected", -1),
            "audioStartedMs": self.stage_ms.get("audioStarted", -1),
        }
        self.log(
            "call_trace_summary",
            stages=summary_stages,
            lastSuccessfulStage=self.last_successful_stage,
            failureStage=self.failure_stage,
            failureReason=self.failure_reason,
        )
        _active_traces.pop(self.correlation_id, None)


async def make_backend_reporter(backend: Any) -> Any:
    async def _report(event: str, payload: dict[str, Any]) -> None:
        try:
            await backend.call(
                "mctb_sip_e2e_trace",
                {"event": event, "payload": payload},
            )
        except Exception:
            pass

    return _report


def extract_job_id(ctx: "JobContext") -> str:
    job = getattr(ctx, "job", None)
    if job is not None:
        for attr in ("id", "job_id", "jid"):
            value = getattr(job, attr, None)
            if value:
                return str(value)
    return ctx.room.name
