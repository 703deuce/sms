"""E2 timeline lane state + render timing parity with the web model (shared JSON fixture)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker.timeline_lanes import (
    apply_timeline_lane_state,
    music_window,
    normalize_timeline_lanes,
    timeline_render_spec,
)

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "timeline_parity.json").read_text())


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=[c["name"] for c in FIXTURE["cases"]])
def test_render_spec_matches_web_fixture(case):
    assert timeline_render_spec(case["edits"]) == case["expected"]


def test_lane_toggles_respect_capabilities():
    lanes = normalize_timeline_lanes(
        {"video": {"muted": True, "hidden": True, "locked": True}, "voice": {"hidden": True}, "junk": {"muted": True}}
    )
    assert lanes == {"video": {"locked": True}}


def test_voice_mute_strips_studio_and_dub_track():
    out = apply_timeline_lane_state(
        {
            "audio": {"music": None, "sfx": [], "studioSound": {"enabled": True, "generationId": "g"}},
            "audioTrack": "dub-es",
            "timelineLanes": {"voice": {"muted": True}},
        }
    )
    assert out["audio"]["studioSound"] is None
    assert out["audioTrack"] is None


def test_no_lane_state_is_identity():
    edits = {"broll": [{"id": "b"}], "audio": {"music": {"generationId": "m"}}}
    assert apply_timeline_lane_state(edits) is edits


def test_music_window_defaults():
    assert music_window({"generationId": "m"}, 12000) == {"startMs": 0, "endMs": 12000, "inMs": 0}
    assert music_window(None, 12000) is None


def test_music_window_extends_short_end_within_fade_out():
    assert music_window(
        {"generationId": "m", "startMs": 0, "endMs": 38700, "inMs": 0, "fadeOutMs": 3000},
        41000,
    ) == {"startMs": 0, "endMs": 41000, "inMs": 0}
