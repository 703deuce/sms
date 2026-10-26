from clips_worker.streamer.chunking import merge_words, plan_chunks


def test_plan_chunks_edges():
    assert plan_chunks(0, 15 * 60_000, 30_000) == []
    assert plan_chunks(5 * 60_000, 15 * 60_000, 30_000) == [(0, 300_000)]
    ranges = plan_chunks(26 * 60_000, 15 * 60_000, 30_000)
    assert len(ranges) >= 2
    assert ranges[0][0] == 0


def test_merge_midpoint_no_duplicates():
    # Overlap midpoint at (600s + 570s) / 2 = 585s wall-clock
    a = [{"w": "a", "s": 10.0, "e": 11.0}, {"w": "near", "s": 580.0, "e": 581.0}]
    b = [{"w": "b", "s": 586.0, "e": 587.0}, {"w": "c", "s": 590.0, "e": 591.0}]
    ranges = [(0, 600_000), (570_000, 1_200_000)]
    merged = merge_words([a, b], ranges)
    words = [w["w"] for w in merged]
    assert "a" in words and "b" in words and "c" in words
    assert len(words) == len(set((w["w"], w["s"]) for w in merged))
