"""LiveKit SIP participant call-status observation helpers."""

from __future__ import annotations

import asyncio
import re
from typing import TYPE_CHECKING, Any, Callable

from livekit.agents.utils.participant import wait_for_participant_attribute

if TYPE_CHECKING:
    from livekit import rtc

    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

SIP_CALL_STATUS_ATTR = "sip.callStatus"
SIP_CALL_STATUS_ACTIVE = "active"
SIP_CALL_STATUS_RINGING = "ringing"
SIP_CALL_STATUS_HANGUP = "hangup"

_SECRET_KEY = re.compile(r"password|secret|auth|token|credential", re.I)


def safe_participant_attributes(participant: "rtc.Participant") -> dict[str, str]:
    attrs = dict(participant.attributes or {})
    out: dict[str, str] = {}
    for key, value in attrs.items():
        if _SECRET_KEY.search(key):
            continue
        text = str(value)
        if len(text) > 300:
            text = f"{text[:300]}…"
        out[key] = text
    return out


def read_sip_call_status(participant: "rtc.Participant") -> str | None:
    return (participant.attributes or {}).get(SIP_CALL_STATUS_ATTR)


class SipCallStatusTracer:
    """Subscribe to real sip.callStatus transitions on a SIP participant."""

    def __init__(
        self,
        room: "rtc.Room",
        participant: "rtc.RemoteParticipant",
        *,
        trace: "MctbSipE2eTrace",
    ) -> None:
        self._room = room
        self._participant = participant
        self._trace = trace
        self._last_status = read_sip_call_status(participant)
        self._handler: Callable[[list[str], rtc.Participant], None] | None = None

    def log_initial(self) -> str | None:
        status = read_sip_call_status(self._participant)
        self._last_status = status
        self._trace.log(
            "sip_status_initial",
            sipCallStatus=status,
            participantId=self._participant.sid,
            participantIdentity=self._participant.identity,
            attributes=safe_participant_attributes(self._participant),
        )
        return status

    def start(self) -> None:
        if self._handler is not None:
            return

        def _on_attributes_changed(changed: list[str], p: "rtc.Participant") -> None:
            if p.sid != self._participant.sid:
                return
            if SIP_CALL_STATUS_ATTR not in changed and read_sip_call_status(p) == self._last_status:
                return

            new_status = read_sip_call_status(p)
            previous = self._last_status
            if new_status == previous:
                return

            self._last_status = new_status
            self._trace.log(
                "sip_status_changed",
                previousSipCallStatus=previous,
                sipCallStatus=new_status,
                participantId=p.sid,
                participantIdentity=p.identity,
                changedAttributes=changed,
                attributes=safe_participant_attributes(p),
            )

        self._handler = _on_attributes_changed
        self._room.on("participant_attributes_changed", _on_attributes_changed)

    def stop(self) -> None:
        if self._handler is None:
            return
        self._room.off("participant_attributes_changed", self._handler)
        self._handler = None

    @property
    def last_status(self) -> str | None:
        return self._last_status


async def wait_for_sip_call_status_active(
    room: "rtc.Room",
    participant: "rtc.RemoteParticipant",
    *,
    trace: "MctbSipE2eTrace",
    timeout_s: float = 15.0,
    status_tracer: SipCallStatusTracer | None = None,
) -> bool:
    """Wait until sip.callStatus is observed as active. Returns False on timeout."""
    current = read_sip_call_status(participant)
    if current == SIP_CALL_STATUS_ACTIVE:
        if status_tracer is not None:
            status_tracer._last_status = SIP_CALL_STATUS_ACTIVE
        return True

    try:
        await asyncio.wait_for(
            wait_for_participant_attribute(
                room,
                identity=participant.identity,
                attribute=SIP_CALL_STATUS_ATTR,
                value=SIP_CALL_STATUS_ACTIVE,
            ),
            timeout=timeout_s,
        )
        if status_tracer is not None:
            status_tracer._last_status = SIP_CALL_STATUS_ACTIVE
        return True
    except asyncio.TimeoutError:
        last_status = read_sip_call_status(participant)
        if status_tracer is not None:
            status_tracer._last_status = last_status
        trace.log(
            "sip_answer_timeout",
            lastSipCallStatus=last_status,
            timeoutSeconds=timeout_s,
            participantId=participant.sid,
            participantIdentity=participant.identity,
            attributes=safe_participant_attributes(participant),
        )
        trace.fail(stage="roomConnected", reason="SIP_PARTICIPANT_NEVER_ACTIVE")
        return False
    except Exception as err:
        last_status = read_sip_call_status(participant)
        trace.log(
            "sip_answer_timeout",
            lastSipCallStatus=last_status,
            timeoutSeconds=timeout_s,
            participantId=participant.sid,
            participantIdentity=participant.identity,
            error=str(err),
            attributes=safe_participant_attributes(participant),
        )
        trace.fail(stage="roomConnected", reason="SIP_PARTICIPANT_NEVER_ACTIVE")
        return False
