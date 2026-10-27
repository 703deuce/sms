from clips_worker.picker.pass2 import _cap_moments_for_batch


def test_cap_keeps_top_ranked_moments():
    moments = [
        {"start_sentence": 0, "end_sentence": 1, "why": "coverage_span", "archetype": "story"},
        {"start_sentence": 2, "end_sentence": 8, "why": "strong hook", "archetype": "story"},
    ]
    kept, tail = _cap_moments_for_batch(moments, 1)
    assert len(kept) == 1
    assert kept[0]["why"] == "strong hook"
    assert len(tail) == 1
