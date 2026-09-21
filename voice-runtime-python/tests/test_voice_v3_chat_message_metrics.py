from __future__ import annotations

from transovo_voice.voice_v3.forensics import _metrics_to_dict


class _Metrics:
    started_speaking_at = 1.0
    stopped_speaking_at = 2.5
    e2e_latency = 0.95
    playback_latency = 0.1
    llm_node_ttft = None
    tts_node_ttfb = None


class _UserMetrics:
    started_speaking_at = 10.0
    stopped_speaking_at = 12.0
    transcription_delay = 0.2
    end_of_turn_delay = 0.05


def test_metrics_to_dict_assistant_realtime_fields() -> None:
    d = _metrics_to_dict(_Metrics())
    assert d["e2e_latency"] == 0.95
    assert d["started_speaking_at"] == 1.0
    assert "llm_node_ttft" not in d
    assert "tts_node_ttfb" not in d


def test_metrics_to_dict_user_fields() -> None:
    d = _metrics_to_dict(_UserMetrics())
    assert d["transcription_delay"] == 0.2
    assert d["end_of_turn_delay"] == 0.05
