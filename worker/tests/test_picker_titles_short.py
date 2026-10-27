from clips_worker.picker.titles import (
    SHORT_SOURCE_MAX_MS,
    ensure_clip_title,
    ensure_short_source_hook,
    trim_title,
)


def test_short_source_uses_transcript_opener():
    words = [{"w": "Hello", "s": 0, "e": 0.5}, {"w": "world", "s": 0.5, "e": 1.0}]
    clip = {"start_ms": 0, "end_ms": 30_000, "title": "coverage_span", "hook": ""}
    ensure_clip_title(clip, words, "podcast", source_ms=60_000)
    assert clip["title"] != "coverage_span"
    assert len(clip["title"]) >= 3


def test_short_source_hook_filled():
    words = [{"w": "Quick", "s": 0, "e": 0.3}, {"w": "hook", "s": 0.3, "e": 0.6}]
    clip = {"start_ms": 0, "end_ms": 10_000, "title": "Hi", "hook": ""}
    ensure_short_source_hook(clip, words, SHORT_SOURCE_MAX_MS)
    assert len(clip.get("hook") or "") >= 8


def test_trim_title_strips_sentence_refs():
    assert "s12" not in trim_title("Big idea (s12)")
