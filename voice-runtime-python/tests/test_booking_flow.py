"""Tests for booking workflow helpers."""

from unittest.mock import AsyncMock

import pytest

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.userdata import SessionUserData, WorkflowState
from transovo_voice.workflows.booking_flow import fetch_availability_for_session


@pytest.mark.asyncio
async def test_fetch_availability_stages_slots() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    backend = AsyncMock(spec=TransovoBackend)
    backend.call = AsyncMock(
        return_value={
            "ok": True,
            "slots": [
                {
                    "slotId": "slot-1",
                    "startTimeIso": "2026-08-20T10:00:00Z",
                    "durationMin": 30,
                    "spokenLabel": "Tuesday at 10am",
                },
            ],
            "linesForModel": "Tuesday at 10am",
        },
    )

    ok, message = await fetch_availability_for_session(backend, ud)
    assert ok
    assert "Tuesday at 10am" in message
    assert ud.workflow == WorkflowState.BOOKING_SELECT
    assert len(ud.offered_slots) == 1
    assert ud.offered_slots[0].slot_id == "slot-1"


@pytest.mark.asyncio
async def test_fetch_availability_failure() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    backend = AsyncMock(spec=TransovoBackend)
    backend.call = AsyncMock(return_value={"ok": False, "error": "calendly down"})

    ok, message = await fetch_availability_for_session(backend, ud)
    assert not ok
    assert "calendar" in message.lower()
