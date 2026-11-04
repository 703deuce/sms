import pytest

from clips_worker.bg_removal import (
    bg_removal_active,
    normalize_bg_removal,
    refine_alpha,
)
from clips_worker.edits_render import default_edits, is_default_edits


def test_normalize_clamps():
    out = normalize_bg_removal(
        {
            "enabled": True,
            "quality": "x",
            "refine": {"feather": 999, "choke": -500},
            "background": {"type": "color", "color": "#ABCDEF"},
        }
    )
    assert out == {
        "enabled": True,
        "quality": "standard",
        "refine": {"feather": 100, "choke": -100},
        "background": {"type": "color", "color": "abcdef"},
    }


def test_refine_alpha_parity():
    assert refine_alpha(0.3, 0, 40) == pytest.approx(0.125)


def test_is_default_edits_bg_removal(monkeypatch):
    monkeypatch.delenv("BG_MATTE_ENABLED", raising=False)
    edits = default_edits(0, 1000)
    edits["bgRemoval"] = {"enabled": True, "background": {"type": "blur", "amount": 50}}
    assert is_default_edits(edits, 0, 1000) is False


def test_bg_removal_active_defaults_on_with_explicit_opt_out(monkeypatch):
    monkeypatch.delenv("BG_MATTE_ENABLED", raising=False)
    edits = {
        "trim": {"in": 0, "out": 1000},
        "layout": {"mode": "speaker_follow", "shotOverrides": []},
        "bgRemoval": {"enabled": True, "background": {"type": "blur", "amount": 50}},
    }
    assert bg_removal_active(edits) is not None
    monkeypatch.setenv("BG_MATTE_ENABLED", "0")
    assert bg_removal_active(edits) is None


def test_bg_removal_active_allows_full_frame_and_layout_changes(monkeypatch):
    monkeypatch.setenv("BG_MATTE_ENABLED", "1")
    edits = {
        "trim": {"in": 0, "out": 1000},
        "layout": {"mode": "full_frame", "shotOverrides": [], "layoutSegments": [
            {"startMs": 0, "endMs": 500, "mode": "full_frame"},
            {"startMs": 500, "endMs": 1000, "mode": "speaker_follow"},
        ]},
        "bgRemoval": {"enabled": True, "background": {"type": "blur", "amount": 50}},
    }
    assert bg_removal_active(edits) is not None


def test_bg_removal_active_blocks_stack_layout(monkeypatch):
    monkeypatch.setenv("BG_MATTE_ENABLED", "1")
    edits = {
        "trim": {"in": 0, "out": 1000},
        "layout": {"mode": "stack", "shotOverrides": []},
        "bgRemoval": {"enabled": True, "background": {"type": "blur", "amount": 50}},
    }
    assert bg_removal_active(edits) is None
