"""T2V_VERIFY_STOCK: the checker judges each clip against the whole script, in its own words.

Gemini, downloads and ffmpeg are mocked; no network, no paid calls. Cases come from the sleep run 4 and
snowstorm (t2v_2a61c079) drafts: real lines and what the reviewer saw, with mocked model answers. They check
that the script, neighbours, moment and must-recognise reach the prompt, that no lighting / night / colour /
wrong-subject gate overrides the model's in-context score, and that the scarcest line picks first.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import pytest

import clips_worker.gemini as gemini_mod
import clips_worker.internal_callback as cb_mod
from clips_worker.t2v import verify_stock as vs


def resp(score: int, *, reason: str = "", lighting: int = 8, tod: str = "indoor", visible: str = "", subject_visible: bool = True) -> dict:
    return {
        "visible": visible or "a clip", "main_subject": "x", "action": "y", "matches": score >= 7,
        "score": score, "fit_reason": reason, "in_s": 0, "out_s": 8, "issues": "", "style": "live_action",
        "lighting": lighting, "framing": "medium", "time_of_day": tod, "subject_visible": subject_visible,
    }


class _Cur:
    def __init__(self, sink: dict):
        self.sink = sink

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        if "UPDATE clip_jobs" in sql:
            self.sink["payload"] = json.loads(params[0])


class _Conn:
    def __init__(self):
        self.sink: dict = {}

    def cursor(self):
        return _Cur(self.sink)

    def commit(self):
        pass

    def rollback(self):
        pass


@pytest.fixture
def run_job(monkeypatch):
    """Run the verify job on fake candidates; `answers` maps providerId -> mocked Gemini JSON."""

    def _run(shots: list[dict], answers: dict[str, dict], script: str = "", understanding: str = "", stats=(0.4, 0.5)):
        prompts: dict[str, str] = {}

        def fake_watch(model, video: Path, prompt: str, mime="video/mp4"):
            pid = re.match(r"s\d+_(.+)_m\.(mp4|jpg)$", video.name).group(1)
            prompts[pid] = prompt
            return answers[pid], 100, 20

        monkeypatch.setattr(vs, "_download", lambda url, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_mute_and_shrink", lambda src, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_shrink_photo", lambda src, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_color_stats", lambda *a: stats)
        monkeypatch.setattr(vs, "_dhash_frames", lambda *a: [])
        monkeypatch.setattr(vs, "_model", lambda: "gemini-test")
        monkeypatch.setattr(vs, "_gemini_watch", fake_watch)
        monkeypatch.setattr(gemini_mod, "_log_usage", lambda *a, **k: None)
        monkeypatch.setattr(cb_mod, "post_internal", lambda *a, **k: None)
        payload = {"draftId": "d1", "workspaceId": "w1", "projectId": "p1", "topic": "t", "realistic": True, "shots": shots,
                   "script": script, "videoUnderstanding": understanding}
        conn = _Conn()
        vs.run_t2v_verify_stock_job(conn, {"id": "job_1", "payload": payload})
        return conn.sink["payload"]["results"], prompts

    return _run


def cand(pid: str, kind: str = "video") -> dict:
    return {"provider": "pixabay", "providerId": pid, "previewUrl": f"https://cdn.pixabay.com/{pid}", "durationS": 10, "query": "q", "author": "a", "kind": kind}


SLEEP_SCRIPT = "\n".join([
    "1. Small changes to familiar routines can prepare body and mind for rest.",
    "2. Choose bedtime and wake times you can keep, even on weekends.",
    "3. Make the bedroom dark, quiet, and comfortably cool.",
    "4. Draw curtains, reduce noise,",
])
SLEEP_UNDERSTANDING = "A calm guide to sleeping better at home, for someone winding down in the evening."


def test_sleep_prompt_carries_script_neighbours_and_moment(run_job):
    shots = [{
        "sceneId": "sc_13", "narration": "Make the bedroom dark, quiet, and comfortably cool.", "intent": "dark bedroom",
        "subject": "dark quiet bedroom", "moment": "The viewer prepares their bedroom for the night.", "needS": 3,
        "lineNo": 3, "prevNarration": "Choose bedtime and wake times you can keep, even on weekends.",
        "nextNarration": "Draw curtains, reduce noise,", "candidates": [cand("img_2619266", "photo")],
    }]
    _, prompts = run_job(shots, {"img_2619266": resp(9, lighting=3, tod="night", visible="A dark bedroom with a bed")}, SLEEP_SCRIPT, SLEEP_UNDERSTANDING)
    p = prompts["img_2619266"]
    assert SLEEP_UNDERSTANDING in p
    assert "Whole script (this shot is line 3):" in p and "4. Draw curtains, reduce noise," in p
    assert 'Previous line: "Choose bedtime' in p and 'Next line: "Draw curtains' in p
    assert 'What this moment means in the video: "The viewer prepares their bedroom for the night."' in p
    assert 'What the viewer must recognise: "dark quiet bedroom"' in p
    assert "fit_reason" in p and "nice-to-have" not in p and "SUBJECT RULE" not in p


def test_sleep_dim_bedroom_wins_over_bright_off_moment_clip(run_job):
    """Sleep sc_13: the dark-bedroom photos (s9, lighting 3) used to fail the lit gate. Now the score decides."""
    shots = [{"sceneId": "sc_13", "narration": "Make the bedroom dark, quiet, and comfortably cool.", "needS": 3,
              "candidates": [cand("151295"), cand("img_2619266", "photo")]}]
    answers = {
        "151295": resp(5, lighting=8, visible="A woman tossing and turning in bed in frustration", reason="shows restlessness, not the room"),
        "img_2619266": resp(9, lighting=3, tod="night", visible="A dark bedroom with a made bed", reason="exactly the dark, quiet room"),
    }
    results, _ = run_job(shots, answers, SLEEP_SCRIPT, SLEEP_UNDERSTANDING, stats=(0.03, 0.05))
    chosen = results[0]["chosen"]
    assert chosen["providerId"] == "img_2619266" and chosen["verdict"] == "accepted"
    assert chosen["fitReason"] == "exactly the dark, quiet room"


def test_snowstorm_smoke_alarm_is_not_capped(run_job):
    """Snow sc_13: a clear smoke-alarm photo was capped to 1 because no hand was testing it."""
    shots = [{"sceneId": "sc_13", "narration": "Test smoke and carbon monoxide alarms,", "subject": "smoke alarm", "needS": 3,
              "candidates": [cand("img_smoke", "photo")]}]
    answers = {"img_smoke": resp(8, subject_visible=False, visible="A white smoke alarm on a ceiling", reason="the alarm the line names")}
    results, _ = run_job(shots, answers, "1. Before the first flakes arrive, prepare.\n2. Test smoke and carbon monoxide alarms,")
    chosen = results[0]["chosen"]
    assert chosen["score"] == 8 and chosen["matches"] is True and chosen["verdict"] == "accepted"
    assert chosen["subjectVisible"] is False  # information only


def test_snowstorm_pylons_score_low_on_merit(run_job):
    """Snow sc_15: the model's own low score keeps the pylons out of the accepted/usable tiers."""
    shots = [{"sceneId": "sc_15", "narration": "Keep generators outdoors, far from windows,", "needS": 3, "candidates": [cand("2151")]}]
    results, _ = run_job(shots, {"2151": resp(1, lighting=3, visible="Electrical pylons against a sunset", reason="pylons are not a generator")})
    assert results[0]["chosen"] is None


