import json
from pathlib import Path

import pytest

from clips_worker.edits_render import render_edited_clip
from clips_worker.preview_edits_match import preview_export_matches
from clips_worker.render_clip import prepare_speakercrop_gpu_render
from clips_worker.stream_headline_ass import _headline_font_from_style


def test_preview_fast_invokes_compose(monkeypatch, tmp_path):
    clip_src = tmp_path / "in.mp4"
    clip_src.write_bytes(b"\x00")
    out_mp4 = tmp_path / "out.mp4"
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    edits = {
        "v": 2,
        "trim": {"in": 0, "out": 6000},
        "cutRanges": [],
        "wordFixes": {},
        "layout": {"mode": "speaker_follow", "shotOverrides": []},
        "captions": {"enabled": True, "presetId": "bold_pop"},
    }
    words = [{"w": "hi", "s": 0.0, "e": 0.4, "i": 0}]
    assert preview_export_matches(edits, 0, 6000)

    compose_calls: list[tuple] = []

    def fake_speakercrop(*args, **kwargs):
        dest = args[1]
        dest.write_bytes(b"\x00")
        return dest

    def fake_compose(src, caption_words, dest, ed, ctx):
        compose_calls.append((src, ed.get("captions", {}).get("enabled")))
        dest.write_bytes(b"\x00")
        return dest, caption_words

    monkeypatch.setattr("clips_worker.edits_render.run_speakercrop_layout_timeline", fake_speakercrop)
    monkeypatch.setattr("clips_worker.edits_render.compose_export", fake_compose)

    render_edited_clip(
        clip_src,
        out_mp4,
        words,
        edits,
        0,
        6000,
        {"aspectRatio": "9:16", "exportResolution": "1080p", "layout": "speaker_follow"},
        work_dir,
    )
    assert compose_calls, "preview_fast path must burn captions/export overlays via compose_export"


def test_gpu_prepare_skips_dynamic_speaker_follow(tmp_path):
    track = tmp_path / "crop.crop_track.json"
    track.write_text(json.dumps({"v": 1, "version": 1, "segments": []}))
    clip_src = tmp_path / "in.mp4"
    clip_src.write_bytes(b"\x00")
    out_mp4 = tmp_path / "out.mp4"
    words_path = tmp_path / "words.json"
    words_path.write_text("[]")
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    prep = prepare_speakercrop_gpu_render(
        clip_src,
        out_mp4,
        words_path,
        {"layout": "speaker_follow", "aspectRatio": "9:16", "exportResolution": "1080p"},
        work_dir,
        0,
        track,
        None,
        None,
        False,
        0,
        "ws",
        "proj",
        "clip",
        existing_crop_track=track,
    )
    assert prep is None


def test_headline_font_from_layer_style():
    assert _headline_font_from_style({"font": "Anton"}, fit_top=False) == "Anton"
    assert _headline_font_from_style({"font": "Poppins"}, fit_top=False) == "Poppins"


def test_v3_badge_skips_legacy_drawtext():
    from clips_worker.clip_export_template import _v3_badge_sprite_will_render

    edits = {
        "v": 2,
        "trim": {"in": 0, "out": 1000},
        "cutRanges": [],
        "layout": {"mode": "speaker_follow", "shotOverrides": []},
        "exportTemplate": {"platformBadge": {"enabled": True}, "platform": "twitch"},
        "layersV": 3,
        "layers": [
            {
                "id": "badge",
                "type": "badge",
                "enabled": True,
                "platform": "twitch",
                "showLabel": True,
                "showLogo": True,
            }
        ],
    }
    assert _v3_badge_sprite_will_render(edits)
