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


def test_first_pass_uses_one_second_low_frames_original_audio_asr(finder, monkeypatch):
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
    assert recorded[0]["fps_override"] == pytest.approx(1.0)
    assert recorded[0]["media_resolution_override"] == "MEDIA_RESOLUTION_LOW"
    assert recorded[0]["force_audio"] is True
    assert "Deepgram" in recorded[0]["transcript_text"]
    assert result["moments"][0]["evidence_tier"] == "coarse_1fps"
    assert result["meta"]["original_audio_attached"] is True
    assert result["meta"]["fps"] == pytest.approx(1.0)
    assert result["meta"]["media_resolution"] == "MEDIA_RESOLUTION_LOW"


@pytest.mark.parametrize("story_mode", [
    "single_source_story_v1", "multi_source_story_v1", "clean_take_v1",
])
def test_each_story_mode_uses_same_low_resolution_one_fps_first_pass(finder, monkeypatch, story_mode):
    captured = []
    def watch(_local, **kwargs):
        captured.append(kwargs)
        return ([{"start_s": 1, "end_s": 9, "what_happened": "presenter"}],
                [], {"est_usd": 0.01})
    monkeypatch.setattr(finder, "watch_upload_range", watch)
    result = finder.run_analyze_payload(
        MagicMock(), job={"id": "fps-" + story_mode}, progress=lambda *_: None,
        payload={
            "mode": "best_moments", "storyMode": story_mode, "sources": [_source()],
            "visualEvidence": {"enabled": True, "model": "gemini-3.1-flash-lite",
                               "transcriptText": "on-topic dialogue"},
        },
    )
    assert len(captured) == 1
    assert captured[0]["fps_override"] == 1.0
    assert captured[0]["media_resolution_override"] == "MEDIA_RESOLUTION_LOW"
    assert captured[0]["force_audio"] is True
    assert result["moments"][0]["evidence_tier"] == "coarse_1fps"


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



def test_focus_offsets_to_original_recording_time_not_trim_relative(finder, monkeypatch):
    """A late-game 1fps observed Bowser reaction must still exist at 850s."""
    src = {**_source(), "rangeMs": [178894, 1378894],
           "durationMs": 1378894}
    monkeypatch.setattr(finder, "watch_upload_range", lambda _local, **kwargs: (
        [{"start_s": 0.5, "end_s": 3.5, "peak_s": 2.0,
          "hook_s": 0.5, "what_happened": "Bowser visual"}],
        [], {"est_usd": 0.003}))
    result = finder.run_analyze_payload(
        MagicMock(), job={"id":"offset-focus"}, progress=lambda *_: None,
        payload={"mode":"visual_detail", "sources":[src],
            "visualEvidence":{"enabled":True,"focusWindows":[
                {"startMs":847100,"endMs":861100,"transcriptText":"gameplay"}
            ]}},
    )
    row = result["moments"][0]
    assert row["start_s"] == pytest.approx(847.6)
    assert row["end_s"] == pytest.approx(850.6)
    assert row["source_time_origin_ms"] == 847100
    from clips_worker.ai_producer_agent.finder.run import source_absolute_visual_moments
    assert source_absolute_visual_moments([{"start_s":0,"end_s":2}], 0) == [
        {"start_s":0.0,"end_s":2.0,"source_time_origin_ms":0}
    ]


def test_coarse_trimmed_proxy_uses_original_recording_timestamps_only_in_visual_mode(finder, monkeypatch):
    src = {**_source(),"rangeMs":[178894,1378894],
           "durationMs":1378894}
    monkeypatch.setattr(finder, "watch_upload_range", lambda _local, **kwargs: (
        [{"start_s":8,"end_s":12,"peak_s":10,
          "what_happened":"real observed speedrun"}],[],
        {"est_usd":0.004}))
    for enabled in (True,False):
        payload={"mode":"best_moments","sources":[src]}
        if enabled:
            payload["visualEvidence"]={"enabled":True,"transcriptText":"[0s] words"}
        result=finder.run_analyze_payload(
            MagicMock(),job={"id":"offset-coarse-"+str(enabled)},
            progress=lambda *_: None,payload=payload)
        assert result["moments"][0]["start_s"] == pytest.approx(
            186.894 if enabled else 8)
        assert result["meta"]["times_are_source_absolute"] is enabled


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


def test_one_failed_focused_window_does_not_erase_later_observations(finder, monkeypatch):
    observed = []

    def watch(_local, **kwargs):
        observed.append(kwargs)
        if len(observed) == 1:
            raise ValueError("no_valid_moments_after_normalize")
        return ([{"start_s": kwargs["range_start_ms"] / 1000,
                  "end_s": kwargs["range_start_ms"] / 1000 + 2,
                  "what_happened": "short visual reaction"}], [],
                {"est_usd": 0.003, "normalize_rejects": {}})

    monkeypatch.setattr(finder, "watch_upload_range", watch)
    result = finder.run_analyze_payload(
        MagicMock(), job={"id": "focus-partial"}, progress=lambda *_: None,
        payload={
            "mode": "visual_detail", "sources": [_source()],
            "visualEvidence": {
                "enabled": True,
                "focusWindows": [
                    {"startMs": 12000, "endMs": 24000, "transcriptText": "first"},
                    {"startMs": 50000, "endMs": 61000, "transcriptText": "second"},
                    {"startMs": 92000, "endMs": 104000, "transcriptText": "third"},
                ],
            },
        },
    )
    assert len(observed) == 3
    assert all(item["min_moment_s"] == 1.0 for item in observed)
    assert len(result["moments"]) == 2
    assert result["meta"]["focus_windows_failed"] == 1
    assert result["meta"]["focus_windows_analyzed"] == 2
    assert [r["status"] for r in result["meta"]["focus_window_results"]] == [
        "failed", "ok", "ok",
    ]
    assert result["meta"]["focus_window_results"][0]["reason"] == "no_valid_moments_after_normalize"


def test_focused_normalization_accepts_real_two_second_observation():
    from clips_worker.ai_producer_agent.finder.watch import validate_and_normalize_moments
    raw = [{
        "start_s": 0.5, "end_s": 2.5, "peak_s": 1.5, "hook_s": 0.5,
        "what_happened": "silent reaction", "category": "reaction",
        "why_it_works": "visual physical comedy", "score": 0.9,
    }]
    focused, focused_rejects = validate_and_normalize_moments(
        raw, 12, min_moment_s=1.0,
    )
    regular, regular_rejects = validate_and_normalize_moments(raw, 12)
    assert len(focused) == 1
    assert focused_rejects.get("span_too_short", 0) == 0
    assert len(regular) == 0
    assert regular_rejects["span_too_short"] == 1
