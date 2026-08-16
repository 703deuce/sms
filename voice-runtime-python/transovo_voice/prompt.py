from __future__ import annotations

import logging

from transovo_voice.userdata import SessionUserData

logger = logging.getLogger("transovo-voice.prompt")

TRANSOVO_CONSTITUTION_MARKER = "TRANSOVO SYSTEM"

# Appended for publishes compiled before Python tool names were in GENERATED WORKFLOW RULES.
_PYTHON_TOOL_APPENDIX = """
PYTHON LIVEKIT RUNTIME TOOLS (same behaviors as booking/message/transfer rules above):
- start_booking — collect required booking fields, then call check_availability.
- check_availability — load live calendar slots before offering times.
- select_slot — record the caller's choice using a slot id from the offered list only.
- confirm_booking — commit only after explicit verbal confirmation of the exact time.
- take_message — callback/message intake (not field collection tools).
- transfer_to_human — warm transfer when policy allows.
- get_business_answer — long-tail business knowledge not in this prompt.
- end_call — graceful hangup when the caller is done.

Follow tool results and success/failure guidance the same way as TOOL_FEEDBACK rules above.
"""


def resolve_agent_instructions(ud: SessionUserData) -> str:
    """
    Agent instructions = published compiledPrompt (constitution + wizard layers).

    Built at publish by buildReceptionistCompiledPrompt() on transovo-web — same string the
    TypeScript runtime uses. Python does not rebuild or replace customer configuration.
    """
    prompt = (ud.compiled_prompt or "").strip()
    if not prompt:
        logger.error(
            "compiled_prompt missing for callId=%s — wizard publish may be stale",
            ud.call_id,
        )
        return (
            f"You are the phone receptionist for {ud.business_name}. "
            "Help callers professionally. This agent is misconfigured — compiled prompt was not loaded."
        )

    if TRANSOVO_CONSTITUTION_MARKER not in prompt:
        logger.warning(
            "compiled_prompt missing Transovo constitution marker callId=%s",
            ud.call_id,
        )

    if "start_booking" not in prompt and "schedule_appointment" in prompt:
        prompt = f"{prompt}\n\n{_PYTHON_TOOL_APPENDIX.strip()}"

    return prompt
