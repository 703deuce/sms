from clips_worker.picker.titles import (
    ensure_clip_title,
    polish_clip_hook_and_title,
    strongest_opening_hook,
    title_reads_as_standalone_hook,
)


def test_strongest_opening_prefers_question_in_first_3s():
    words = [
        {"w": "So", "s": 10.0, "e": 10.2},
        {"w": "yeah", "s": 10.2, "e": 10.4},
        {"w": "um", "s": 10.4, "e": 10.6},
        {"w": "Why", "s": 10.6, "e": 10.9},
        {"w": "does", "s": 10.9, "e": 11.1},
        {"w": "this", "s": 11.1, "e": 11.3},
        {"w": "matter?", "s": 11.3, "e": 11.8},
    ]
    hook = strongest_opening_hook(words, clip_start_ms=10_000)
    assert "matter" in hook.lower() or "why" in hook.lower()


def test_polish_replaces_weak_hook_with_opening_line():
    words = [
        {"w": "Nobody", "s": 0.0, "e": 0.4},
        {"w": "talks", "s": 0.4, "e": 0.7},
        {"w": "about", "s": 0.7, "e": 1.0},
        {"w": "this", "s": 1.0, "e": 1.3},
        {"w": "secret.", "s": 1.3, "e": 1.8},
        {"w": "Later", "s": 5.0, "e": 5.4},
        {"w": "stuff", "s": 5.4, "e": 5.8},
    ]
    clip = {
        "start_ms": 0,
        "end_ms": 8000,
        "title": "clip",
        "hook": "weak",
    }
    polish_clip_hook_and_title(clip, words)
    assert title_reads_as_standalone_hook(clip["title"])
    assert len(clip["hook"]) >= 12


def test_ensure_clip_title_fixture_transcript():
    words = [
        {"w": "The", "s": 5.0, "e": 5.1},
        {"w": "real", "s": 5.1, "e": 5.3},
        {"w": "mistake", "s": 5.3, "e": 5.7},
        {"w": "is", "s": 5.7, "e": 5.9},
        {"w": "ignoring", "s": 5.9, "e": 6.3},
        {"w": "churn.", "s": 6.3, "e": 6.8},
    ]
    clip = {"start_ms": 5000, "end_ms": 15000, "title": "story", "hook": ""}
    ensure_clip_title(clip, words, "podcast", source_ms=90_000)
    assert title_reads_as_standalone_hook(clip["title"])
