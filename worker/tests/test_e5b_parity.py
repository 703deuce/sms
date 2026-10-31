"""E5b preview ↔ export parity: worker media_inserts / media_words mirror lib/clips/editor/{inserts,media-words}.ts.

The fixture is written by new-app/tests/e5b-model.test.ts (WRITE_E5B_FIXTURE=1 to regenerate).
"""
from __future__ import annotations

import json
from pathlib import Path

from clips_worker.media_inserts import insert_windows, normalize_inserts
from clips_worker.media_sources import normalize_media_sources, referenced_media
from clips_worker.media_words import insert_words, media_bucket, merge_media_words

FIXTURE = Path(__file__).parent / "fixtures" / "e5b_parity.json"


def _cases():
    return json.loads(FIXTURE.read_text())["cases"]


def test_inserts_and_windows_match_ts():
    for c in _cases():
        inp = c["input"]
        sources = normalize_media_sources(inp["sources"])
        inserts = normalize_inserts(inp["inserts"], sources)
        assert inserts == c.get("inserts")
        assert insert_windows(inp["segs"], inserts) == c["windows"]


def test_words_match_ts():
    for c in _cases():
        inp = c["input"]
        edits = {"sources": inp["sources"], "sourceSegments": inp["sourceSegments"], "wordFixes": inp["wordFixes"]}
        assert merge_media_words(c["words"], edits, c["transcripts"]) == c["merged"]
        assert insert_words(c["windows"], edits, c["transcripts"]) == c["insertWords"]


def test_bucket_matches_ts():
    for c in _cases():
        for ref_id, bucket in c["buckets"].items():
            assert media_bucket(ref_id) == bucket


def test_referenced_media_includes_insert_sources():
    inp = _cases()[1]["input"]
    refs = referenced_media({"sources": inp["sources"], "inserts": inp["inserts"]})
    assert ("upload", "upl_i") in refs and ("upload", "upl_v") in refs and ("take", "trk_b") in refs
    assert ("upload", "upl_a") not in refs  # audio can't be inserted


def test_inserts_make_edits_non_default():
    import pytest

    try:
        from clips_worker.edits_render import is_default_edits
    except ModuleNotFoundError as exc:  # partial checkouts only; the full worker has every module
        pytest.skip(f"edits_render deps missing: {exc}")

    edits = {"v": 2, "trim": {"in": 0, "out": 4000}, "cutRanges": [], "wordFixes": {}}
    assert is_default_edits(edits, 0, 4000) is True
    assert is_default_edits({**edits, "inserts": [{"id": "a"}]}, 0, 4000) is False
