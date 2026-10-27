from clips_worker.picker.selection import select_clips


def _pick(start_ms: int, end_ms: int, score: float = 8.0) -> dict:
    return {
        "start_ms": start_ms,
        "end_ms": end_ms,
        "title": "Moment",
        "reason": "test",
        "archetype": "story",
        "final": score,
    }


def test_two_minute_source_splits_into_three_clips():
    source_ms = 120_000
    lone = _pick(59_000, 113_000, score=5.7)
    out = select_clips([lone], source_ms)
    assert len(out) >= 3
    for row in out:
        dur = row["end_ms"] - row["start_ms"]
        assert 15_000 <= dur <= 60_000
