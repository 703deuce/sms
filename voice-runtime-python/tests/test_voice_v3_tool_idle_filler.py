"""Tests for LiveKit idle-aware filler during Voice V3 FunctionTool execution."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

import pytest

from transovo_voice.voice_v3.tool_idle_filler import (
    FILLER_DELAY_SEC,
    FILLER_MAX_STEPS,
    build_tool_filler_source,
    execute_with_idle_filler,
)


def _mock_run_context() -> MagicMock:
    ctx = MagicMock()
    ctx.session.generate_reply.return_value = MagicMock(name="SpeechHandle")
    return ctx


@pytest.mark.asyncio
async def test_a_fast_tool_no_filler_fired() -> None:
    """Tool completes before idle dwell; filler source never runs."""
    ctx = _mock_run_context()
    filler_invocations: list[int] = []

    @asynccontextmanager
    async def recording_with_filler(source, *, delay=0, interval=None, max_steps=None):
        async def _maybe_fire() -> None:
            await asyncio.sleep(delay)
            filler_invocations.append(source(0))

        task = asyncio.create_task(_maybe_fire())
        try:
            yield
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    ctx.with_filler = recording_with_filler

    async def fast_execute() -> str:
        await asyncio.sleep(0.05)
        return "ok"

    with patch("transovo_voice.voice_v3.tool_idle_filler.FILLER_DELAY_SEC", 2.0):
        result = await execute_with_idle_filler(
            ctx,
            tool_name="find_availability",
            function_call_id="fc_1",
            execute=fast_execute,
        )

    assert result == "ok"
    assert filler_invocations == []
    ctx.session.generate_reply.assert_not_called()


@pytest.mark.asyncio
async def test_b_slow_idle_one_filler_handle() -> None:
    """Tool outlasts dwell; exactly one generate_reply filler."""
    ctx = _mock_run_context()
    filler_invocations: list[int] = []

    @asynccontextmanager
    async def recording_with_filler(source, *, delay=0, interval=None, max_steps=None):
        async def _maybe_fire() -> None:
            await asyncio.sleep(delay)
            filler_invocations.append(source(0))

        task = asyncio.create_task(_maybe_fire())
        try:
            yield
        finally:
            await task

    ctx.with_filler = recording_with_filler

    async def slow_execute() -> dict[str, str]:
        await asyncio.sleep(2.5)
        return {"slots": []}

    with patch("transovo_voice.voice_v3.tool_idle_filler.FILLER_DELAY_SEC", 0.2):
        result = await execute_with_idle_filler(
            ctx,
            tool_name="book_appointment",
            function_call_id="fc_book",
            execute=slow_execute,
        )

    assert result == {"slots": []}
    assert len(filler_invocations) == 1
    ctx.session.generate_reply.assert_called_once()
    kwargs = ctx.session.generate_reply.call_args.kwargs
    assert kwargs["tool_choice"] == "none"
    assert kwargs["allow_interruptions"] is True
    assert "still working" in kwargs["instructions"].lower()


@pytest.mark.asyncio
async def test_c_filler_source_uses_generate_reply_not_say() -> None:
    """Filler path must use GPT-Live generate_reply (no session.say / TTS)."""
    ctx = _mock_run_context()
    source = build_tool_filler_source(
        ctx,
        tool_name="find_availability",
        function_call_id="fc_x",
    )
    handle = source(0)
    assert handle is ctx.session.generate_reply.return_value
    ctx.session.say.assert_not_called()


@pytest.mark.asyncio
async def test_d_build_tool_filler_marks_callback() -> None:
    """Filler request callback fires when source is invoked."""
    ctx = _mock_run_context()
    marks: list[bool] = []

    source = build_tool_filler_source(
        ctx,
        tool_name="update_intake",
        function_call_id=None,
        on_filler_requested=lambda: marks.append(True),
    )
    source(0)
    assert marks == [True]


@pytest.mark.asyncio
async def test_e_max_one_filler_per_invocation_with_livekit_defaults() -> None:
    """Wrapper passes interval=None and max_steps=1 to with_filler."""
    ctx = _mock_run_context()
    captured: dict[str, object] = {}

    @asynccontextmanager
    async def capture_with_filler(source, *, delay=0, interval=None, max_steps=None):
        captured["delay"] = delay
        captured["interval"] = interval
        captured["max_steps"] = max_steps
        yield

    ctx.with_filler = capture_with_filler

    await execute_with_idle_filler(
        ctx,
        tool_name="find_availability",
        function_call_id="fc",
        execute=lambda: asyncio.sleep(0),
    )

    assert captured["delay"] == FILLER_DELAY_SEC
    assert captured["interval"] is None
    assert captured["max_steps"] == FILLER_MAX_STEPS


@pytest.mark.asyncio
async def test_f_tool_failure_propagates_after_filler() -> None:
    """Tool errors are unchanged; filler does not swallow exceptions."""
    ctx = _mock_run_context()

    @asynccontextmanager
    async def immediate_filler(source, *, delay=0, interval=None, max_steps=None):
        source(0)
        yield

    ctx.with_filler = immediate_filler

    async def failing_execute() -> None:
        raise ValueError("booking failed")

    with pytest.raises(ValueError, match="booking failed"):
        await execute_with_idle_filler(
            ctx,
            tool_name="book_appointment",
            function_call_id="fc_fail",
            execute=failing_execute,
        )

    ctx.session.generate_reply.assert_called_once()


@pytest.mark.asyncio
async def test_livekit_scheduler_resets_dwell_on_agent_speaking() -> None:
    """Agent speaking/thinking resets idle dwell (LiveKit _FillerScheduler contract)."""
    from livekit.agents.voice.filler_scheduler import _FillerScheduler

    session = MagicMock()
    speech_handle = MagicMock()
    speech_handle.wait_if_not_interrupted = lambda tasks: asyncio.sleep(0)

    async def idle_forever() -> None:
        while True:
            await asyncio.sleep(3600)

    session.wait_for_idle = idle_forever

    fired: list[int] = []

    def source(step: int) -> None:
        fired.append(step)
        return None

    scheduler = _FillerScheduler(
        source,
        session=session,
        speech_handle=speech_handle,
        delay=0.05,
        interval=None,
        max_steps=1,
    )

    await asyncio.sleep(0.02)
    scheduler.reset_dwell()
    await asyncio.sleep(0.15)
    await scheduler.aclose()

    assert fired == []
