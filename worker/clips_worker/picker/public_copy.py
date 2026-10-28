"""User-visible title/headline text — never pass1 internal notes."""
from __future__ import annotations

from clips_worker.picker.titles import INTERNAL_TITLES, strip_internal_sentence_refs, trim_title

_INTERNAL_SUBSTRINGS = ("coverage_span", "fallback_full_span", "gemini video-watch")


def is_internal_picker_note(text: str | None) -> bool:
    t = strip_internal_sentence_refs(str(text or "")).strip().lower()
    if not t:
        return True
    if t in INTERNAL_TITLES:
        return True
    if any(x in t for x in _INTERNAL_SUBSTRINGS):
        return True
    return False


def headline_text_from_pick(pick: dict) -> str:
    """Export headline candidate: title only (never pass1_why / internal why)."""
    title = trim_title(str(pick.get("title") or ""), 120)
    if title and not is_internal_picker_note(title):
        return title
    return ""
