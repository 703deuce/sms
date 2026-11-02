"""STREAMER_picks_fix1 tests (new file only)."""
from __future__ import annotations

from clips_worker.streamer.fusion import FusionPick
from clips_worker.video_picker import fill_stream_picks_floor_from_archive, merge_stream_moments


def _moment(start: float, end: float, peak: float, score: float = 0.8) -> dict:
    return {
        "start_s": start,
        "end_s": end,
        "peak_s": peak,
        "score": score,
        "what_happened": f"beat at {peak}",
    }


def test_merge_stream_moments_keeps_non_overlapping_spans_peak_window():
    moments = [
        _moment(0, 28.5, 10),
        _moment(28.5, 47, 43),
        _moment(56.5, 72.7, 65),
        _moment(120.7, 165.7, 164),
        _moment(166.7, 171.7, 170),
    ]
    out = merge_stream_moments(moments, overlap_s=30, mode="peak_window")
    assert len(out) == 5


def test_merge_stream_moments_drops_real_duplicate_spans():
    m1 = _moment(120, 165, 150, score=0.9)
    m2 = _moment(125, 166, 155, score=0.7)
    out = merge_stream_moments([m1, m2], overlap_s=30, mode="peak_window")
    assert len(out) == 1


def test_stream_floor_fill_from_archive():
    picks = [
        FusionPick(0, 30_000, "a", "a", 80, {}, {}, 15_000),
        FusionPick(67_000, 87_000, "b", "b", 75, {}, {}, 77_000),
        FusionPick(172_000, 201_000, "c", "c", 70, {}, {}, 190_000),
    ]
    archive = [
        {"startMs": 30_000, "endMs": 50_000, "score": 0.9, "title": "d", "peakMs": 40_000},
        {"startMs": 90_000, "endMs": 110_000, "score": 0.85, "title": "e", "peakMs": 100_000},
        {"startMs": 120_000, "endMs": 145_000, "score": 0.8, "title": "apex", "peakMs": 140_000},
        {"startMs": 200_000, "endMs": 226_000, "score": 0.7, "title": "f", "peakMs": 210_000},
    ]
    out = fill_stream_picks_floor_from_archive(
        list(picks),
        archive,
        duration_s=226.0,
        settings={},
    )
    assert len(out) == 6
    duration_ms = 226_000
    for p in out:
        assert 0 <= p.start_ms < p.end_ms <= duration_ms
        assert p.end_ms - p.start_ms >= 15_000
    for i, a in enumerate(out):
        for b in out[i + 1 :]:
            from clips_worker.clipfind.fair_rank import span_iou_ms

            assert span_iou_ms(a.start_ms, a.end_ms, b.start_ms, b.end_ms) < 0.35
