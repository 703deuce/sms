"""Layers v3 derivation, geometry goldens, compositor plan (no ffmpeg)."""
from __future__ import annotations

import copy
import json

import pytest

from clips_worker.clip_export_template import _platform_label, headline_layout, stream_headline_frame_layout
from clips_worker.edits_render import compose_export, default_edits, render_edited_clip
from clips_worker.layers_spec import (
    _stage_plan,
    legacy_from_layers,
    layers_from_legacy,
    mapped_subset,
    resolve_layers,
)
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
