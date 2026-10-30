"""T6.2 unit tests (spec T6_2_fixes.md)."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from clips_worker.captions_ass import build_ass, cp_effective_captions
from clips_worker.edits_render import _merge_headline_style_burn, _t6_caption_edits
from clips_worker.t6_geometry import resolve_template_geometry
from clips_worker.t6_registry import TEMPLATES
from clips_worker.t6_signals import signals_or_defaults

SPECS = Path(__file__).resolve().parents[2] / "specs" / "T6_2_patches" / "fixtures"
FIX = Path(__file__).resolve().parent / "fixtures"
A_META = json.loads((SPECS / "A_db.json").read_text())
B_META = json.loads((SPECS / "B_db.json").read_text())


def test_cp_effective_captions_strips_stale_keys():
    cap = {
        "presetId": "cp11",
        "presetConfig": {"font": "Montserrat Black", "primary": "#FFFFFF"},
        "colors": {"a": "#FFD93D"},
        "size": 6.5,
        "animation": "pop",
    }
    out = cp_effective_captions(cap)
    assert out["presetId"] == "cp11"
    assert "presetConfig" not in out
    assert "colors" not in out
    assert "size" not in out
    assert "animation" not in out


def test_build_ass_cp11_layer_events(tmp_path):
    words = [{"w": "hello", "s": 0.0, "e": 0.35, "i": 0}, {"w": "world", "s": 0.4, "e": 0.75, "i": 1}]
    ass_path = tmp_path / "cp11.ass"
    build_ass(words, {"presetId": "cp11", "enabled": True, "wordsPerLine": 3}, ass_path, play_w=1080, play_h=1920)
    text = ass_path.read_text()
    assert "Dialogue: 0," in text
    assert "Dialogue: 2," in text
    assert "\\3c&H" in text
    assert "&HFF000000&" not in text


def test_build_ass_bold_pop_unchanged(tmp_path):
    golden = FIX / "t6_2_bold_pop.ass"
    words = [{"w": "test", "s": 0.0, "e": 0.4, "i": 0}]
    out = tmp_path / "bold.ass"
    build_ass(words, {"presetId": "bold_pop", "enabled": True}, out, play_w=1080, play_h=1920)
    if not golden.is_file():
        golden.parent.mkdir(parents=True, exist_ok=True)
        golden.write_text(out.read_text())
        pytest.skip("wrote golden")
    assert out.read_text() == golden.read_text()


def test_t6_caption_edits_margin_v():
    cap = {"enabled": True, "presetId": "cp3"}
    spec = {"captionRect": {"y": 1382, "h": 230}}
    out = _t6_caption_edits(cap, spec, 1920)
    assert out["_assMarginV"] == 308
    assert out["_assAlignment"] == 2


def test_merge_headline_style_burn_keeps_t6_id():
    burn = {"exportTemplate": {"headlineBar": {"enabled": True, "text": "X"}}}
    layers = [{"id": "headline", "style": {"kind": "export_bar", "textColor": "#000"}}]
    edits = {"exportTemplate": {"headlineStyle": {"t6Id": "white_box_black"}}}
    out = _merge_headline_style_burn(burn, layers, edits)
    assert out["exportTemplate"]["headlineStyle"] == {"t6Id": "white_box_black"}


def test_merge_headline_style_burn_without_t6_id_uses_layer():
    burn = {"exportTemplate": {}}
    layers = [{"id": "headline", "style": {"kind": "export_bar"}}]
    out = _merge_headline_style_burn(burn, layers, {})
    assert out["exportTemplate"]["headlineStyle"] == {"kind": "export_bar"}


def _edits_signals_from_meta(meta: dict):
    edits = json.loads(json.dumps(meta["edits"]))
    signals = signals_or_defaults(meta["aiMeta"])
    return edits, signals


def test_g3_game_panel_uses_gameplay_src():
    edits, signals = _edits_signals_from_meta(A_META)
    edits["layout"]["template"] = {"id": "G3", "auto": False}
    spec = resolve_template_geometry(TEMPLATES["G3"], signals, edits)
    game = next(p for p in spec["panels"] if p.get("role") == "game" or p == spec["panels"][-1])
    gameplay = (signals.get("facecamLayout") or {}).get("gameplay") or signals.get("signals", {}).get("gameplay")
    if isinstance(gameplay, dict):
        assert game["src"]["w"] == pytest.approx(gameplay["w"], abs=0.05)
    pip = spec.get("pip") or {}
    if pip:
        assert pip["dest"]["w"] >= int(0.6 * 1080) - 2


def test_i4_full_width_src():
    edits, signals = _edits_signals_from_meta(B_META)
    edits["layout"]["template"] = {"id": "I4", "auto": False}
    spec = resolve_template_geometry(TEMPLATES["I4"], signals, edits)
    src = spec["panels"][0]["src"]
    assert src["w"] >= 0.98


def test_pipeline_bold_pop_default_allows_autopick(tmp_path):
    from clips_worker.pipeline import _finalize_regular_clip_edits

    clip = tmp_path / "c.mp4"
    clip.write_bytes(b"\x00")
    edits = {"captions": {"enabled": True, "presetId": "bold_pop"}, "layout": {"mode": "fit_blur"}}
    settings = {"captions": {"presetId": "bold_pop"}, "t6": {"captions": True, "templates": True}}
    pick = {"aiMeta": B_META["aiMeta"], "id": "clip-test"}

    with patch("clips_worker.t6_flags.t6_caption_presets_enabled", return_value=True), patch(
        "clips_worker.t6_render.probe_duration_s", return_value=11.0
    ), patch(
        "clips_worker.t6_captions.pick_caption_preset", return_value=("cp7", "test")
    ) as mock_pick, patch(
        "clips_worker.pipeline._regular_clip_type_and_layout",
        return_value=(edits, {"clipType": "irl", "signals": {}}, None),
    ):
        out, _, _ = _finalize_regular_clip_edits(edits, clip, [], settings, "regular", pick=pick)
        mock_pick.assert_called_once()
        assert out["captions"]["presetId"] == "cp7"

    settings2 = {**settings, "captions": {"presetId": "bold_pop", "userChosen": True}}
    with patch("clips_worker.t6_flags.t6_caption_presets_enabled", return_value=True), patch(
        "clips_worker.pipeline._regular_clip_type_and_layout",
        return_value=(edits, {"clipType": "irl", "signals": {}}, None),
    ):
        out2, _, _ = _finalize_regular_clip_edits(edits, clip, [], settings2, "regular", pick=pick)
        assert out2["captions"]["presetId"] == "bold_pop"

    settings3 = {**settings, "captions": {"presetId": "neon"}}
    with patch("clips_worker.t6_flags.t6_caption_presets_enabled", return_value=True), patch(
        "clips_worker.pipeline._regular_clip_type_and_layout",
        return_value=(edits, {"clipType": "irl", "signals": {}}, None),
    ):
        out3, _, _ = _finalize_regular_clip_edits(edits, clip, [], settings3, "regular", pick=pick)
        assert out3["captions"]["presetId"] == "neon"
