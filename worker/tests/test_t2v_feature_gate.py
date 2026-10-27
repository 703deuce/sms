import os

from clips_worker.t2v.feature_gate import T2V_JOB_TYPES, ai_video_enabled


def test_t2v_job_types_complete():
    assert "T2V_ASSEMBLE" in T2V_JOB_TYPES


def test_ai_video_disabled_by_default(monkeypatch):
    monkeypatch.delenv("AI_VIDEO_ENABLED", raising=False)
    monkeypatch.delenv("FEATURE_T2V", raising=False)
    assert ai_video_enabled() is False


def test_ai_video_enabled(monkeypatch):
    monkeypatch.setenv("AI_VIDEO_ENABLED", "1")
    assert ai_video_enabled() is True
