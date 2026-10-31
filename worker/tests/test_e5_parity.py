"""E5 preview ↔ export parity: worker media_sources mirrors lib/clips/editor/sources.ts.

The fixture is written by new-app/tests/e5-model.test.ts (WRITE_E5_FIXTURE=1 to regenerate).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker.media_sources import (
    normalize_media_sources,
    normalize_source_segments,
    referenced_media,
    source_windows,
)

FIXTURE = Path(__file__).parent / "fixtures" / "e5_parity.json"


def _cases():
    return json.loads(FIXTURE.read_text())["cases"]


def test_normalize_matches_ts():
    for c in _cases():
        inp = c["input"]
        sources = normalize_media_sources(inp["sources"])
        assert sources == c.get("sources")
        assert normalize_source_segments(inp["sourceSegments"], sources) == c.get("sourceSegments")


def test_windows_match_ts():
    for c in _cases():
        inp = c["input"]
        edits = {"sources": inp["sources"], "sourceSegments": inp["sourceSegments"]}
        assert source_windows(edits, inp["win"][0], inp["win"][1]) == c["windows"]


def test_referenced_media_and_preview_reuse_gate():
    edits = {
        "trim": {"in": 0, "out": 10_000},
        "cutRanges": [],
        "wordFixes": {},
        "sources": [{"id": "upl_v", "ref": "upload", "refId": "upl_v", "mediaType": "video"}],
        "sourceSegments": [{"id": "a", "sourceId": "upl_v", "startMs": 0, "endMs": 1000}],
        "broll": [{"id": "b", "source": "upload", "uploadId": "upl_i", "still": True, "startMs": 0, "endMs": 2000},
                  {"id": "c", "source": "upload", "uploadId": "../x", "startMs": 0, "endMs": 2000}],
        "audio": {"music": {"generationId": "upl_m", "uploadId": "upl_m"}, "sfx": [{"generationId": "g", "atMs": 0}]},
    }
    assert referenced_media(edits) == [("upload", "upl_v"), ("upload", "upl_i"), ("upload", "upl_m")]
    assert referenced_media({}) == []


def test_preview_reuse_gate():
    try:
        from clips_worker.edits_render import is_default_edits
    except ImportError:  # partial checkout; the worker image has the full package
        pytest.skip("edits_render deps not importable here")
    plain = {"trim": {"in": 0, "out": 10_000}, "cutRanges": [], "wordFixes": {}}
    with_src = {**plain, "sourceSegments": [{"id": "a", "sourceId": "x", "startMs": 0, "endMs": 1000}]}
    assert is_default_edits(with_src, 0, 10_000) is False
