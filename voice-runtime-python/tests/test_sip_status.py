"""Unit tests for SIP call-status observation."""

from __future__ import annotations

import asyncio
import json
from io import StringIO
from unittest.mock import MagicMock

import pytest

from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace, _active_traces, _handled_correlation_ids
from transovo_voice.session.sip_status import (
    SIP_CALL_STATUS_ACTIVE,
    SIP_CALL_STATUS_ATTR,
    SipCallStatusTracer,
    read_sip_call_status,
    safe_participant_attributes,
    wait_for_sip_call_status_active,
)


@pytest.fixture(autouse=True)
def reset_trace_state():
    _handled_correlation_ids.clear()
    _active_traces.clear()
    yield
    _handled_correlation_ids.clear()
    _active_traces.clear()


def test_read_sip_call_status():
    participant = MagicMock()
    participant.attributes = {SIP_CALL_STATUS_ATTR: "ringing"}
    assert read_sip_call_status(participant) == "ringing"


def test_safe_participant_attributes_redacts_secrets():
    participant = MagicMock()
    participant.attributes = {
        "sip.callStatus": "ringing",
        "sip.authToken": "secret-value",
    }
    attrs = safe_participant_attributes(participant)
    assert attrs["sip.callStatus"] == "ringing"
    assert "sip.authToken" not in attrs


def test_sip_status_tracer_logs_initial_and_changes(capsys):
    trace = MctbSipE2eTrace.create(
        correlation_id="cid@telnyx",
        job_id="job-1",
        room_name="room-1",
    )
    room = MagicMock()
    participant = MagicMock()
    participant.sid = "PA_1"
    participant.identity = "sip-caller"
    participant.attributes = {SIP_CALL_STATUS_ATTR: "ringing"}

    tracer = SipCallStatusTracer(room, participant, trace=trace)
    tracer.log_initial()
    tracer.start()

    handler = room.on.call_args[0][1]
    participant.attributes = {SIP_CALL_STATUS_ATTR: SIP_CALL_STATUS_ACTIVE}
    handler([SIP_CALL_STATUS_ATTR], participant)

    output = capsys.readouterr().out
    assert "sip_status_initial" in output
    assert "sip_status_changed" in output
    initial_line = [line for line in output.splitlines() if "sip_status_initial" in line][0]
    changed_line = [line for line in output.splitlines() if "sip_status_changed" in line][0]
    assert json.loads(initial_line)["sipCallStatus"] == "ringing"
    assert json.loads(changed_line)["sipCallStatus"] == SIP_CALL_STATUS_ACTIVE


def test_log_participant_active_requires_observed_active():
    trace = MctbSipE2eTrace.create(
        correlation_id="cid@telnyx",
        job_id="job-1",
        room_name="room-1",
    )
    with pytest.raises(ValueError, match="requires observed"):
        trace.log_participant_active(sip_call_status="ringing")

@pytest.mark.asyncio
async def test_wait_for_sip_call_status_active_times_out(capsys):
    trace = MctbSipE2eTrace.create(
        correlation_id="cid@telnyx",
        job_id="job-1",
        room_name="room-1",
    )
    room = MagicMock()
    room.isconnected.return_value = True
    participant = MagicMock()
    participant.sid = "PA_1"
    participant.identity = "sip-caller"
    participant.attributes = {SIP_CALL_STATUS_ATTR: "ringing"}
    room.remote_participants = {participant.identity: participant}

    result = await wait_for_sip_call_status_active(
        room,
        participant,
        trace=trace,
        timeout_s=0.05,
    )
    assert result is False
    output = capsys.readouterr().out
    assert "sip_answer_timeout" in output
    assert trace.failure_reason == "SIP_PARTICIPANT_NEVER_ACTIVE"


@pytest.mark.asyncio
async def test_wait_for_sip_call_status_active_returns_immediately_when_active():
    trace = MctbSipE2eTrace.create(
        correlation_id="cid@telnyx",
        job_id="job-1",
        room_name="room-1",
    )
    room = MagicMock()
    participant = MagicMock()
    participant.sid = "PA_1"
    participant.identity = "sip-caller"
    participant.attributes = {SIP_CALL_STATUS_ATTR: SIP_CALL_STATUS_ACTIVE}

    result = await wait_for_sip_call_status_active(
        room,
        participant,
        trace=trace,
        timeout_s=1.0,
    )
    assert result is True
