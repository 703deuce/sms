"""Streamer clip titles — never ship LLM placeholders."""
from __future__ import annotations

import re

from clips_worker.picker.public_copy import is_internal_picker_note
from clips_worker.picker.titles import generate_title, trim_title

_PLACEHOLDER_TITLE_RE = re.compile(
    r"^\s*(no clear moment|not enough context|nothing notable|unclear moment|no highlight)\s*$",
    re.IGNORECASE,
)


def is_placeholder_stream_clip_title(title: str | None) -> bool:
    t = trim_title(str(title or ""), 120)
    if not t or len(t) < 3:
        return True
    if is_internal_picker_note(t):
        return True
    if _PLACEHOLDER_TITLE_RE.match(t):
        return True
    return False


def resolve_stream_clip_title(
    *,
    title: str | None,
    hook: str | None,
    words: list[dict],
    start_ms: int,
    end_ms: int,
    genre: str = "stream",
) -> str | None:
    """Return a user-visible title or None if the clip should be dropped."""
    from clips_worker.picker.titles import _clip_word_excerpt, title_reads_as_standalone_hook

    excerpt = _clip_word_excerpt(words, start_ms, end_ms)
    for candidate in (title, hook):
        t = trim_title(str(candidate or ""), 60)
        if t and not is_placeholder_stream_clip_title(t):
            return t
    if excerpt:
        first = trim_title(excerpt.split(".")[0].split("?")[0] or excerpt, 60)
        if first and not is_placeholder_stream_clip_title(first):
            return first
        gen = generate_title(excerpt, genre)
        if gen and not is_placeholder_stream_clip_title(gen):
            return gen
    hook_line = trim_title(str(hook or ""), 60)
    if hook_line and title_reads_as_standalone_hook(hook_line) and not is_placeholder_stream_clip_title(hook_line):
        return hook_line
    return None
