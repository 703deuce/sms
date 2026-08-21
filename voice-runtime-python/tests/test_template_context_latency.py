"""Template context latency helpers."""
from __future__ import annotations

from transovo_voice.templates.template_context import (
    build_template_instructions,
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


if __name__ == "__main__":
    test_lab_template_uses_slim_instructions()
    test_resolve_greeting_text_prefers_ud_greeting()
    test_is_lab_template()
    print("test_template_context_latency: ok")
