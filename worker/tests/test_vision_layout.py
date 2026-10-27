import json

import pytest

from clips_worker.layout_router import PersonCountSummary, route_multiperson_layout, summary_from_track_fixture
from clips_worker.vision_layout import (
    _PROJECT_SPEND,
    _PROJECT_STATS,
    apply_vision_layout_to_summary,
    layout_from_vision_advice,
    log_project_vision_stats,
    should_call_vision_layout,
    VisionLayoutAdvice,
)


def test_should_call_triggers_on_uncertainty_fixtures():
    fixtures = [
        ("solo_corner_webcam", PersonCountSummary(2, 0.52, 0.2), 1, True, False, True),
        ("interview_two_speakers", PersonCountSummary(2, 0.82, 0.55), 2, False, False, False),
        ("solo_high_conf", PersonCountSummary(1, 0.85, 0.5), 1, False, False, False),
        ("audio_mismatch", PersonCountSummary(1, 0.7, 0.5), 2, False, False, True),
    ]
    triggered = 0
    for _name, summary, audio_n, corner, screen, expect in fixtures:
        ok, _reason = should_call_vision_layout(
            summary,
            audio_speaker_count=audio_n,
            corner_webcam_hint=corner,
            screen_share_hint=screen,
        )
        assert ok is expect
        if ok:
            triggered += 1
    assert triggered == 2


def test_corner_webcam_vision_forces_single_person_screen_pip():
    summary = PersonCountSummary(2, 0.55, 0.25)
    advice = VisionLayoutAdvice(
        person_count=1,
        recommended_layout="screen_pip",
        confidence=0.88,
        has_corner_webcam_over_gameplay=True,
        is_screen_share=True,
        est_cost_usd=0.00032,
        trigger_reason="corner_webcam_hint",
    )
    adj = apply_vision_layout_to_summary(summary, advice)
    assert adj.n_persons == 1
    layout, v2 = layout_from_vision_advice(advice, "auto", summary)
    assert layout == "screen_pip" and v2


def test_two_person_low_coverage_routes_follow_not_split():
    s = summary_from_track_fixture(2, confidence=0.62, mean_embed_coverage=0.25)
    layout, v2 = route_multiperson_layout(s, "auto")
    assert layout == "speaker_follow" and not v2


def test_vision_gemini_parse_and_cost(monkeypatch, tmp_path):
    _PROJECT_SPEND.clear()
    monkeypatch.setenv("CLIPPER_VISION_LAYOUT_ENABLED", "1")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    payload = {
        "personCount": 1,
        "peoplePositions": ["corner_br", "gameplay"],
        "hasCornerWebcamOverGameplay": True,
        "isScreenShare": True,
        "recommendedLayout": "screen_pip",
        "confidence": 0.91,
    }

    class FakeRes:
        ok = True

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}}]}

    monkeypatch.setattr("clips_worker.vision_layout.requests.post", lambda *a, **k: FakeRes())
    monkeypatch.setattr(
        "clips_worker.vision_layout.sample_video_jpegs",
        lambda *a, **k: [b"jpeg1", b"jpeg2"],
    )

    from clips_worker.vision_layout import maybe_vision_layout_advice

    summary = PersonCountSummary(2, 0.5, 0.2)
    advice = maybe_vision_layout_advice(
        tmp_path / "x.mp4",
        summary,
        corner_webcam_hint=True,
        project_id="proj-fixture-1",
    )
    assert advice is not None
    assert advice.est_cost_usd == pytest.approx(0.00016, rel=1e-3)
    assert advice.recommended_layout == "screen_pip"


def test_log_project_vision_stats_emits_summary(capsys):
    _PROJECT_STATS.clear()
    _PROJECT_STATS["p1"] = {
        "trigger_checks": 4,
        "trigger_calls": 2,
        "trigger_success": 1,
        "est_usd": 0.00032,
    }
    log_project_vision_stats("p1")
    out = capsys.readouterr().out
    assert "[clipper:vision] project_summary" in out
    assert "trigger_rate=0.500" in out
    assert "est_usd_total=0.00032" in out
    assert "p1" not in _PROJECT_STATS
