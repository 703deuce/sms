"""Commit resilience and idempotent booking tests."""

import asyncio
from unittest.mock import AsyncMock

import pytest

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.integrations.commit_client import (
    commit_booking_resilient,
    drain_pending_provider_tasks,
)
from transovo_voice.userdata import SessionUserData


@pytest.mark.asyncio
async def test_commit_booking_resilient_tracks_pending_task() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    backend = AsyncMock(spec=TransovoBackend)

    async def slow_commit(*_args, **_kwargs):
        await asyncio.sleep(0.05)
        return {"ok": True, "confirmationSpeech": "Done", "bookedTimeLabel": "Tuesday"}

    backend.call = AsyncMock(side_effect=slow_commit)

    result = await commit_booking_resilient(backend, ud, {"slotId": "s1"})
    assert result["ok"]
    assert len(ud.pending_provider_tasks) == 0


@pytest.mark.asyncio
async def test_drain_pending_provider_tasks_waits_for_inflight() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    completed = False

    async def slow():
        nonlocal completed
        await asyncio.sleep(0.05)
        completed = True
        return {"ok": True}

    task = asyncio.create_task(slow())
    ud.pending_provider_tasks.append(task)
    await drain_pending_provider_tasks(ud)
    assert completed


@pytest.mark.asyncio
async def test_commit_survives_client_shutdown_after_request_starts() -> None:
    """
    Simulates: HTTP commit accepted by backend while voice session teardown runs.
    Pending task must be drained on shutdown, not cancelled mid-flight.
    """
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    backend = AsyncMock(spec=TransovoBackend)
    backend_closed = False

    async def commit_with_delay(*_args, **_kwargs):
        await asyncio.sleep(0.08)
        return {
            "ok": True,
            "confirmationSpeech": "You're booked.",
            "bookedTimeLabel": "Tuesday 10am",
            "receiptPersisted": True,
        }

    async def close():
        nonlocal backend_closed
        backend_closed = True

    backend.call = AsyncMock(side_effect=commit_with_delay)
    backend.close = AsyncMock(side_effect=close)

    commit_task = asyncio.create_task(
        commit_booking_resilient(backend, ud, {"slotId": "slot-1"}),
    )
    await asyncio.sleep(0.02)
    await drain_pending_provider_tasks(ud)
    result = await commit_task
    assert result["ok"]
    assert result.get("receiptPersisted")
