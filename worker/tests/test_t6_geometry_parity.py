"""T6 template geometry invariants + py/ts parity fixtures."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker.t6_geometry import resolve_template_geometry
from clips_worker.t6_registry import TEMPLATE_IDS, TEMPLATES
from clips_worker.t6_signals import signals_or_defaults

FIX = Path(__file__).resolve().parent / "fixtures" / "geometry"
PLAY_W, PLAY_H = 1080, 1920


def _fixture_edits_signals():
    edits = {
        "layout": {
            "template": {
                "id": "I1",
                "boxes": {
                    "facecam": {"x": 0.75, "y": 0.02, "w": 0.22, "h": 0.25},
                    "action": {"x": 0.1, "y": 0.05, "w": 0.8, "h": 0.85},
                },
            },
            "facecam": {"box": {"x": 0.02, "y": 0.02, "w": 0.3, "h": 0.28}},
            "cropBox": {"x": 0.2, "y": 0.0, "w": 0.6, "h": 1.0},
        }
    }
    signals = signals_or_defaults(
        {
            "clipType": "irl",
            "facecamLayout": {"facecam": {"x": 0.75, "y": 0.02, "w": 0.22, "h": 0.25}, "confidence": 0.9},
            "signals": {
                "facecam_box": {"x": 0.99, "y": 0.01, "w": 0.01, "h": 0.01},
                "facecam_conf": 0.9,
                "action_box": {"x": 0.05, "y": 0.05, "w": 0.9, "h": 0.9},
            },
        }
    )
    return edits, signals


@pytest.mark.parametrize("template_id", TEMPLATE_IDS)
def test_geometry_bounds(template_id: str):
    edits, signals = _fixture_edits_signals()
    edits["layout"]["template"]["id"] = template_id
    spec = resolve_template_geometry(TEMPLATES[template_id], signals, edits)
    for panel in spec["panels"]:
        d = panel["dest"]
        assert 0 <= d["x"] <= PLAY_W
        assert 0 <= d["y"] <= PLAY_H
        assert d["y"] + d["h"] <= PLAY_H + 2
        assert d["x"] + d["w"] <= PLAY_W + 2
    for band in spec["bands"]:
        d = band["dest"]
        assert d["y"] + d["h"] <= PLAY_H + 2


def test_i1_panel_height_not_full_frame():
    edits, signals = _fixture_edits_signals()
    spec = resolve_template_geometry(TEMPLATES["I1"], signals, edits)
    h = spec["panels"][0]["dest"]["h"]
    assert h == 614


def test_i4_trim_sides_no_boxes():
    edits, signals = _fixture_edits_signals()
    edits["layout"]["cropBox"] = None
    edits["layout"]["template"]["boxes"] = {}
    signals = signals_or_defaults({"clipType": "irl", "signals": {}})
    spec = resolve_template_geometry(TEMPLATES["I4"], signals, edits)
    src = spec["panels"][0]["src"]
    assert spec["panels"][0]["fit"] == "contain_black"
    assert abs(src["w"] - 0.70) < 0.01


def test_facecam_box_priority_template_over_signals():
    edits, signals = _fixture_edits_signals()
    spec = resolve_template_geometry(TEMPLATES["G1"], signals, edits)
    face = spec["panels"][0]["src"]
    assert face["x"] == 0.75


@pytest.mark.parametrize("template_id", ["I1", "I3", "I4", "G3", "G4"])
def test_geometry_snapshot_unchanged(template_id: str):
    FIX.mkdir(parents=True, exist_ok=True)
    path = FIX / f"{template_id}.json"
    edits, signals = _fixture_edits_signals()
    edits["layout"]["template"]["id"] = template_id
    spec = resolve_template_geometry(TEMPLATES[template_id], signals, edits)
    payload = json.dumps(spec, sort_keys=True, separators=(",", ":"))
    if not path.is_file():
        path.write_text(payload)
        pytest.skip("wrote fixture")
    assert path.read_text() == payload
