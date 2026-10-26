from clips_worker.silence_trim import effective_cut_ranges, silence_trim_cuts


def test_silence_trim_cuts_gap():
    words = [{"s": 0, "e": 1}, {"s": 2.2, "e": 3}]
    cuts = silence_trim_cuts(words, {"enabled": True, "minGapMs": 600, "keepMs": 150})
    assert len(cuts) == 1
    assert cuts[0][1] - cuts[0][0] > 800


def test_effective_cut_ranges_merges():
    edits = {"cutRanges": [], "silenceTrim": {"enabled": True, "minGapMs": 600, "keepMs": 150}}
    words = [{"s": 0, "e": 1}, {"s": 2.2, "e": 3}, {"s": 4.4, "e": 5}]
    merged = effective_cut_ranges(edits, words)
    assert len(merged) >= 2
