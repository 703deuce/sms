"""Per-turn response latency telemetry."""
from __future__ import annotations

import asyncio
import time
from transovo_voice.observability.call_metrics import CallObservability
from transovo_voice.userdata import SessionUserData


class FakeBackend:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def call(self, action: str, payload: dict) -> dict:
        self.calls.append({"action": action, "payload": payload})
        return {"ok": True}


async def _drain_tasks() -> None:
    await asyncio.sleep(0.05)


async def test_record_turn_response_tracks_user_latency() -> None:
    backend = FakeBackend()
    started = time.perf_counter()
    obs = CallObservability(
        ud=SessionUserData(
            workspace_id="ws",
            agent_id="agent",
            call_id="call",
            business_name="Test",
            timezone="America/New_York",
        ),
        backend=backend,  # type: ignore[arg-type]
        template_id="livekit_frontdesk_booking",
        job_started_at=started,
    )

    obs._last_user_speech_at = time.perf_counter() - 0.75
    await obs.record_turn_response(
        source="conversation_item_added",
        proactive=False,
        lk_metrics={"e2e_latency": 0.82},
    )
    await _drain_tasks()

    turn_payloads = [
        c["payload"]
        for c in backend.calls
        if c["action"] == "record_call_telemetry" and c["payload"].get("kind") == "turn_response"
    ]
    assert len(turn_payloads) == 1
    metrics = turn_payloads[0]["metrics"]
    assert metrics["turnNumber"] == 1
    assert metrics["userToAgentResponseMs"] == 820
    assert metrics["e2eLatencyMs"] == 820


async def test_proactive_greeting_turn_has_no_user_latency() -> None:
    backend = FakeBackend()
    obs = CallObservability(
        ud=SessionUserData(
            workspace_id="ws",
            agent_id="agent",
            call_id="call",
            business_name="Test",
            timezone="America/New_York",
        ),
        backend=backend,  # type: ignore[arg-type]
        template_id="livekit_basic_voice",
        job_started_at=time.perf_counter(),
    )

    await obs.record_turn_response(source="conversation_item_added", proactive=True)
    await _drain_tasks()

    metrics = [
        c["payload"]["metrics"]
        for c in backend.calls
        if c["payload"].get("kind") == "turn_response"
    ][0]
    assert metrics["userToAgentResponseMs"] is None
    assert metrics["proactive"] is True


async def test_finalize_includes_turn_summary() -> None:
    backend = FakeBackend()
    obs = CallObservability(
        ud=SessionUserData(
            workspace_id="ws",
            agent_id="agent",
            call_id="call",
            business_name="Test",
            timezone="America/New_York",
        ),
        backend=backend,  # type: ignore[arg-type]
        template_id="livekit_basic_voice",
        job_started_at=time.perf_counter(),
    )
    obs._last_user_speech_at = time.perf_counter() - 0.5
    await obs.record_turn_response(
        source="conversation_item_added",
        lk_metrics={"e2e_latency": 0.55},
    )
    await _drain_tasks()
    await obs.finalize()

    summary_payloads = [
        c["payload"]
        for c in backend.calls
        if c["action"] == "record_call_telemetry" and c["payload"].get("kind") == "call_summary"
    ]
    assert summary_payloads
    metrics = summary_payloads[-1]["metrics"]
    assert metrics["turnCount"] == 1
    assert metrics["avgUserToAgentResponseMs"] == 550


async def _main() -> None:
    await test_record_turn_response_tracks_user_latency()
    await test_proactive_greeting_turn_has_no_user_latency()
    await test_finalize_includes_turn_summary()
    print("test_call_metrics_turns: ok")


if __name__ == "__main__":
    asyncio.run(_main())
