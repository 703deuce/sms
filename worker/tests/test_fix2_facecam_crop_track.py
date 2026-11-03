from __future__ import annotations

import json

import clips_worker.pipeline as pl


def _probe(_video):
    return 1920, 1080, 30.0, 2000


def test_facecam_box_from_edits():
    ed = {"layout": {"facecam": {"box": {"x": 0.02, "y": 0.02, "w": 0.32, "h": 0.28}}}}
    assert pl.facecam_box_from_edits(ed) == {"x": 0.02, "y": 0.02, "w": 0.32, "h": 0.28}
    assert pl.facecam_box_from_edits({"layout": {"mode": "speaker_follow"}}) is None
    assert pl.facecam_box_from_edits(None) is None
    assert pl.facecam_box_from_edits({"layout": {"facecam": {"box": {"x": 0, "y": 0, "w": 0, "h": 0.2}}}}) is None


def test_facecam_track_centres_on_box(tmp_path, monkeypatch):
    monkeypatch.setattr(pl, "_probe_video_basics", _probe)
    out = tmp_path / "crop.json"
    pl.write_facecam_crop_track(tmp_path / "v.mp4", out, 5000, {"x": 0.02, "y": 0.02, "w": 0.32, "h": 0.28})
    t = json.loads(out.read_text())
    assert t["cw"] == 608
    assert t["x0"][0] == 42  # (0.02+0.16)*1920 - 304 = 41.6 -> 42
    assert len(t["x0"]) == 60
    assert set(t["x0"]) == {42} and t["x0_A"] == t["x0"] and t["x0_B"] == t["x0"]
    assert t["t0_ms"] == 5000 and t["shots"][0]["end_ms"] == 7000


def test_facecam_track_clamps_right_edge(tmp_path, monkeypatch):
    monkeypatch.setattr(pl, "_probe_video_basics", _probe)
    out = tmp_path / "crop.json"
    pl.write_facecam_crop_track(tmp_path / "v.mp4", out, 0, {"x": 0.8, "y": 0.0, "w": 0.2, "h": 0.3})
    assert json.loads(out.read_text())["x0"][0] == 1920 - 608


def test_preview_track_falls_back_to_fit_blur(tmp_path, monkeypatch):
    monkeypatch.setattr(pl, "_probe_video_basics", _probe)
    out = tmp_path / "crop.json"
    pl.write_preview_crop_track(tmp_path / "v.mp4", out, 0, {"layout": {"mode": "fit"}})
    t = json.loads(out.read_text())
    assert t["cw"] == 1920 and t["x0"][0] == -1
