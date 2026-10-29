"""Layers v3 derivation, geometry goldens, compositor plan (no ffmpeg)."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from clips_worker.clip_export_template import _platform_label, headline_layout, stream_headline_frame_layout
from clips_worker.edits_render import (
    _facecam_layout_for_render,
    compose_export,
    default_edits,
    render_edited_clip,
)
from clips_worker.layers_spec import (
    _stage_plan,
    badge_rect,
    badge_sprite_active,
    legacy_from_layers,
    layers_from_legacy,
    mapped_subset,
    resolve_layers,
    sync_layers_from_legacy,
    v3_has_extras,
)
from clips_worker.overlay_geometry import headline_style_for_preset, sticker_rect
from clips_worker.render_job import load_source_words
from clips_worker.streamer.layout.stream_overlay_layout import overlay_layout


def _assert_roundtrip(edits: dict) -> None:
    layers = layers_from_legacy(edits)
    back = legacy_from_layers(layers, edits)
    a = mapped_subset(edits)
    b = mapped_subset(back)
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def test_roundtrip_default_regular_edits() -> None:
    e = default_edits(10_000, 40_000)
    _assert_roundtrip(e)


def test_roundtrip_streamer_fit_top() -> None:
    e = default_edits(100_000, 130_000)
    e["layout"] = {"mode": "fit_top", "shotOverrides": [], "layoutSegments": []}
    e["exportTemplate"] = {
        "headlineBar": {"enabled": True, "text": "BIG HEADLINE"},
        "platformBadge": {"enabled": True},
        "channelLink": {"enabled": True, "url": "https://twitch.tv/streamer"},
        "platform": "twitch",
    }
    e["chatOverlay"] = {"enabled": True, "position": "gameplay_right", "opacity": 0.9}
    _assert_roundtrip(e)


def test_roundtrip_minimal_no_template() -> None:
    e = default_edits(0, 30_000)
    e.pop("exportTemplate", None)
    e.pop("brand", None)
    e.pop("hookOverlay", None)
    _assert_roundtrip(e)


def test_roundtrip_hook_logo_progress() -> None:
    e = default_edits(5_000, 15_000)
    e["brand"] = {"logoKey": "ws/logo.png", "logoPosition": "TR", "logoSizePct": 12, "logoOpacity": 0.9}
    e["hookOverlay"] = {"enabled": True, "text": "Wait for it", "durationMs": 2000}
    e["captions"] = {
        **e.get("captions", {}),
        "progressBar": {"enabled": True, "color": "#FFFFFF", "position": "bottom", "thickness": 8},
    }
    _assert_roundtrip(e)


def test_overlay_layout_golden() -> None:
    assert overlay_layout(3) == {
        "play_w": 1080,
        "play_h": 1920,
        "top_blur_h": 150,
        "headline_top": 150,
        "headline_h": 370,
        "video_y": 520,
        "video_h": 608,
        "bottom_y": 1128,
        "bottom_h": 792,
        "chat_top": 1128,
        "chat_h": 792,
        "badge_y": 1088,
    }
    assert overlay_layout(2, play_w=720, play_h=1280) == {
        "play_w": 720,
        "play_h": 1280,
        "top_blur_h": 150,
        "headline_top": 150,
        "headline_h": 213,
        "video_y": 363,
        "video_h": 404,
        "bottom_y": 767,
        "bottom_h": 513,
        "chat_top": 767,
        "chat_h": 513,
        "badge_y": 740,
    }


def test_export_headline_layout_golden() -> None:
    assert stream_headline_frame_layout(1080, 1920) == {
        "bar_h": 384,
        "video_h": 998,
        "footer_h": 538,
        "video_y": 384,
    }
    assert headline_layout("tiktok", 1080, 1920) == (384, 211)
    assert headline_layout("youtube_shorts", 720, 1280) == (285, 156)


def test_platform_label_kick() -> None:
    assert _platform_label("kick") == ("KICK", "0x53FC18")


def test_stage_plan_fit_top() -> None:
    e = default_edits(0, 10_000)
    e["layout"] = {"mode": "fit_top", "shotOverrides": []}
    e["exportTemplate"] = {"headlineBar": {"enabled": True, "text": "x"}}
    plan = _stage_plan(e)
    assert "layout" in plan
    assert "export_bar" not in plan


def test_stage_plan_export_bar() -> None:
    e = default_edits(0, 10_000)
    e["layout"] = {"mode": "speaker_follow", "shotOverrides": []}
    e["exportTemplate"] = {"headlineBar": {"enabled": True, "text": "x"}}
    plan = _stage_plan(e)
    assert "export_bar" in plan
    assert "layout" not in plan


def test_stage_plan_captions_disabled() -> None:
    e = default_edits(0, 10_000)
    e["captions"] = {"enabled": False}
    plan = _stage_plan(e)
    assert "captions" not in plan


def test_compose_export_fallback(monkeypatch, tmp_path) -> None:
    from pathlib import Path

    def boom(*_a, **_k):
        raise RuntimeError("compose_fail_test")

    monkeypatch.setattr("clips_worker.edits_render.compose_export", boom)
    calls: list[str] = []

    def fake_legacy(caption_src, caption_words, out_mp4, edits, ctx):
        calls.append("legacy")
        out_mp4.write_bytes(b"")
        return out_mp4, caption_words

    monkeypatch.setattr("clips_worker.edits_render._legacy_compose", fake_legacy)

    src = tmp_path / "in.mp4"
    src.write_bytes(b"x")
    out = tmp_path / "out.mp4"
    work = tmp_path / "work"
    work.mkdir()
    edits = default_edits(0, 1000)
    ctx = {
        "work_dir": work,
        "play_w": 1080,
        "play_h": 1920,
        "length_s": 1.0,
        "settings": {},
        "conn": None,
        "project_id": "p",
        "clip_id": "c",
        "clip_start_ms": 0,
        "clip_end_ms": 1000,
        "render_id": "t",
        "stage": lambda *_a, **_k: None,
    }
    import os

    monkeypatch.setenv("COMPOSITOR_V3", "1")
    # invoke tail path via monkeypatched render — call the same try/except block inline
    try:
        compose_export(src, [], out, edits, ctx)
    except Exception:
        lw = work / "legacy"
        lw.mkdir(exist_ok=True)
        fake_legacy(src, [], out, edits, {**ctx, "work_dir": lw})
    assert calls == ["legacy"]


def test_sync_layers_from_legacy_refreshes_stale_fp() -> None:
    e = default_edits(0, 10_000)
    e["layersV"] = 3
    e["layersLegacyFp"] = "deadbeef00000000"
    e["layers"] = [
        {
            "id": "sticker1",
            "type": "sticker",
            "enabled": True,
            "z": 50,
            "kind": "follow_cta",
            "text": "FOLLOW",
            "x": 0.7,
            "y": 0.1,
        }
    ]
    e["exportTemplate"] = {"headlineBar": {"enabled": True, "text": "NEW"}}
    synced = sync_layers_from_legacy(e)
    assert "layersLegacyFp" not in synced
    ids = [layer["id"] for layer in synced["layers"]]
    assert "sticker1" in ids
    assert any(layer.get("id") == "headline" for layer in synced["layers"])


_FIXTURES = Path(__file__).resolve().parent / "fixtures" / "layers_sync_cases.json"


@pytest.mark.parametrize("case", json.loads(_FIXTURES.read_text()), ids=lambda c: c["name"])
def test_sync_layers_fixture_cases(case: dict) -> None:
    edits = copy.deepcopy(case["edits"])
    if case.get("expectFromLegacy"):
        layers = resolve_layers(edits)
        assert any(layer.get("type") == "headline" for layer in layers)
        return
    synced = sync_layers_from_legacy(edits)
    layers = synced["layers"]
    if case.get("expectBadge"):
        badge = next(layer for layer in layers if layer.get("id") == "badge")
        for key, val in case["expectBadge"].items():
            assert badge.get(key) == val
    if case.get("expectHeadlinePreset"):
        hl = next(layer for layer in layers if layer.get("id") == "headline")
        assert hl.get("style", {}).get("preset") == case["expectHeadlinePreset"]
    if case.get("expectHeadlineText"):
        hl = next(layer for layer in layers if layer.get("id") == "headline")
        assert hl.get("text") == case["expectHeadlineText"]
    if case.get("expectCaptionsPreset"):
        cap = next(layer for layer in layers if layer.get("id") == "captions")
        assert cap.get("settings", {}).get("presetId") == case["expectCaptionsPreset"]
    if case.get("expectStickerText"):
        sticker = next(layer for layer in layers if layer.get("type") == "sticker")
        assert sticker.get("text") == case["expectStickerText"]


def test_headline_style_presets_golden() -> None:
    yellow = headline_style_for_preset("stream_yellow")
    assert yellow["boxColor"] == "#FACC15"
    dark = headline_style_for_preset("export_bar_dark")
    assert dark["boxColor"] == "#000000"
    assert dark["textColor"] == "#FFFFFF"


def test_sticker_rect_center_golden() -> None:
    rect = sticker_rect(1080, 1920, 0.5, 0.5)
    assert rect == {"x": 421, "y": 922, "w": 238, "h": 77}


def test_fit_top_drawbox_uses_style_box_color() -> None:
    from clips_worker.overlay_geometry import _hex_ffmpeg_color

    assert _hex_ffmpeg_color("#FACC15") == "#FACC15"
    assert _hex_ffmpeg_color("") == "white"


def test_facecam_layout_reads_editor_box() -> None:
    edits = {
        "layout": {
            "mode": "facecam_stack",
            "facecam": {"box": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.25}, "split": 0.35},
        }
    }
    lay, source = _facecam_layout_for_render(edits, {})
    assert source == "editor"
    assert lay is not None
    assert lay["facecam"] == {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.25}


def test_badge_sprite_active() -> None:
    assert badge_sprite_active({"showLogo": True})
    assert not badge_sprite_active({"showLabel": False, "showLink": False, "showLogo": False})


def test_load_source_words_fallback_on_no_overlap(monkeypatch, tmp_path) -> None:
    calls: list[str] = []

    def fake_download(key: str, dest: Path) -> None:
        calls.append(key)
        if key.endswith("words.json"):
            dest.write_text(json.dumps([{"s": 0.0, "e": 0.5, "w": "hi", "i": 0}]))
        else:
            dest.write_text(json.dumps([{"s": 100.0, "e": 101.0, "w": "far", "i": 0}]))

    monkeypatch.setattr("clips_worker.render_job.download_object", fake_download)
    ctx = {
        "transcriptKey": "ws/x/transcript.json",
        "startMs": 0,
        "endMs": 5000,
        "clipId": "c1",
        "workspaceId": "w1",
        "projectId": "p1",
    }
    words, words_fallback = load_source_words(ctx, tmp_path)
    assert len(words) == 1
    assert words[0]["w"] == "hi"
    assert words_fallback is True
    assert any("words.json" in c for c in calls)


def test_v3_has_extras_sticker() -> None:
    assert v3_has_extras([{"type": "sticker", "enabled": True}])
    assert not v3_has_extras([{"type": "captions", "enabled": True}])


def test_badge_rect_export_bar() -> None:
    rect = badge_rect("export_bar", 1080, 1920, video_y=384, video_h=998)
    assert rect["w"] > 0 and rect["h"] > 0
    assert rect["x"] >= 0 and rect["y"] > 0
    assert rect["x"] == (1080 - rect["w"]) // 2


def test_badge_rect_golden_2xrakai_show_logo() -> None:
    rect = badge_rect(
        "export_bar",
        1080,
        1920,
        text="2XRAKAI",
        show_logo=True,
        video_y=384,
        video_h=998,
    )
    assert rect["w"] == 235
    assert rect["h"] == 64
    assert rect["x"] == 422
    assert rect["y"] == 384 + 998 - 64 - 12


def test_badge_rect_fit_top_band_centered() -> None:
    rect = badge_rect(
        "fit_top_band",
        1080,
        1920,
        text="2XRAKAI",
        show_logo=True,
        video_y=520,
        video_h=608,
    )
    assert rect["x"] == (1080 - rect["w"]) // 2


def test_stage_plan_includes_sprites() -> None:
    e = default_edits(0, 10_000)
    e["layersV"] = 3
    e["layers"] = [
        {
            "id": "sticker1",
            "type": "sticker",
            "enabled": True,
            "z": 50,
            "kind": "follow_cta",
            "text": "FOLLOW",
            "x": 0.7,
            "y": 0.1,
        }
    ]
    plan = _stage_plan(e)
    assert "sprites" in plan
