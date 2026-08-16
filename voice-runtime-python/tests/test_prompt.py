"""Prompt injection tests — compiled wizard prompt must reach Amy unchanged."""

from transovo_voice.prompt import (
    TRANSOVO_CONSTITUTION_MARKER,
    resolve_agent_instructions,
)
from transovo_voice.userdata import SessionUserData

_CONSTITUTION_SNIPPET = "TRANSOVO SYSTEM / GUARDRAILS"
_USER_SNIPPET = "Summit Electric Services"
_JOB_SNIPPET = "YOUR JOB"
_BUSINESS_SNIPPET = "BUSINESS"
_CONFIG_SNIPPET = "CALL CONFIGURATION"
_RULES_SNIPPET = "GENERATED WORKFLOW RULES"


def _full_compiled_prompt() -> str:
    return "\n".join(
        [
            _CONSTITUTION_SNIPPET,
            "ROLE",
            "AGENT",
            "Name: Sarah",
            _BUSINESS_SNIPPET,
            f"Business name: {_USER_SNIPPET}",
            "About:",
            "Residential electrical contractor.",
            _JOB_SNIPPET,
            "- Answer incoming calls.",
            _CONFIG_SNIPPET,
            "Booking: yes",
            _RULES_SNIPPET,
            "Booking appointments:",
            "- Call start_booking to run intake for required fields, then check_availability.",
        ],
    )


def test_uses_full_compiled_prompt_from_publish() -> None:
    compiled = _full_compiled_prompt()
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Summit Electric Services",
        timezone="America/New_York",
        compiled_prompt=compiled,
    )
    instructions = resolve_agent_instructions(ud)
    assert instructions == compiled
    assert TRANSOVO_CONSTITUTION_MARKER in instructions
    assert _USER_SNIPPET in instructions
    assert _JOB_SNIPPET in instructions


def test_legacy_typescript_prompt_gets_python_tool_appendix() -> None:
    legacy = "\n".join(
        [
            _CONSTITUTION_SNIPPET,
            _RULES_SNIPPET,
            "- After schedule_appointment succeeds, stop.",
        ],
    )
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
        compiled_prompt=legacy,
    )
    instructions = resolve_agent_instructions(ud)
    assert "schedule_appointment" in instructions
    assert "start_booking" in instructions
    assert "PYTHON LIVEKIT RUNTIME TOOLS" in instructions
