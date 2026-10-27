from clips_worker.streamer.chunking import plan_chunks
from clips_worker.streamer.errors import PermanentError
from clips_worker.streamer.long_vod_analyze import (
    enforce_vod_cost_cap,
    pick_chunk_duration_min,
    resolve_analyze_chunk_plan,
)


def test_pick_chunk_duration_scales_for_long_vod():
    two_h = 2 * 60 * 60 * 1000
    six_h = 6 * 60 * 60 * 1000
    assert pick_chunk_duration_min(30 * 60 * 1000) == 15
    assert pick_chunk_duration_min(two_h) >= 20
    assert pick_chunk_duration_min(six_h) >= 25


def test_resolve_plan_overlap_resume_friendly():
    duration_ms = 3 * 60 * 60 * 1000
    chunk_ms, overlap_ms, ranges = resolve_analyze_chunk_plan(duration_ms)
    assert overlap_ms == 30_000
    assert chunk_ms >= 15 * 60 * 1000
    assert len(ranges) >= 8
    # Adjacent chunks overlap
    for i in range(1, len(ranges)):
        prev_end = ranges[i - 1][1]
        cur_start = ranges[i][0]
        assert cur_start < prev_end
    merged = plan_chunks(duration_ms, chunk_ms, overlap_ms)
    assert merged == ranges


def test_cost_cap_raises_when_estimate_exceeds(monkeypatch):
    monkeypatch.setenv("STREAM_VOD_MAX_EST_COST_USD", "0.001")
    monkeypatch.setenv("STREAM_EST_GPU_S_PER_AUDIO_MIN", "10")
    try:
        enforce_vod_cost_cap("modal", analysed_minutes=180.0, chunk_count=12)
        raised = False
    except PermanentError:
        raised = True
    assert raised


def test_cost_cap_allows_small_vod(monkeypatch):
    monkeypatch.setenv("STREAM_VOD_MAX_EST_COST_USD", "50")
    est = enforce_vod_cost_cap("deepgram", analysed_minutes=5.0, chunk_count=1)
    assert est >= 0


def test_six_hour_effective_cap_under_two_dollars():
    from clips_worker.streamer.long_vod_analyze import effective_vod_cost_cap_usd

    cap = effective_vod_cost_cap_usd(360.0, "modal")
    assert cap < 2.0
