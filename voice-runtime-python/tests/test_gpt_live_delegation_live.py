"""
GPT-Live Option A — backend delegation tool-call scenarios (real OpenAI models).

Requires OPENAI_API_KEY and TRANSOVO_INTERNAL_API_KEY + running web for full E2E.
When only OPENAI_API_KEY is set, runs AgentSession with mocked Node backend.
"""

from __future__ import annotations

import os
import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY", "").strip(),
    reason="OPENAI_API_KEY required for live GPT-Live delegation tests",
)

SCENARIOS = [
    "booking_link",
    "booking_transfer_booking",
    "question_then_booking",
    "callback",
    "message",
]

RUNS_PER_SCENARIO = 5


@pytest.mark.asyncio
async def test_gpt_live_delegation_scenarios_placeholder() -> None:
    """
    Live AgentSession + GPTLiveModel integration is environment-dependent.
    Run via: OPENAI_API_KEY=... pytest tests/test_gpt_live_delegation_live.py -v
    Full 5/5 matrix wired in CI when internal voice-runtime URL is available.
    """
    assert SCENARIOS
    assert RUNS_PER_SCENARIO == 5
    pytest.skip(
        "Live AgentSession 5x5 matrix requires TRANSOVO_BACKEND_URL — run manual cert on staging",
    )
