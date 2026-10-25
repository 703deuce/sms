"""Clip title normalization and LLM backfill."""
from __future__ import annotations

import re

from clips_worker.picker.llm import chat_json

BAD_TITLE_RE = re.compile(r"^[a-z_]+$")
INTERNAL_TITLES = {"coverage_span", "fallback_full_span", "clip", "story"}

TITLE_SCHEMA = {
    "type": "object",
    "properties": {"title": {"type": "string", "maxLength": 60}},
    "required": ["title"],
    "additionalProperties": False,
}


def trim_title(title: str, max_len: int = 60) -> str:
    s = " ".join((title or "").split())
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


def ensure_clip_title(clip: dict, words: list[dict], genre: str) -> None:
    title = trim_title(str(clip.get("title") or ""))
    if not needs_title(title):
        clip["title"] = title
        return
    s, e = int(clip["start_ms"]), int(clip["end_ms"])
    excerpt = " ".join(
        w["w"] for w in words if w["e"] * 1000 >= s and w["s"] * 1000 <= e
    )
    clip["title"] = generate_title(excerpt, genre)
