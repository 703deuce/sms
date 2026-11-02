"""CLIPS_OPUS_fix2: stack/fit preview caption burn (new file only)."""
from __future__ import annotations

from pathlib import Path

from clips_worker.clip_layout_render import ClipLayoutApplyResult
from clips_worker.pipeline import _burn_preview_captions, reframe_clip_preview


def _fixture_paths(tmp_path: Path):
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"clip")
    out = tmp_path / "preview.mp4"
    words = tmp_path / "words.json"
    words.write_text('[{"w":"hello","s":0.0,"e":1.0,"p":1}]')
    work = tmp_path / "work"
    work.mkdir()
    crop = tmp_path / "crop.json"
    crop.write_text("{}")
    ai_meta: dict = {}
    return clip, out, words, work, crop, ai_meta


def test_fit_blur_preview_calls_burn_captions(monkeypatch, tmp_path):
    clip, out, words, work, crop, ai_meta = _fixture_paths(tmp_path)
    calls: list = []

    def fake_fit(_src, dest, w, h, **_kw):
        dest.write_bytes(b"fitvid")

    def fake_burn(_video, _words, dest, _wd, *, edits_captions, play_w, play_h, edits=None):
        calls.append({"edits_captions": edits_captions, "play_w": play_w, "play_h": play_h, "edits": edits})
        dest.write_bytes(b"captioned")

    monkeypatch.setattr("clips_worker.render_clip.ffmpeg_fit_export", fake_fit)
    monkeypatch.setattr("clips_worker.edits_render.burn_captions", fake_burn)
    monkeypatch.setattr("clips_worker.pipeline.write_fit_blur_crop_track", lambda *a, **k: None)

    caps = {"enabled": True, "presetId": "bold_pop"}
    settings = {"aspectRatio": "9:16", "layoutMode": "full_frame", "captions": caps}
    edits = {"captions": dict(caps)}

    reframe_clip_preview(
        clip,
        out,
        words,
        settings,
        work,
        0,
        crop,
        ai_meta,
        motion_subject=False,
        edits=edits,
    )

    assert len(calls) == 1
    assert calls[0]["play_w"] == 720
    assert calls[0]["play_h"] == 1280
    assert calls[0]["edits_captions"].get("enabled") is not False


def test_facecam_stack_preview_calls_burn_captions(monkeypatch, tmp_path):
    clip, out, words, work, crop, ai_meta = _fixture_paths(tmp_path)
    calls: list = []

    def fake_apply(_src, wd, _edits, *, play_w, play_h):
        stacked = wd / "stack.mp4"
        stacked.write_bytes(b"stack")
        return ClipLayoutApplyResult(stacked, True, seam_captions=True, stack_split=0.35)

    def fake_burn(_video, _words, dest, _wd, *, edits_captions, play_w, play_h, edits=None):
        calls.append({"edits_captions": edits_captions, "play_w": play_w, "play_h": play_h})
        dest.write_bytes(b"captioned")

    monkeypatch.setattr("clips_worker.clip_layout_render.apply_per_clip_layout", fake_apply)
    monkeypatch.setattr("clips_worker.edits_render.burn_captions", fake_burn)

    caps = {"enabled": True, "presetId": "bold_pop"}
    settings = {"aspectRatio": "9:16", "layoutMode": "facecam_stack"}
    edits = {
        "captions": dict(caps),
        "layout": {
            "mode": "facecam_stack",
            "facecam": {"position": "top", "split": 0.35},
        },
    }

    reframe_clip_preview(
        clip,
        out,
        words,
        settings,
        work,
        0,
        crop,
        ai_meta,
        motion_subject=False,
        edits=edits,
    )

    assert len(calls) == 1
    assert calls[0]["play_w"] == 720
    assert calls[0]["play_h"] == 1280
    assert calls[0]["edits_captions"].get("captionSeamStack") is True


def test_preview_captions_not_burned_when_disabled(monkeypatch, tmp_path):
    clip, out, words, work, crop, ai_meta = _fixture_paths(tmp_path)
    calls: list = []

    monkeypatch.setattr(
        "clips_worker.render_clip.ffmpeg_fit_export",
        lambda _s, dest, _w, _h, **_k: dest.write_bytes(b"fit"),
    )
    monkeypatch.setattr(
        "clips_worker.edits_render.burn_captions",
        lambda *a, **k: calls.append(1),
    )
    monkeypatch.setattr("clips_worker.pipeline.write_fit_blur_crop_track", lambda *a, **k: None)

    settings = {"aspectRatio": "9:16", "layoutMode": "full_frame", "captions": {"enabled": False}}
    edits = {"captions": {"enabled": False}}

    reframe_clip_preview(
        clip,
        out,
        words,
        settings,
        work,
        0,
        crop,
        ai_meta,
        motion_subject=False,
        edits=edits,
    )
    assert calls == []


def test_preview_caption_burn_failure_restores_uncaptioned(tmp_path, monkeypatch):
    clip_body = b"uncaptioned-bytes"
    out = tmp_path / "preview.mp4"
    out.write_bytes(clip_body)
    words = tmp_path / "words.json"
    words.write_text('[{"w":"x","s":0.0,"e":0.5}]')
    work = tmp_path / "work"
    work.mkdir()

    def boom(*_a, **_k):
        raise RuntimeError("ffmpeg fail")

    monkeypatch.setattr("clips_worker.edits_render.burn_captions", boom)

    _burn_preview_captions(
        out,
        words,
        {"captions": {"enabled": True}},
        {"captions": {"enabled": True}},
        work,
        720,
        1280,
    )
    assert out.read_bytes() == clip_body
