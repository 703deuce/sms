"""Clip title normalization and LLM backfill."""
from __future__ import annotations

import re

from clips_worker.picker.llm import chat_json

BAD_TITLE_RE = re.compile(r"^[a-z_]+$")
INTERNAL_TITLES = {"coverage_span", "fallback_full_span", "clip", "story"}
SHORT_SOURCE_MAX_MS = 120_000
SENTENCE_REF_RE = re.compile(r"\(\s*s\d+(?:\s*-\s*s\d+)?\s*\)", re.IGNORECASE)


def strip_internal_sentence_refs(text: str) -> str:
    return " ".join(SENTENCE_REF_RE.sub("", text or "").split())

TITLE_SCHEMA = {
    "type": "object",
    "properties": {"title": {"type": "string", "maxLength": 60}},
    "required": ["title"],
    "additionalProperties": False,
}


def trim_title(title: str, max_len: int = 60) -> str:
    s = strip_internal_sentence_refs(title)
    if len(s) <= max_len:
        return s
    cut = s[:max_len].rsplit(" ", 1)[0].strip()
    return cut if cut else s[:max_len].strip()


def needs_title(title: str | None) -> bool:
    t = (title or "").strip()
    if not t or len(t) < 3:
        return True
    if t.lower() in INTERNAL_TITLES:
        return True
    if BAD_TITLE_RE.match(t):
        return True
    return False


def generate_title(transcript_excerpt: str, genre: str) -> str:
    excerpt = transcript_excerpt.strip()[:2500]
    system = (
        "Write one short clip title using only the speaker's own words or a tight paraphrase. "
        "Max 60 characters. No internal codes. Return JSON only."
    )
    user = f"Genre: {genre}\nTranscript excerpt:\n{excerpt}"
    try:
        data = chat_json(system, user, TITLE_SCHEMA, "clip_title")
        return trim_title(str(data.get("title") or "Clip moment"))
    except Exception:
        words = [w for w in re.findall(r"[A-Za-z']+", excerpt) if len(w) > 2]
        return trim_title(" ".join(words[:8]) or "Clip moment")


def _clip_word_excerpt(words: list[dict], start_ms: int, end_ms: int) -> str:
    return " ".join(w["w"] for w in words if w["e"] * 1000 >= start_ms and w["s"] * 1000 <= end_ms)


def ensure_short_source_hook(clip: dict, words: list[dict], source_ms: int) -> None:
    if source_ms > SHORT_SOURCE_MAX_MS:
        return
    hook = str(clip.get("hook") or "").strip()
    if len(hook) >= 8:
        return
    s, e = int(clip["start_ms"]), int(clip["end_ms"])
    opener = _clip_word_excerpt(words, s, e).split()
    if not opener:
        return
    clip["hook"] = trim_title(" ".join(opener[:14]), 72)


def ensure_clip_title(clip: dict, words: list[dict], genre: str, *, source_ms: int | None = None) -> None:
    title = trim_title(str(clip.get("title") or ""))
    s, e = int(clip["start_ms"]), int(clip["end_ms"])
    excerpt = _clip_word_excerpt(words, s, e)
    if source_ms is not None and source_ms <= SHORT_SOURCE_MAX_MS and excerpt:
        clip["title"] = trim_title(excerpt.split(".")[0].split("?")[0] or excerpt, 60)
        if needs_title(clip["title"]):
            clip["title"] = generate_title(excerpt, genre)
        ensure_short_source_hook(clip, words, source_ms)
        return
    if not needs_title(title):
        clip["title"] = title
        ensure_short_source_hook(clip, words, source_ms or 0)
        return
    clip["title"] = generate_title(excerpt, genre)
    ensure_short_source_hook(clip, words, source_ms or 0)
