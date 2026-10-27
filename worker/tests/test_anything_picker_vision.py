from pathlib import Path
from unittest.mock import MagicMock

import pytest


def test_pick_anything_clips_calls_gemini_rank_with_frames(tmp_path, monkeypatch):
    from clips_worker.anything_picker import pick_anything_clips

    video = tmp_path / "src.mp4"
    video.write_bytes(b"\x00")

    class Cand:
        def __init__(self, cid: str, start: float, end: float, score: float):
            self.id = cid
            self.start_s = start
            self.end_s = end
            self.score = score

    monkeypatch.setattr(
        "clips_worker.anything_picker.probe_duration_s",
        lambda _p: 120.0,
    )
    monkeypatch.setattr(
        "clips_worker.anything_picker.build_candidate_windows",
        lambda *a, **k: [Cand("c1", 0.0, 30.0, 0.8)],
    )
    monkeypatch.setattr(
        "clips_worker.anything_picker.sample_candidate_frames",
        lambda *a, **k: [tmp_path / "f1.jpg"],
    )
    monkeypatch.setattr(
        "clips_worker.anything_picker.scene_events",
        lambda *a, **k: [],
    )

    captured: dict = {}

    def fake_rank(conn, **kwargs):
        captured.update(kwargs)
        return [
            {
                "candidateId": "c1",
                "start": 0.0,
                "end": 30.0,
                "title": "Test",
                "hook": "hook",
                "reason": "vision",
                "score": 85,
            }
        ]

    monkeypatch.setattr("clips_worker.anything_picker.rank_clipanything_candidates_resilient", fake_rank)

    picks, err = pick_anything_clips(
        MagicMock(),
        video,
        [{"w": "hello", "s": 0.0, "e": 1.0}],
        {"mode": "anything", "maxClips": 3},
        0,
        120_000,
        "ws",
        "proj",
        tmp_path / "work",
    )
    assert err is None
    assert len(picks) == 1
    assert captured.get("candidates")
    assert captured["candidates"][0].get("frames")


def test_anything_picker_module_wires_vision_resilient():
    src = (Path(__file__).resolve().parents[1] / "clips_worker" / "anything_picker.py").read_text(
        encoding="utf-8",
    )
    assert "rank_clipanything_candidates_resilient" in src
    assert "sample_candidate_frames" in src
    assert "[clipper:anything]" in src
