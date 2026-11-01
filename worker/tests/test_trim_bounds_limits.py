from clips_worker.trim_bounds import expanded_source_cut_ms


def test_limits_honoured_beyond_8s():
    edits = {"trim": {"in": 1000, "out": 50_000}}
    start, end, lo, hi = expanded_source_cut_ms(10_000, 20_000, edits, limits=(0, 120_000))
    assert start == 1000
    assert end == 50_000
    assert lo == 0
    assert hi == 120_000


def test_none_limits_old_behaviour():
    edits = {"trim": {"in": 0, "out": 100_000}}
    start, end, lo, hi = expanded_source_cut_ms(10_000, 20_000, edits)
    assert start == 2000
    assert end == 28_000
