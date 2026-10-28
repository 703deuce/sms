"""Align worker with web content-detection: mode/genre are not user picker constraints."""
from __future__ import annotations

from typing import Any

CLIP_CONTENT_MODE_AUTO = "auto"
CLIP_CONTENT_GENRE_AUTO = "auto"

# Legacy project settings — treated like auto for moment selection (v3 decides per section).
_LEGACY_GENRES = frozenset(
    {
        "podcast",
        "interview",
        "education",
        "comedy",
        "business",
        "motivational",
        "gaming",
        "sports",
        "news",
        "howto",
        "talk",
        "vlog",
        "other",
        "gaming_stream",
        "podcast_interview",
    }
)
_LEGACY_MODES = frozenset({"talking", "anything"})


def normalize_content_mode(raw: Any) -> str:
    m = str(raw or CLIP_CONTENT_MODE_AUTO).strip().lower()
    if m == "captions":
        return "captions"
    return CLIP_CONTENT_MODE_AUTO


def normalize_content_genre(raw: Any) -> str:
    g = str(raw or CLIP_CONTENT_GENRE_AUTO).strip().lower()
    if g in (CLIP_CONTENT_GENRE_AUTO, ""):
        return CLIP_CONTENT_GENRE_AUTO
    if g in _LEGACY_GENRES:
        return CLIP_CONTENT_GENRE_AUTO
    return g


def content_genre_is_auto(settings: dict[str, Any] | None) -> bool:
    if not settings:
        return True
    return normalize_content_genre(settings.get("genre")) == CLIP_CONTENT_GENRE_AUTO


def layout_genre_hint(settings: dict[str, Any] | None) -> str:
    """Soft hint for title polish / layout only — never pass1/pass2 selection."""
    return "mixed"


def log_ignored_legacy_content_settings(settings: dict[str, Any]) -> dict[str, str] | None:
    raw_g = str(settings.get("genre") or "").strip().lower()
    raw_m = str(settings.get("mode") or "").strip().lower()
    ignored: dict[str, str] = {}
    if raw_g and raw_g not in (CLIP_CONTENT_GENRE_AUTO, "") and raw_g in _LEGACY_GENRES:
        ignored["genre"] = raw_g
    if raw_m and raw_m not in (CLIP_CONTENT_MODE_AUTO, "captions") and raw_m in _LEGACY_MODES:
        ignored["mode"] = raw_m
    return ignored or None
