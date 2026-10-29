"""Export MP4 parity: stream headline on speaker_follow must use fit_top compose + captions, not exportBar stack."""
from __future__ import annotations

from pathlib import Path

import pytest

from clips_worker.edits_render import _legacy_compose
from clips_worker.layout_router import export_stream_headline_compose_active, stream_compose_layout_mode
from clips_worker.stream_headline_ass import headline_ass_content


def _stream_headline_edits() -> dict:
    return {
        "v": 2,
        "trim": {"in": 0, "out": 6640},
        "cutRanges": [],
        "wordFixes": {},
        "layout": {"mode": "speaker_follow", "shotOverrides": []},
        "captions": {"enabled": True, "presetId": "bold_pop", "position": "bottom"},
        "exportTemplate": {
            "headlineBar": {"enabled": True, "text": "AFTER KOBE REACTION THERE WE GO"},
            "platformBadge": {"enabled": True},
            "platform": "twitch",
        },
    }


def test_export_stream_headline_compose_active_for_speaker_follow():
    edits = _stream_headline_edits()
    assert export_stream_headline_compose_active(edits)
    assert stream_compose_layout_mode(edits) == "fit_top"


def test_legacy_compose_stream_headline_skips_apply_export_template(monkeypatch, tmp_path):
    src = tmp_path / "in.mp4"
    src.write_bytes(b"\x00")
    out = tmp_path / "out.mp4"
    work = tmp_path / "work"
    work.mkdir()
    edits = _stream_headline_edits()
    calls: dict[str, int] = {"stream": 0, "template": 0, "captions": 0}

    def fake_stream(a, b, c, mode, **kw):
        calls["stream"] += 1
        assert mode == "fit_top"
        b.write_bytes(b"\x00")

    def fake_burn(video, words, final, work_dir, cap_edits, **kw):
        calls["captions"] += 1
        assert cap_edits.get("marginVPct") == 6
        final.write_bytes(b"\x00")

    def fake_apply(*args, **kwargs):
        calls["template"] += 1
        return args[0]

    monkeypatch.setattr(
        "clips_worker.streamer.layout.stream_frame.render_stream_clip_layout",
        fake_stream,
    )
    monkeypatch.setattr("clips_worker.edits_render.burn_captions", fake_burn)
    monkeypatch.setattr("clips_worker.clip_export_template.apply_export_template", fake_apply)

    ctx = {
        "work_dir": work,
        "play_w": 1080,
        "play_h": 1920,
        "length_s": 6.64,
        "conn": None,
        "project_id": "p1",
        "clip_id": "c1",
        "clip_start_ms": 0,
        "clip_end_ms": 6640,
    }
    _legacy_compose(src, [], out, edits, ctx)
    assert calls["stream"] == 1
    assert calls["captions"] == 1
    assert calls["template"] == 0


def test_headline_ass_uses_anton_for_stream_yellow_style():
    from clips_worker.clip_export_template import _headline_style_from_edits

    style = _headline_style_from_edits(_stream_headline_edits())
    ass = headline_ass_content(
        "TEST HEADLINE",
        play_w=1080,
        play_h=1920,
        bar_h=320,
        duration_ms=6640,
        fit_top=True,
        headline_style=style,
    )
    assert "Style: Headline,Anton," in ass
    style_line = [ln for ln in ass.splitlines() if ln.startswith("Style: Headline,")][0]
    assert "Montserrat" not in style_line.split(",")[1]


def test_compose_layout_export_bar_has_no_top_gap():
    from clips_worker.streamer.layout.stream_frame import _compose_layout

    lay = _compose_layout(_stream_headline_edits(), 3, play_w=1080, play_h=1920)
    assert lay["headline_top"] == 0
    assert lay["video_y"] == lay["headline_h"]


def test_fit_top_band_single_badge_when_v3_sprite(monkeypatch, tmp_path):
    from clips_worker.streamer.layout import stream_frame as sf

    src = tmp_path / "in.mp4"
    src.write_bytes(b"\x00")
    dest = tmp_path / "out.mp4"
    edits = _stream_headline_edits()
    edits["layersV"] = 3
    edits["layers"] = [
        {
            "id": "badge",
            "type": "badge",
            "enabled": True,
            "platform": "twitch",
            "showLabel": True,
            "showLogo": True,
        }
    ]
    legacy_drawtext: list[str] = []

    def fake_check_call(cmd, *args, **kwargs):
        joined = " ".join(str(x) for x in cmd)
        if "drawtext" in joined and "TWITCH" in joined.upper():
            legacy_drawtext.append(joined)

    monkeypatch.setattr(sf.subprocess, "check_call", fake_check_call)
    monkeypatch.setattr(sf, "_fit_top_base", lambda *a, **k: dest.parent.joinpath("stage.mp4").write_bytes(b"x"))
    monkeypatch.setattr(sf, "_probe_duration_s", lambda _v: 6.0)
    monkeypatch.setattr(
        sf,
        "burn_stream_headline",
        lambda video, out, *a, **k: out.write_bytes(b"x") or out,
    )

    sf.render_fit_top_stream(src, dest, edits, play_w=1080, play_h=1920)
    assert legacy_drawtext == []
