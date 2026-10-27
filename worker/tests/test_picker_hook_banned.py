from clips_worker.picker.titles import (
    BANNED_HOOK_RE,
    hook_delivers_in_clip,
    polish_clip_hook_and_title,
    trim_hook_line,
)


def test_banned_hook_phrases_rejected():
    assert BANNED_HOOK_RE.search("You won't believe what happened")
    assert trim_hook_line("Wait for it — big reveal") == ""


def test_hook_max_eight_words():
    line = trim_hook_line("one two three four five six seven eight nine")
    assert len(line.split()) <= 8


def test_polish_drops_banned_hook_for_opener():
    words = [
        {"w": "She", "s": 0.0, "e": 0.2},
        {"w": "called", "s": 0.2, "e": 0.5},
        {"w": "him", "s": 0.5, "e": 0.7},
        {"w": "out.", "s": 0.7, "e": 1.0},
    ]
    clip = {"start_ms": 0, "end_ms": 5000, "title": "clip", "hook": "You won't believe this"}
    polish_clip_hook_and_title(clip, words)
    assert "believe" not in clip["hook"].lower()
    assert hook_delivers_in_clip(clip["hook"], words, 0, 5000)
