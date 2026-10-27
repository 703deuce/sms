from clips_worker.trim_bounds import expanded_source_cut_ms


def test_expands_when_trim_wider_than_clip():
    edits = {"trim": {"in": 1000, "out": 20000}}
    start, end = expanded_source_cut_ms(5000, 15000, edits)
    assert start == 1000
    assert end == 20000


def test_clamps_extend_cap():
    edits = {"trim": {"in": 0, "out": 100_000}}
    start, end = expanded_source_cut_ms(10_000, 20_000, edits)
    assert start == 2000
    assert end == 28_000
