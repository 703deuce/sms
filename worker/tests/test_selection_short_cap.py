from clips_worker.picker.selection import select_clips


def _pick(start: int, end: int, score: float) -> dict:
    return {
        "start_ms": start,
        "end_ms": end,
        "title": f"Moment {start // 1000}s",
        "reason": f"payoff {start}",
        "final": score,
        "archetype": f"arch_{start}",
    }


def test_four_minute_source_can_keep_two_clips():
    picks = [
        _pick(0, 30_000, 8.0),
        _pick(60_000, 90_000, 7.5),
        _pick(120_000, 150_000, 7.0),
    ]
    kept = select_clips(picks, 240_000, force_best=True)
    assert len(kept) >= 2
