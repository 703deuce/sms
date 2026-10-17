from __future__ import annotations

import logging
from typing import Any

from livekit.agents.voice.events import RunContext

logger = logging.getLogger("transovo-voice.voice_v3.live_context_hydration")

_LIVE_CONTEXT_RESULT_KEY = "liveContextEvents"


def strip_live_context_events(result: dict[str, Any]) -> list[dict[str, Any]]:
    raw = result.pop(_LIVE_CONTEXT_RESULT_KEY, None)
    if not isinstance(raw, list):
        return []
    events: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, dict) and item.get("type"):
            events.append(item)
    return events


def _resolve_gpt_live_session(
    context: RunContext | None,
    duplex_session: Any | None,
) -> Any | None:
    session = duplex_session
    if session is None and context is not None:
        try:
            session = context.session.current_agent.duplex_session
        except RuntimeError:
            session = None
    if session is None:
        return None
    append_thinking = getattr(session, "append_thinking", None)
    append_commentary = getattr(session, "append_commentary", None)
    if callable(append_thinking) and callable(append_commentary):
        return session
    return None


def apply_live_context_events(
    events: list[dict[str, Any]],
    *,
    context: RunContext | None = None,
    duplex_session: Any | None = None,
) -> int:
    """Push Node-authored thinking/commentary into GPT-Live. Returns count applied."""
    if not events:
        return 0
    gpt_live = _resolve_gpt_live_session(context, duplex_session)
    if gpt_live is None:
        logger.warning("voice_v3_live_context_skipped_no_gpt_live_session")
        return 0

    applied = 0
    for ev in events:
        etype = str(ev.get("type") or "")
        content = ev.get("content")
        if not isinstance(content, str) or not content.strip():
            continue
        delegation_id = ev.get("delegation_id")
        deleg = str(delegation_id) if delegation_id else None
        try:
            if etype == "session.thinking.append":
                gpt_live.append_thinking(content, delegation_id=deleg)
                applied += 1
            elif etype == "session.commentary.append":
                gpt_live.append_commentary(content, delegation_id=deleg)
                applied += 1
        except Exception:
            logger.exception("voice_v3_live_context_apply_failed type=%s", etype)
    return applied


def apply_live_context_from_tool_result(
    result: dict[str, Any],
    *,
    context: RunContext | None = None,
    duplex_session: Any | None = None,
) -> dict[str, Any]:
    events = strip_live_context_events(result)
    apply_live_context_events(events, context=context, duplex_session=duplex_session)
    return result
