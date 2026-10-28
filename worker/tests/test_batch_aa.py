"""Batch AA: source segment retention, snap_bounds sparse transcript."""
from __future__ import annotations

from clips_worker.picker.snap_bounds import snap_bounds
from clips_worker.picker.sentences import Sentence
from clips_worker.streamer.bulk_keys import collect_bulky_stream_keys


def test_bulky_keys_exclude_clip_source_segments():
    ws = "ws_1"
    vod = "svod_1"
    seg = f"ws/{ws}/projects/proj_1/clips/clip_a/source_seg.mp4"
    keys = collect_bulky_stream_keys(
        workspace_id=ws,
        vod_id=vod,
        state={"audioKey": f"ws/{ws}/streams/{vod}/audio.opus"},
        clip_rows=[{"id": "clip_a", "projectId": "proj_1", "sourceSegKey": seg}],
    )
    assert seg not in keys
    assert f"ws/{ws}/streams/{vod}/audio.opus" in keys


def test_snap_bounds_reverts_when_words_far_from_candidate():
    words = [
        {"w": "hello", "s": 8.88, "e": 9.2},
        {"w": "world", "s": 9.2, "e": 12.0},
    ]
    sentences = [
        Sentence(idx=0, start_ms=8880, end_ms=12000, speaker="A", text="hello world", word_start=0, word_end=1),
    ]
    clip = {"start_ms": 78_000, "end_ms": 118_000, "title": "far"}
    out = snap_bounds(clip, words, sentences, range_start_ms=0, range_end_ms=180_000)
    assert out["start_ms"] == 78_000
    assert out["end_ms"] == 118_000
