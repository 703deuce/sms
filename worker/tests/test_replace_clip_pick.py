from clips_worker.replace_clip_job import _overlap_ratio, _pick_replacement


def test_overlap_ratio_disjoint():
    assert _overlap_ratio(0, 1000, 2000, 3000) == 0.0


def test_overlap_ratio_heavy_overlap_blocks():
    assert _overlap_ratio(0, 1000, 500, 1500) >= 0.35


def test_pick_replacement_skips_overlapping():
    picks = [
        {"start_ms": 0, "end_ms": 10_000, "score": 90},
        {"start_ms": 20_000, "end_ms": 30_000, "score": 80},
    ]
    spans = [(0, 10_000)]
    chosen = _pick_replacement(picks, spans)
    assert chosen is not None
    assert chosen["start_ms"] == 20_000
