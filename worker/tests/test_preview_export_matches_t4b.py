import json
from pathlib import Path

import pytest

from clips_worker.preview_edits_match import preview_export_matches

FIXTURE = Path(__file__).resolve().parent / "fixtures/reorder_cases.json"


@pytest.mark.parametrize(
    "field,payload",
    [
        ("speechLevelingEnabled", {"speechLevelingEnabled": True, "loudnessLufs": -14}),
        ("speed", {"speed": 1.25}),
        ("sectionOrder", {"sectionOrder": [[5000, 10000], [0, 5000]]}),
    ],
)
def test_preview_export_matches_t4b_fields(field, payload):
    case = json.loads(FIXTURE.read_text())["cases"][0]
    edits = {
        "v": 2,
        "trim": {"in": case["trimIn"], "out": case["trimOut"]},
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
        **payload,
    }
    assert preview_export_matches(edits, 0, case["trimOut"]) is False
