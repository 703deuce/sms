"""Zoom + silence trim + captions share one cut timeline (no caption drift)."""
from clips_worker.caption_words import build_caption_words
from clips_worker.clip_polish import apply_clip_polish_initial
from clips_worker.silence_trim import effective_cut_ranges
from clips_worker.zoom_render import build_zoom_keyframes


FIXTURE_WORDS = [
    {"w": "Hello", "s": 0.0, "e": 0.4, "i": 0},
    {"w": "um", "s": 0.5, "e": 0.7, "i": 1},
    {"w": "world", "s": 1.8, "e": 2.1, "i": 2},
    {"w": "secret", "s": 2.2, "e": 2.6, "i": 3},
    {"w": "works.", "s": 2.6, "e": 3.0, "i": 4},
]


def _polished_edits():
    pick = {"start_ms": 0, "end_ms": 4000, "hook": "She called him out"}
    settings = {"genre": "podcast", "aspectRatio": "9:16"}
    base = {"trim": {"in": 0, "out": 4000}, "cutRanges": [], "layout": {"mode": "speaker_follow"}}
    edits = apply_clip_polish_initial(base, pick, FIXTURE_WORDS, settings)
    edits["cutRanges"] = effective_cut_ranges(edits, FIXTURE_WORDS)
    return edits


def test_caption_timeline_monotonic_after_polish_cuts():
    edits = _polished_edits()
    caps = build_caption_words(FIXTURE_WORDS, edits)
    assert caps, "expected caption words after polish cuts"
    texts = [c["text"] for c in caps]
    assert "um" not in texts
    for i in range(1, len(caps)):
        assert caps[i]["s_ms"] >= caps[i - 1]["s_ms"]
        assert caps[i]["e_ms"] > caps[i]["s_ms"]
    last_end = caps[-1]["e_ms"]
    assert last_end < 4000


def test_zoom_keyframes_with_polish_emphasis_still_valid():
    edits = _polished_edits()
    caps = build_caption_words(FIXTURE_WORDS, edits)
    render_words = [
        {"w": c["text"], "s": c["s_ms"] / 1000.0, "e": c["e_ms"] / 1000.0, "i": c["i"]}
        for c in caps
    ]
    emph = edits.get("captions", {}).get("emphasis") or []
    duration_s = max(c["e_ms"] for c in caps) / 1000.0
    kf = build_zoom_keyframes(render_words, list(emph), duration_s, 1.12)
    assert any(z > 1.0 for _, z in kf)


def test_polish_flags_off_skips_silence_cuts():
    import os

    os.environ["CLIP_POLISH_SILENCE"] = "0"
    try:
        pick = {"start_ms": 0, "end_ms": 4000, "hook": "test hook line"}
        settings = {"genre": "podcast"}
        base = {"trim": {"in": 0, "out": 4000}, "cutRanges": [], "layout": {"mode": "speaker_follow"}}
        edits = apply_clip_polish_initial(base, pick, FIXTURE_WORDS, settings)
        cuts = effective_cut_ranges(edits, FIXTURE_WORDS)
        assert cuts == []
    finally:
        os.environ.pop("CLIP_POLISH_SILENCE", None)
