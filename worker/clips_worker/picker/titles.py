"""Clip title normalization and LLM backfill."""
from __future__ import annotations

import re

from clips_worker.picker.llm import chat_json

BAD_TITLE_RE = re.compile(r"^[a-z_]+$")
INTERNAL_TITLES = {"coverage_span", "fallback_full_span", "clip", "story"}
SHORT_SOURCE_MAX_MS = 120_000
OPENING_HOOK_WINDOW_MS = 3000
SENTENCE_REF_RE = re.compile(r"\(\s*s\d+(?:\s*-\s*s\d+)?\s*\)", re.IGNORECASE)
HOOK_BOOST_RE = re.compile(
    r"\b(why|how|never|always|secret|mistake|truth|stop|wrong|best|worst|crazy|insane)\b",
    re.IGNORECASE,
)
BANNED_HOOK_RE = re.compile(
    r"(you won'?t believe|wait for it|watch till the end|like and subscribe|smash that like)",
    re.IGNORECASE,
)
HOOK_MAX_WORDS = 8


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


def hook_delivers_in_clip(hook: str, words: list[dict], start_ms: int, end_ms: int) -> bool:
    h = strip_internal_sentence_refs(hook).lower()
    if not h or BANNED_HOOK_RE.search(h):
        return False
    excerpt = _clip_word_excerpt(words, start_ms, end_ms).lower()
    tokens = [w for w in re.findall(r"[a-z0-9']+", h) if len(w) > 3]
    if not tokens:
        return len(h.split()) <= HOOK_MAX_WORDS
    hits = sum(1 for t in tokens if t in excerpt)
    return hits >= max(1, len(tokens) // 2)


def trim_hook_line(text: str, max_words: int = HOOK_MAX_WORDS) -> str:
    t = strip_internal_sentence_refs(text).strip()
    if BANNED_HOOK_RE.search(t):
        return ""
    words = t.split()
    if len(words) > max_words:
        t = " ".join(words[:max_words])
    return trim_title(t, 72)


def _phrase_hook_score(text: str) -> float:
    t = strip_internal_sentence_refs(text).strip()
    if BANNED_HOOK_RE.search(t):
        return -2.0
    if len(t.split()) > HOOK_MAX_WORDS:
        return -0.5
    if len(t) < 4:
        return -1.0
    score = min(len(t), 96) / 24.0
    if "?" in t:
        score += 2.0
    if "!" in t:
        score += 1.0
    if HOOK_BOOST_RE.search(t):
        score += 1.5
    return score


def strongest_opening_hook(words: list[dict], clip_start_ms: int, window_ms: int = OPENING_HOOK_WINDOW_MS) -> str:
    """Best standalone hook line from the first few seconds of the clip (absolute source ms)."""
    end_ms = clip_start_ms + window_ms
    opener = _clip_word_excerpt(words, clip_start_ms, end_ms).strip()
    if not opener:
        return ""
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", opener) if p.strip()]
    if not parts:
        parts = [opener]
    best = max(parts, key=_phrase_hook_score)
    return trim_title(best, 72)


def title_reads_as_standalone_hook(title: str | None) -> bool:
    t = strip_internal_sentence_refs(title or "").strip()
    if len(t) < 12 or t.lower() in INTERNAL_TITLES:
        return False
    if BAD_TITLE_RE.match(t):
        return False
    return len(t.split()) >= 3


def polish_clip_hook_and_title(clip: dict, words: list[dict]) -> None:
    start_ms = int(clip["start_ms"])
    opener = strongest_opening_hook(words, start_ms)
    if not opener:
        return
    hook = strip_internal_sentence_refs(str(clip.get("hook") or ""))
    title = strip_internal_sentence_refs(str(clip.get("title") or ""))
    candidate = trim_hook_line(hook) or trim_hook_line(opener)
    opener_line = trim_hook_line(opener)
    if opener_line and (
        _phrase_hook_score(hook) < _phrase_hook_score(opener_line) or not candidate
    ):
        clip["hook"] = opener_line
    elif candidate:
        clip["hook"] = candidate
    end_ms = int(clip["end_ms"])
    if not hook_delivers_in_clip(str(clip.get("hook") or ""), words, start_ms, end_ms):
        if opener_line and hook_delivers_in_clip(opener_line, words, start_ms, end_ms):
            clip["hook"] = opener_line
    if not title_reads_as_standalone_hook(title):
        candidate = str(clip.get("hook") or opener)
        if title_reads_as_standalone_hook(candidate):
            clip["title"] = trim_title(candidate, 60)
        elif title_reads_as_standalone_hook(opener):
            clip["title"] = trim_title(opener, 60)


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
        polish_clip_hook_and_title(clip, words)
        return
    if not needs_title(title):
        clip["title"] = title
        ensure_short_source_hook(clip, words, source_ms or 0)
        polish_clip_hook_and_title(clip, words)
        return
    clip["title"] = generate_title(excerpt, genre)
    ensure_short_source_hook(clip, words, source_ms or 0)
    polish_clip_hook_and_title(clip, words)
