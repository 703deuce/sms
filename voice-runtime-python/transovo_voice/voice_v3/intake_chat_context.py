from __future__ import annotations

import logging
from typing import Any

from livekit.agents.llm import ChatContext

logger = logging.getLogger("transovo-voice.voice_v3.intake_chat_context")


def resolve_intake_chat_context(context: Any) -> ChatContext | None:
    """
    Best-effort chat context for IntakeTask — must include caller dialogue already in the
    active AgentSession (Amy GPT-Live), not delegated Luna memory alone.
    """
    session = getattr(context, "session", None)
    if session is None:
        logger.warning("voice_v3_intake_chat_ctx_no_session")
        return None

    history = getattr(session, "history", None)
    if history is None or not hasattr(history, "copy"):
        logger.warning("voice_v3_intake_chat_ctx_no_history")
        return None

    chat_ctx = history.copy(
        exclude_instructions=True,
        exclude_handoff=True,
        exclude_empty_message=True,
    )
    item_count = len(getattr(chat_ctx, "items", []) or [])
    logger.info("voice_v3_intake_chat_ctx_resolved item_count=%s", item_count)
    return chat_ctx


def append_caller_hint(chat_ctx: ChatContext | None, hint: str | None) -> ChatContext | None:
    """Ensure the latest delegated caller turn is visible when session history lags."""
    text = (hint or "").strip()
    if not text or chat_ctx is None:
        return chat_ctx
    try:
        from livekit.agents.llm import ChatMessage

        chat_ctx = chat_ctx.copy(
            exclude_instructions=True,
            exclude_handoff=True,
            exclude_empty_message=True,
        )
        chat_ctx.insert(
            ChatMessage(role="user", content=[text]),
        )
    except Exception:
        logger.exception("voice_v3_intake_chat_ctx_hint_failed")
    return chat_ctx
