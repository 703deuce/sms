"""Unit tests for MCTB 571 SIP end-to-end trace."""

from __future__ import annotations

import asyncio
import json
from io import StringIO
from unittest.mock import MagicMock, patch

import pytest

from transovo_voice.session.mctb_sip_diagnostic import (
    MCTB_571_E164,
    is_mctb_571_sip_target,
)
from transovo_voice.session.mctb_sip_e2e_trace import (
    MctbSipE2eTrace,
    derive_correlation_id,
    is_correlation_already_handled,
    mark_correlation_handled,
    _handled_correlation_ids,
    _active_traces,
)

SYNTHETIC_CALLER = "+15550001001"
SYNTHETIC_OTHER_DID = "+15550001002"


@pytest.fixture(autouse=True)
def reset_trace_state():
    _handled_correlation_ids.clear()
    _active_traces.clear()
    yield
    _handled_correlation_ids.clear()
    _active_traces.clear()


def test_571_selects_mctb_branch():
    assert is_mctb_571_sip_target(MCTB_571_E164) is True
    assert is_mctb_571_sip_target("+15714073615") is True
    assert is_mctb_571_sip_target("5714073615") is True


def test_other_dids_do_not_select_mctb_branch():
    assert is_mctb_571_sip_target(SYNTHETIC_CALLER) is False
    assert is_mctb_571_sip_target(SYNTHETIC_OTHER_DID) is False
    assert is_mctb_571_sip_target(None) is False


def test_correlation_id_prefers_sip_call_id():
    cid = derive_correlation_id(
        {"sip.callId": "abc-123@telnyx"},
        room_name="room-1",
        job_id="job-1",
    )
    assert cid == "abc-123@telnyx"


def test_correlation_id_fallback():
    cid = derive_correlation_id({}, room_name="room-1", job_id="job-1")
    assert cid == "livekit:room-1:job-1"


def test_trace_logs_call_trace_summary(capsys):
    trace = MctbSipE2eTrace.create(
        correlation_id="abc@telnyx",
        job_id="job-1",
        room_name="room-1",
        from_e164=SYNTHETIC_CALLER,
        to_e164=MCTB_571_E164,
    )
    trace.mark_stage("telnyxInbound")
    trace.mark_stage("livekitSipReceived")
    trace.fail(stage="roomConnected", reason="WORKER_ROOM_CONNECT_TIMEOUT")

    asyncio.run(trace.finalize())

    output = capsys.readouterr().out
    assert "call_trace_summary" in output
    summary_line = [line for line in output.splitlines() if "call_trace_summary" in line][-1]
    payload = json.loads(summary_line)
    assert payload["source"] == "mctb-sip-e2e"
    assert payload["correlationId"] == "abc@telnyx"
    assert payload["lastSuccessfulStage"] == "livekitSipReceived"
    assert payload["failureStage"] == "roomConnected"
    assert payload["failureReason"] == "WORKER_ROOM_CONNECT_TIMEOUT"
    assert payload["stages"]["telnyxInboundMs"] >= 0


def test_duplicate_correlation_prevents_double_handler():
    mark_correlation_handled("dup@telnyx")
    assert is_correlation_already_handled("dup@telnyx") is True
    assert is_correlation_already_handled("other@telnyx") is False


@pytest.mark.asyncio
async def test_watchdog_emits_failure_stage():
    trace = MctbSipE2eTrace.create(
        correlation_id="watch@telnyx",
        job_id="job-2",
        room_name="room-2",
    )
    trace.mark_stage("telnyxInbound")
    trace.start_watchdog("room_connect", 0.05)

    await asyncio.sleep(0.15)
    assert trace.finalized is True
    assert trace.failure_reason == "WORKER_ROOM_CONNECT_TIMEOUT"


@pytest.mark.asyncio
async def test_mctb_diagnostic_skipped_on_duplicate():
    from transovo_voice.session.mctb_sip_diagnostic import run_mctb_sip_diagnostic_session

    mark_correlation_handled("dup2@telnyx")
    trace = MctbSipE2eTrace.create(
        correlation_id="dup2@telnyx",
        job_id="job-3",
        room_name="room-3",
        to_e164=MCTB_571_E164,
    )
    ctx = MagicMock()
    backend = MagicMock()
    participant = MagicMock()
    participant.sid = "PA_1"
    participant.identity = f"sip-{SYNTHETIC_CALLER}"

    with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
        await run_mctb_sip_diagnostic_session(
            ctx,
            backend,
            trace=trace,
            participant=participant,
            agent_name="transovo-voice-runtime",
        )
        output = mock_stdout.getvalue()
        assert "mctb_sip_diagnostic_skipped" in output
        assert "duplicate_correlation_id" in output
