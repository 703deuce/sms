from clips_worker.streamer.fusion import FusionPick
from clips_worker.streamer.stream_dedupe import (
    dedupe_picks_against_channel_history,
    dedupe_picks_within_run,
)


def _pick(start: int, end: int, peak: int, score: int) -> FusionPick:
    return FusionPick(
        start_ms=start,
        end_ms=end,
        title="t",
        hook="h",
        score=score,
        scores={"total": score},
        ai_meta={"streamer": {"peakMs": peak}},
        peak_ms=peak,
    )


def test_within_run_dedupes_close_peaks():
    picks = [
        _pick(0, 30_000, 10_000, 90),
        _pick(5_000, 35_000, 12_000, 80),
        _pick(120_000, 150_000, 130_000, 70),
    ]
    out = dedupe_picks_within_run(picks, min_peak_sep_ms=45_000)
    assert len(out) == 2
    assert out[0].score == 90


def test_channel_history_dedupes_absolute_overlap():
    picks = [_pick(10_000, 40_000, 20_000, 88)]
    prior = [{"start": 100_000, "end": 140_000, "peak": 120_000}]
    kept, dropped = dedupe_picks_against_channel_history(
        picks,
        prior,
        vod_range_start_ms=100_000,
        min_peak_sep_ms=60_000,
    )
    assert dropped == 1
    assert kept == []
