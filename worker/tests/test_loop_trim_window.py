from clips_worker.loop_friendly_trim import apply_loop_friendly_trim


def test_ignores_words_outside_trim_window():
    edits = {"trim": {"in": 5000, "out": 9000}, "loopFriendlyEnd": True}
    words = [
        {"w": "loop", "s": 1.0, "e": 1.4},
        {"w": "loop", "s": 5.2, "e": 5.6},
        {"w": "body", "s": 6.0, "e": 6.4},
        {"w": "loop", "s": 8.0, "e": 8.4},
        {"w": "end!", "s": 8.5, "e": 8.9},
    ]
    out = apply_loop_friendly_trim(edits, words, export_platform="tiktok")
    assert out["trim"]["out"] <= 9000
