from clips_worker.layout_router import (
    CONFIDENCE_GATE,
    editor_layout_to_worker,
    editor_mode_uses_static_fit_blur,
    needs_per_segment_layout_export,
    normalize_layout_segments,
    route_multiperson_layout,
    speakercrop_settings_from_edits,
    summary_from_track_fixture,
)


def test_route_two_persons_auto_uses_director():
    s = summary_from_track_fixture(2, confidence=0.9)
    layout, v2 = route_multiperson_layout(s, "auto")
    assert layout == "dynamic" and v2 is True


def test_route_two_persons_explicit_split():
    s = summary_from_track_fixture(2, confidence=0.9)
    layout, v2 = route_multiperson_layout(s, "split")
    assert layout == "split" and v2 is True


def test_route_three_to_grid3():
    s = summary_from_track_fixture(3)
    layout, v2 = route_multiperson_layout(s, "auto")
    assert layout == "grid3" and v2


def test_route_four_to_grid4():
    s = summary_from_track_fixture(4)
    layout, v2 = route_multiperson_layout(s, "dynamic")
    assert layout == "grid4" and v2


def test_route_five_to_dynamic():
    s = summary_from_track_fixture(5)
    layout, v2 = route_multiperson_layout(s, "auto")
    assert layout == "dynamic" and v2


def test_low_confidence_falls_back_to_legacy():
    s = summary_from_track_fixture(3, confidence=CONFIDENCE_GATE - 0.1)
    layout, v2 = route_multiperson_layout(s, "auto")
    assert v2 is False
    assert layout == "speaker_follow"


def test_single_person_legacy():
    s = summary_from_track_fixture(1, confidence=0.95)
    layout, v2 = route_multiperson_layout(s, "auto")
    assert layout == "speaker_follow" and not v2


def test_fit_layout_never_enables_v2():
    s = summary_from_track_fixture(4)
    layout, v2 = route_multiperson_layout(s, "fit")
    assert layout == "fit" and not v2


def test_normalize_layout_segments_merges_adjacent():
    edits = {
        "trim": {"in": 0, "out": 10_000},
        "layout": {
            "mode": "speaker_follow",
            "layoutSegments": [
                {"startMs": 0, "endMs": 4000, "mode": "split"},
                {"startMs": 4000, "endMs": 10_000, "mode": "fit_blur"},
            ],
        },
    }
    segs = normalize_layout_segments(edits)
    assert len(segs) == 2
    assert segs[0]["mode"] == "split"
    assert segs[1]["mode"] == "fit_blur"


def test_needs_per_segment_export_when_modes_differ():
    edits = {
        "trim": {"in": 1000, "out": 9000},
        "layout": {
            "mode": "speaker_follow",
            "layoutSegments": [
                {"startMs": 1000, "endMs": 5000, "mode": "speaker_follow"},
                {"startMs": 5000, "endMs": 9000, "mode": "split"},
            ],
        },
    }
    assert needs_per_segment_layout_export(edits) is True


def test_single_layout_segment_does_not_need_per_segment_export():
    edits = {
        "trim": {"in": 0, "out": 5000},
        "layout": {"mode": "split", "layoutSegments": [{"startMs": 0, "endMs": 5000, "mode": "split"}]},
    }
    assert needs_per_segment_layout_export(edits) is False


def test_editor_layout_mapping_and_per_clip_override():
    assert editor_mode_uses_static_fit_blur("full_frame")
    assert not editor_mode_uses_static_fit_blur("split")
    assert editor_layout_to_worker("full_frame") == "fit"
    assert editor_layout_to_worker("fit_blur") == "fit"
    assert editor_layout_to_worker("center_crop") == "fill"
    base = {"layout": "auto", "aspectRatio": "9:16"}
    edits = {"layout": {"mode": "grid3", "shotOverrides": []}}
    merged = speakercrop_settings_from_edits(base, edits)
    assert merged["layout"] == "grid3"
    assert speakercrop_settings_from_edits(base, {"layout": {"mode": "speaker_follow"}})["layout"] == "auto"
