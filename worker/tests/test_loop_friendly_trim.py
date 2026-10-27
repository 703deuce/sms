from clips_worker.loop_friendly_trim import apply_loop_friendly_trim, loop_alignment_score


def test_loop_score_shared_tokens():
    assert loop_alignment_score(["secret", "growth", "tips"], ["my", "secret", "growth"]) > 0.2


def test_trim_shortens_when_payoff_and_overlap():
    edits = {"trim": {"in": 0, "out": 8000}, "loopFriendlyEnd": True}
    words = [
        {"w": "Secret", "s": 0.0, "e": 0.4},
        {"w": "growth", "s": 0.5, "e": 0.9},
        {"w": "hack", "s": 1.0, "e": 1.4},
        {"w": "for", "s": 1.5, "e": 1.7},
        {"w": "you!", "s": 6.5, "e": 7.0},
    ]
    out = apply_loop_friendly_trim(edits, words, export_platform="tiktok")
    assert out["trim"]["out"] < 8000
    assert out["trim"]["out"] >= 7000