def test_scarcest_shot_picks_first(run_job):
    """Story order let an earlier line take a later line's only good clip (sleep sc_2/sc_16, snow sc_1/sc_6)."""
    shots = [
        {"sceneId": "sc_1", "narration": "Get your home ready.", "needS": 3, "candidates": [cand("9373"), cand("8000")]},
        {"sceneId": "sc_6", "narration": "Feel for drafts around windows and doors,", "needS": 3, "candidates": [cand("9373"), cand("7000")]},
    ]
    answers = {
        "9373": resp(9, visible="Sealing a window frame"),
        "8000": resp(8, visible="A house being prepared"),
        "7000": resp(1, visible="A night silhouette at a window"),
    }
    results, _ = run_job(shots, answers)
    assert results[0]["sceneId"] == "sc_1" and results[1]["sceneId"] == "sc_6"
    assert results[1]["chosen"]["providerId"] == "9373"
    assert results[0]["chosen"]["providerId"] == "8000"


def test_scarcity_order_ties_keep_story_order():
    shots = [{"needS": 3}, {"needS": 3}, {"needS": 3}]
    ok = {"providerId": "x", "matches": True, "score": 8, "inS": 0, "outS": 5, "clipS": 10, "style": "live_action"}
    ev = [[ok, ok], [], [ok]]
    assert vs.scarcity_order(shots, ev) == [1, 2, 0]


def test_prompts_and_rules_have_no_topic_words_or_time_rules():
    import inspect
    import re as _re

    topic = _re.compile(r"\b(coffee|beans?|EVs?|electric vehicles?|dealerships?|charg(ing|er)|battery|snow\w*|winter|pylons?|smoke alarm|sleep\w*|bedroom|bedtime|racing)\b", _re.I)
    for name in ("PROMPT", "SCRIPT_BLOCK", "PHOTO_NOTE", "AI_NOTE"):
        assert not topic.search(getattr(vs, name)), name
    assert "nice-to-have" not in vs.PROMPT and "HARD" not in vs.PROMPT
    src = inspect.getsource(vs)
    for gone in ("NIGHT_WORDS", "MONO_WORDS", "MIN_LIGHTING", "MIN_LUMA", "MIN_SATURATION", "night_line", "night_ok", "mono_ok"):
        assert gone not in src, gone
