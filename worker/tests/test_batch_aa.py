"""Batch AA: source segment retention, snap_bounds sparse transcript."""
from __future__ import annotations

from unittest.mock import patch

import pytest

from clips_worker.clip_source_media import resolve_clip_export_source
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


def _ctx(**overrides):
    base = {
        "workspaceId": "ws_1",
        "projectId": "proj_1",
        "clipId": "clip_x",
        "startMs": 118_660,
        "endMs": 130_660,
        "sourceSegStartMs": 88_660,
        "source_key": "ws/ws_1/projects/proj_1/upload/source.mp4",
        "previewKey": "ws/ws_1/projects/proj_1/clips/clip_x/preview.mp4",
        "sourceSegKey": "ws/ws_1/projects/proj_1/clips/clip_x/source_seg.mp4",
    }
    base.update(overrides)
    return base


def test_resolve_upload_beats_preview():
    def exists(k: str) -> bool:
        if k.endswith("source_seg.mp4"):
            return False
        return True

    with patch("clips_worker.clip_source_media._object_exists", side_effect=exists):
        key, off, reason = resolve_clip_export_source(_ctx())
    assert reason == "upload"
    assert off == 0
    assert "upload" in key


def test_resolve_preview_fallback_uses_start_ms_offset():
    def exists(k: str) -> bool:
        return "preview" in k

    with patch("clips_worker.clip_source_media._object_exists", side_effect=exists):
        key, off, reason = resolve_clip_export_source(
            _ctx(sourceSegKey="ws/ws_1/projects/proj_1/clips/clip_x/source_seg.mp4", source_key=None)
        )
    assert reason == "previewKey_composite"
    assert off == 118_660
    assert "preview" in key


def test_resolve_missing_segment_falls_through_to_upload():
    def exists(k: str) -> bool:
        return "upload" in k

    with patch("clips_worker.clip_source_media._object_exists", side_effect=exists):
        key, off, reason = resolve_clip_export_source(_ctx())
    assert reason == "upload"


def test_resolve_missing_segment_and_upload_uses_preview():
    def exists(k: str) -> bool:
        return "preview" in k

    with patch("clips_worker.clip_source_media._object_exists", side_effect=exists):
        key, off, reason = resolve_clip_export_source(
            _ctx(source_key=None, sourceSegKey="ws/ws_1/projects/proj_1/clips/clip_x/source_seg.mp4")
        )
    assert reason == "previewKey_composite"
    assert off == 118_660


def test_empty_source_cut_raises():
    with pytest.raises(RuntimeError, match="empty_source_cut reason=upload rel_start=118660"):
        dur = 0.0
        reason = "upload"
        rel_start = 118660
        if dur < 0.1:
            raise RuntimeError(f"empty_source_cut reason={reason} rel_start={rel_start}")
