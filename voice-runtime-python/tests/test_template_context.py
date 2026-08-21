"""Template context merges wizard publish data into lab templates."""

from transovo_voice.templates.template_context import (
    build_template_instructions,
    build_minimal_user_context,
    resolve_greeting_instructions,
)
from transovo_voice.userdata import ManifestField, ReceptionistCompiled, SessionUserData


def _compiled_prompt() -> str:
    return "\n".join(
        [
            "TRANSOVO SYSTEM / GUARDRAILS",
            "BUSINESS",
            "Business name: Summit Plumbing",
            "About:",
            "Residential plumbing contractor.",
            "YOUR JOB",
            "- Answer incoming calls.",
        ],
    )


def test_build_template_instructions_uses_compiled_prompt() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Summit Plumbing",
        timezone="America/New_York",
        compiled_prompt=_compiled_prompt(),
    )
    instructions = build_template_instructions(
        ud,
        template_mode="livekit_basic_voice",
        template_role="Lab role",
        fallback_instructions="Fallback",
    )
    assert "Summit Plumbing" in instructions
    assert "TEMPLATE MODE: livekit_basic_voice" in instructions
    assert "Lab role" in instructions
    assert instructions != "Fallback"


def test_build_template_instructions_falls_back_when_empty() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="",
        timezone="America/New_York",
    )
    instructions = build_template_instructions(
        ud,
        template_mode="livekit_hotel_receptionist",
        template_role="Hotel lab",
        fallback_instructions="Default hotel assistant",
    )
    assert instructions == "Default hotel assistant"


def test_minimal_user_context_from_receptionist_snapshot() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Harbor Home Services",
        timezone="America/New_York",
        greeting="Hi, thanks for calling Harbor Home.",
        receptionist=ReceptionistCompiled(
            business_name="Harbor Home Services",
            agent_display_name="Amy",
            greeting="Hi, thanks for calling Harbor Home.",
            timezone="America/New_York",
            compiled_prompt="",
            field_manifest=[
                ManifestField(
                    id="name",
                    label="Name",
                    question="May I have your name?",
                    type="text",
                    required=True,
                ),
            ],
        ),
    )
    minimal = build_minimal_user_context(ud)
    assert "Harbor Home Services" in minimal
    assert "Amy" in minimal
    assert "Name" in minimal

    instructions = build_template_instructions(
        ud,
        template_mode="livekit_structured_intake",
        template_role="Collect fields",
        fallback_instructions="Fallback",
    )
    assert "Harbor Home Services" in instructions
    assert "Collect fields" in instructions


def test_resolve_greeting_instructions_prefers_configured_greeting() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test Co",
        timezone="America/New_York",
        greeting="Hello from Test Co, this is Amy.",
    )
    greeting = resolve_greeting_instructions(ud, fallback="Fallback greeting")
    assert "Hello from Test Co, this is Amy." in greeting
