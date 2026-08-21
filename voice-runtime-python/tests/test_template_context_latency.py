"""Template context latency helpers."""
from __future__ import annotations

import asyncio

from transovo_voice.templates.template_context import (
    build_template_instructions,
    deliver_template_greeting,
    is_lab_livekit_template,
    resolve_greeting_text,
)
from transovo_voice.userdata import ReceptionistCompiled, SessionUserData


def test_lab_template_uses_slim_instructions() -> None:
    ud = SessionUserData(
        workspace_id="ws",
        agent_id="agent",
        call_id="call",
        business_name="Test Co",
        timezone="America/New_York",
        compiled_prompt="FULL PROMPT " * 1000,
        greeting="Hello from Test Co",
        receptionist=ReceptionistCompiled(
            business_name="Test Co",
            agent_display_name="Amy",
            greeting="Hello from Test Co",
            timezone="America/New_York",
            compiled_prompt="FULL PROMPT " * 1000,
            field_manifest=[],
            agent_job_instructions="Book appointments",
            business_description="We help callers book",
        ),
    )
    instructions = build_template_instructions(
        ud,
        template_mode="livekit_frontdesk_booking",
        template_role="Use booking tools.",
        fallback_instructions="fallback",
    )
    assert "FULL PROMPT" not in instructions
    assert "Book appointments" in instructions
    assert "livekit_frontdesk_booking" in instructions


def test_resolve_greeting_text_prefers_ud_greeting() -> None:
    ud = SessionUserData(
        workspace_id="ws",
        agent_id="agent",
        call_id="call",
        business_name="Test Co",
        timezone="America/New_York",
        greeting="Configured greeting",
    )
    assert resolve_greeting_text(ud) == "Configured greeting"


def test_is_lab_template() -> None:
    assert is_lab_livekit_template("livekit_basic_voice") is True
    assert is_lab_livekit_template("transovo_receptionist_v1") is False


async def test_deliver_template_greeting_uses_generate_reply_on_native_realtime() -> None:
    calls: dict[str, object] = {}

    class FakeSession:
        tts = None

        async def generate_reply(self, **kwargs: object) -> None:
            calls["generate_reply"] = kwargs

        async def say(self, *_args: object, **_kwargs: object) -> None:
            calls["say"] = True

    ud = SessionUserData(
        workspace_id="ws",
        agent_id="agent",
        call_id="call",
        business_name="Test Co",
        timezone="America/New_York",
        greeting="Hi, thanks for calling Test Co.",
    )
    await deliver_template_greeting(
        FakeSession(),
        ud,
        fallback="fallback greeting",
    )
    assert "generate_reply" in calls
    assert "say" not in calls
    instructions = str((calls["generate_reply"] or {}).get("instructions", ""))  # type: ignore[union-attr]
    assert "Hi, thanks for calling Test Co." in instructions


if __name__ == "__main__":
    test_lab_template_uses_slim_instructions()
    test_resolve_greeting_text_prefers_ud_greeting()
    test_is_lab_template()
    asyncio.run(test_deliver_template_greeting_uses_generate_reply_on_native_realtime())
    print("test_template_context_latency: ok")
