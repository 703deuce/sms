"""Resolve streamer clip layout archetype from Twitch category or Gemini section activity."""
from __future__ import annotations

from typing import Any

_TALKING_CATEGORIES = frozenset(
    {
        "just chatting",
        "irl",
        "talk shows",
        "podcasts",
        "sports talk",
        "music",
        "art",
        "makers & crafting",
        "food & drink",
        "special events",
    }
)


def _activity_implies_talking(activity: str) -> bool:
    a = activity.lower()
    for token in ("irl", "talking", "chat", "podcast", "creative"):
        if token in a:
            return True
    return "gaming" not in a and "game" not in a


def resolve_streamer_layout_archetype(
    *,
    vod: dict[str, Any] | None,
    state: dict[str, Any] | None,
) -> tuple[str, str]:
    """
    Return (archetype, source) for clip_layout_policy.
    Prefer Gemini section activities when present; else Twitch VOD category.
    """
    st = state if isinstance(state, dict) else {}
    sections = st.get("videoPickerSections")
    if isinstance(sections, list) and sections:
        activities: list[str] = []
        for sec in sections:
            if not isinstance(sec, dict):
                continue
            act = str(sec.get("activity") or "").strip()
            if act:
                activities.append(act)
        if activities:
            talking = sum(1 for a in activities if _activity_implies_talking(a))
            gaming = sum(1 for a in activities if "gaming" in a.lower() or "game" in a.lower())
            if talking >= gaming:
                return "podcast_interview", "gemini_section_activity"
            return "gaming_stream", "gemini_section_activity"

    category = ""
    if vod:
        category = str(vod.get("category") or "").strip()
    cat_l = category.lower()
    if cat_l:
        if cat_l in _TALKING_CATEGORIES or "chatting" in cat_l or cat_l.startswith("just "):
            return "podcast_interview", "twitch_category"
        if "game" in cat_l or category:
            return "gaming_stream", "twitch_category"

    return "podcast_interview", "default_talking"
