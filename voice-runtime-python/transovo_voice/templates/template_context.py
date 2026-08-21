from __future__ import annotations

import asyncio

from transovo_voice.prompt import resolve_agent_instructions
from transovo_voice.templates.registry import AGENT_TEMPLATES, COMPOSED_RECEPTIONIST_TEMPLATE
from transovo_voice.userdata import ManifestField, SessionUserData

_DEFAULT_BUSINESS = "our office"


def has_compiled_prompt(ud: SessionUserData) -> bool:
    return bool((ud.compiled_prompt or "").strip())


def agent_display_name(ud: SessionUserData) -> str:
    if ud.receptionist and ud.receptionist.agent_display_name.strip():
        return ud.receptionist.agent_display_name.strip()
    return "Receptionist"


def resolved_business_name(ud: SessionUserData) -> str:
    name = (ud.business_name or "").strip()
    if name and name.lower() not in {"our office", "our business", "the business"}:
        return name
    if ud.receptionist and ud.receptionist.business_name.strip():
        return ud.receptionist.business_name.strip()
    return ""


def is_lab_livekit_template(template_mode: str) -> bool:
    """Lab templates use slim runtime instructions — not the full published constitution."""
    if template_mode == COMPOSED_RECEPTIONIST_TEMPLATE:
        return False
    record = AGENT_TEMPLATES.get(template_mode)
    return record is not None and record.status == "IMPLEMENTED"


def resolve_greeting_text(ud: SessionUserData) -> str:
    greeting = (ud.greeting or "").strip()
    if not greeting and ud.receptionist:
        greeting = (ud.receptionist.greeting or "").strip()
    return greeting


def resolve_greeting_instructions(ud: SessionUserData, *, fallback: str) -> str:
    greeting = resolve_greeting_text(ud)
    if greeting:
        return (
            "Say exactly this greeting to the caller (warm and natural): "
            f"{greeting}"
        )

    business = resolved_business_name(ud)
    if business:
        return (
            f"Welcome the caller to {business}. "
            "Ask how you can help today. Keep it brief."
        )
    return fallback


async def deliver_template_greeting(
    session: object,
    ud: SessionUserData,
    *,
    fallback: str,
    observability: object | None = None,
) -> None:
    """Speak a configured greeting immediately; avoid an LLM round trip when text exists."""
    greeting = resolve_greeting_text(ud)
    if greeting:
        await session.say(greeting, allow_interruptions=True)  # type: ignore[attr-defined]
    else:
        await session.generate_reply(  # type: ignore[attr-defined]
            instructions=resolve_greeting_instructions(ud, fallback=fallback),
        )
    if observability is not None:
        asyncio.create_task(
            observability.mark_first_agent_response(source="greeting"),  # type: ignore[attr-defined]
        )


def build_minimal_user_context(ud: SessionUserData) -> str:
    lines: list[str] = []
    business = resolved_business_name(ud)
    agent = agent_display_name(ud)

    if business:
        lines.append(f"Business name: {business}")
        lines.append(f"You are {agent}, the phone receptionist for {business}.")

    if ud.receptionist:
        description = (ud.receptionist.business_description or "").strip()
        if description:
            lines.append(f"About the business: {description}")
        job = (ud.receptionist.agent_job_instructions or "").strip()
        if job:
            lines.append(f"Your job: {job}")
    elif agent and agent != "Receptionist":
        lines.append(f"You are {agent}.")

    greeting = (ud.greeting or "").strip()
    if not greeting and ud.receptionist:
        greeting = (ud.receptionist.greeting or "").strip()
    if greeting:
        lines.append(f"Preferred greeting: {greeting}")

    manifest = configured_field_manifest(ud)
    if manifest:
        field_lines = [
            f"- {field.label or field.id}"
            + (f": {field.question}" if field.question else "")
            for field in manifest
        ]
        lines.append("Configured caller fields to collect when relevant:")
        lines.extend(field_lines)

    if ud.capabilities:
        lines.append(f"Enabled capabilities: {', '.join(ud.capabilities)}")

    transfer = ud.transfer_policy
    if transfer and transfer.destination_e164:
        lines.append(f"Transfer destination when appropriate: {transfer.destination_e164}")

    return "\n".join(lines).strip()


def build_template_instructions(
    ud: SessionUserData,
    *,
    template_mode: str,
    template_role: str,
    fallback_instructions: str,
) -> str:
    """Merge published wizard config with template-specific runtime instructions."""
    if is_lab_livekit_template(template_mode):
        minimal = build_minimal_user_context(ud)
        if minimal:
            return f"{minimal}\n\n---\nTEMPLATE MODE: {template_mode}\n{template_role}".strip()
        return fallback_instructions.strip()

    if has_compiled_prompt(ud):
        base = resolve_agent_instructions(ud)
        return f"{base}\n\n---\nTEMPLATE MODE: {template_mode}\n{template_role}".strip()

    minimal = build_minimal_user_context(ud)
    if minimal:
        return f"{minimal}\n\n---\nTEMPLATE MODE: {template_mode}\n{template_role}".strip()

    return fallback_instructions.strip()


def configured_field_manifest(ud: SessionUserData) -> list[ManifestField]:
    if not ud.receptionist or not ud.receptionist.field_manifest:
        return []
    return list(ud.receptionist.field_manifest)
