import json
from pathlib import Path

import pytest

from clips_worker.clip_keep_segments import keep_segments, ordered_keep_segments
from clips_worker.export_post import apply_export_post
from clips_worker.preview_edits_match import preview_export_matches

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text())


def _bounds(edits: dict) -> tuple[int, int]:
    return 0, int(edits["trim"]["out"])


@pytest.mark.parametrize("name", ["regular.json", "stream_v3_clipB.json"])
def test_default_path_ordered_equals_keep(name):
    raw = _load(name)
    edits = {
        "v": 2,
        "trim": raw.get("trim") or {"in": 0, "out": 60000},
        "cutRanges": raw.get("cutRanges") or [],
        "wordFixes": raw.get("wordFixes") or {},
        "layout": raw.get("layout") or {"mode": "speaker_follow", "shotOverrides": []},
        "captions": raw.get("captions") or {"enabled": True},
    }
    assert ordered_keep_segments(edits) == keep_segments(
        int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or []
    )


@pytest.mark.parametrize("name", ["regular.json", "stream_v3_clipB.json"])
def test_apply_export_post_noop_on_defaults(name, tmp_path):
    raw = _load(name)
    edits = {
        "v": 2,
        "trim": raw.get("trim") or {"in": 0, "out": 60000},
        "cutRanges": raw.get("cutRanges") or [],
    }
    inp = tmp_path / "in.mp4"
    inp.write_bytes(b"0")
    out, srt = apply_export_post(inp, tmp_path, edits, {}, srt_body="")
    assert out == inp


def test_preview_export_matches_new_fields():
    edits = {
        "v": 2,
        "trim": {"in": 0, "out": 10000},
        "cutRanges": [],
        "wordFixes": {},
        "layout": {"mode": "speaker_follow", "shotOverrides": []},
        "captions": {
            "enabled": True,
            "presetId": "bold_pop",
            "animation": "pop",
            "size": 6.5,
            "position": "bottom",
            "case": "sentence",
            "wordsPerLine": 2,
        },
    }
    base = preview_export_matches(edits, 0, 10000)
    assert preview_export_matches({**edits, "loudnessLufs": -14}, 0, 10000) is base
    assert (
        preview_export_matches(
            {**edits, "speechLevelingEnabled": True, "loudnessLufs": -14},
            0,
            10000,
        )
        is False
    )
    assert preview_export_matches({**edits, "speed": 1.25}, 0, 10000) is False
    assert preview_export_matches({**edits, "sectionOrder": [[5000, 10000], [0, 5000]]}, 0, 10000) is False
    assert base in (True, False)
