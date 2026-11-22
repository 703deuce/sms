"""Quotes are TTS-skipped only if a handoff plays their source audio."""
from clips_worker.motion_studio.pipeline.narration import chapters_of


def _story():
    return {"lines": [
        {"id": "q1", "chapter": 1, "text": "Their own answer", "spoken": "Their own answer",
         "quote": {"assetId": "cam1"}},
        {"id": "n1", "chapter": 1, "text": "The bridge", "spoken": "The bridge"},
    ]}


def test_quote_remains_when_no_source_audio_handoff():
    chapters = chapters_of(_story(), {"scenes": [
        {"kind": "graphics", "lineIds": ["q1", "n1"]},
    ]})
    assert [line["id"] for chapter in chapters for line in chapter] == ["q1", "n1"]


def test_quote_skipped_only_for_handoff_playing_clip_audio():
    chapters = chapters_of(_story(), {"scenes": [
        {"kind": "handoff", "lineIds": ["q1"], "handoff": {"audioMode": "clip"}},
        {"kind": "graphics", "lineIds": ["n1"]},
    ]})
    assert [line["id"] for chapter in chapters for line in chapter] == ["n1"]


def test_muted_handoff_keeps_quote_for_timing():
    chapters = chapters_of(_story(), {"scenes": [
        {"kind": "handoff", "lineIds": ["q1"], "handoff": {"audioMode": "mute"}},
        {"kind": "graphics", "lineIds": ["n1"]},
    ]})
    assert [line["id"] for chapter in chapters for line in chapter] == ["q1", "n1"]
