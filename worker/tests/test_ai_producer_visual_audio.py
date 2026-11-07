"""AI Producer visual-aware Story is isolated from the baseline video picker."""
from pathlib import Path
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def finder(tmp_path, monkeypatch):
    from clips_worker.ai_producer_agent.finder import run
    monkeypatch.setattr(run, "_scratch_for_job", lambda _: tmp_path)
    monkeypatch.setattr(run, "download_object", lambda _key, dest: Path(dest).write_bytes(b"video"))
    monkeypatch.setattr(run, "validate_and_normalize_moments", lambda rows, duration_s: (rows, {}))
    return run


def _source():
    return {
        "sourceId": "recording", "storageKey": "uploads/recording.mp4",
        "rangeMs": [0, 120000], "durationMs": 120000,
    }


def test_coarse_visual_story_uses_three_second_low_frames_original_audio_asr(finder, monkeypatch):
    recorded = []

    def watch(_local, **kwargs):
        recorded.append(kwargs)
        return ([{"start_s": 10, "end_s": 14, "what_happened": "opens box"}],
                [], {"est_usd": 0.12})

    monkeypatch.setattr(finder, "watch_upload_range", watch)
    result = finder.run_analyze_payload(
        MagicMock(), job={"id": "testcoarse"}, progress=lambda *_: None,
        payload={
            "mode": "best_moments", "runId": "run", "sources": [_source()],
            "visualEvidence": {
                "enabled": True, "model": "gemini-3.1-flash-lite",
                "transcriptText": "[10.0s] Deepgram word transcript",
            },
        },
    )
    assert len(recorded) == 1
    assert recorded[0]["fps_override"] == pytest.approx(1 / 3)
    assert recorded[0]["media_resolution_override"] == "MEDIA_RESOLUTION_LOW"
    assert recorded[0]["force_audio"] is True
    assert "Deepgram" in recorded[0]["transcript_text"]
    assert result["moments"][0]["evidence_tier"] == "coarse_3s"
    assert result["meta"]["original_audio_attached"] is True


def test_focused_visual_story_rechecks_limited_windows_at_one_fps(finder, monkeypatch):
    recorded = []

    def watch(_local, **kwargs):
        recorded.append(kwargs)
        return ([{"start_s": kwargs["range_start_ms"] / 1000,
                  "end_s": kwargs["range_end_ms"] / 1000,
                  "what_happened": "physical reaction"}], [], {"est_usd": 0.04})

    monkeypatch.setattr(finder, "watch_upload_range", watch)
    result = finder.run_analyze_payload(
        MagicMock(), job={"id": "testfocus"}, progress=lambda *_: None,
        payload={
            "mode": "visual_detail", "sources": [_source()],
            "visualEvidence": {
                "enabled": True,
                "focusWindows": [
                    {"startMs": 12000, "endMs": 24000, "transcriptText": "[0s] struggle with tape"},
                    {"startMs": 50000, "endMs": 61000, "transcriptText": "[0s] sticker joke"},
                    {"startMs": 90000, "endMs": 91000, "transcriptText": "[0s] too short"},
                    {"startMs": 92000, "endMs": 102000, "transcriptText": "[0s] fourth"},
                ],
            },
        },
    )
    assert len(recorded) == 2
    assert all(c["fps_override"] == 1.0 and c["force_audio"] for c in recorded)
    assert result["meta"]["focus_windows_analyzed"] == 2
    assert result["moments"][0]["evidence_tier"] == "focused_1fps"
    assert result["moments"][0]["inspection_window_ms"] == [12000, 24000]


def test_legacy_baseline_does_not_force_visual_audio_defaults(finder, monkeypatch):
    recorded = []
    def watch(_local, **kwargs):
        recorded.append(kwargs)
        return ([], [], {"est_usd": 0})
    monkeypatch.setattr(finder, "watch_upload_range", watch)
    result = finder.run_analyze_payload(
        MagicMock(), job={"id": "base"}, progress=lambda *_: None,
        payload={"mode": "best_moments", "sources": [_source()]},
    )
    assert recorded[0]["force_audio"] is False
    assert recorded[0]["fps_override"] is None
    assert recorded[0]["transcript_text"] is None
    assert result["meta"]["visual_audio_enabled"] is False
