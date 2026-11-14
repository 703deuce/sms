"""T2V_VERIFY_STOCK with a scene world: prompt construction, Gemini response parsing and selection.

Gemini, downloads and ffmpeg are mocked; no network, no paid calls. Each case checks that the world
description, the line's implied situation and the neighbouring lines reach the verify prompt, and that
an off-world clip (low context_fit) is never picked, even when it scores higher on line relevance.
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


def resp(score: int, fit: int, *, reason: str = "", lighting: int = 8, tod: str = "indoor", visible: str = "", subject_visible: bool = True) -> dict:
    return {
        "visible": visible or "a clip", "main_subject": "x", "action": "y", "matches": score >= 7,
        "score": score, "in_s": 0, "out_s": 8, "issues": "", "style": "live_action", "lighting": lighting,
        "framing": "medium", "time_of_day": tod, "subject_visible": subject_visible,
        "context_fit": fit, "context_reason": reason,
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

    def _run(world: str | None, shots: list[dict], answers: dict[str, dict]):
        prompts: dict[str, str] = {}

        def fake_watch(model, video: Path, prompt: str, mime="video/mp4"):
            pid = re.match(r"s\d+_(.+)_m\.(mp4|jpg)$", video.name).group(1)
            prompts[pid] = prompt
            return answers[pid], 100, 20

        monkeypatch.setattr(vs, "_download", lambda url, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_mute_and_shrink", lambda src, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_shrink_photo", lambda src, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_color_stats", lambda *a: (0.4, 0.5))
        monkeypatch.setattr(vs, "_dhash_frames", lambda *a: [])
        monkeypatch.setattr(vs, "_model", lambda: "gemini-test")
        monkeypatch.setattr(vs, "_gemini_watch", fake_watch)
        monkeypatch.setattr(gemini_mod, "_log_usage", lambda *a, **k: None)
        monkeypatch.setattr(cb_mod, "post_internal", lambda *a, **k: None)
        payload = {"draftId": "d1", "workspaceId": "w1", "projectId": "p1", "topic": "t", "realistic": True, "shots": shots}
        if world:
            payload["world"] = world
        conn = _Conn()
        vs.run_t2v_verify_stock_job(conn, {"id": "job_1", "payload": payload})
        results = conn.sink["payload"]["results"]
        return results, prompts

    return _run


def cand(pid: str) -> dict:
    return {"providerId": pid, "previewUrl": "https://cdn.pixabay.com/video/x.mp4", "durationS": 10, "query": "q"}


def shot(narration: str, situation: str, prev: str, nxt: str, ids: list[str], subject: str = "subject", idx: int = 3) -> dict:
    return {
        "sceneId": f"sc_{idx}", "sceneIndex": idx, "narration": narration, "intent": narration, "subject": subject,
        "needS": 3, "situation": situation, "prevNarration": prev, "nextNarration": nxt,
        "candidates": [cand(i) for i in ids],
    }


CASES = [
    pytest.param(
        "Video world: a calm sleep-help video for an adult lying awake at night at home\nSetting: home, bedroom\n"
        "Time of day: night\nImplausible shots (off-world): sunny outdoor activity; busy streets; sport",
        shot("If you can't sleep, get up and do something quiet.", "night at home, the viewer leaves bed for a calm, dim indoor activity",
             "Lie still and notice your breathing.", "Reading under a soft lamp can help.", ["walk", "lamp"]),
        {"walk": resp(8, 1, reason="daytime outdoor walk contradicts night at home", tod="day", visible="a woman walks a sunny park path"),
         "lamp": resp(7, 9, tod="night", lighting=6, visible="a person reads by a bedside lamp at night")},
        "lamp", "walk", id="sleep",
    ),
    pytest.param(
        "Video world: cosy winter holiday traditions at home in December, snow outside\nSeason: winter\n"
        "Implausible shots (off-world): summer beach; swimming; sunny barbecue",
        shot("Gather the family to decorate the tree together.", "a December evening at home, family around a Christmas tree",
             "The first snow means the season has started.", "Hang the lights before dinner.", ["beach", "tree"]),
        {"beach": resp(8, 1, reason="summer beach contradicts a winter holiday", tod="day", visible="a family laughing on a sunny beach"),
         "tree": resp(8, 9, visible="a family hangs ornaments on a Christmas tree in a living room")},
        "tree", "beach", id="winter_holiday_vs_summer_beach",
    ),
    pytest.param(
        "Video world: office productivity tips for a busy professional during the workday\nSetting: office, desk\n"
        "Implausible shots (off-world): parties; nightlife; holidays",
        shot("Block time for deep work and silence notifications.", "a weekday at the desk, the viewer focuses alone on one task",
             "Start with your hardest task.", "Short breaks keep your focus sharp.", ["party", "desk"]),
        {"party": resp(7, 1, reason="a party contradicts focused office work", visible="people celebrate with drinks at a party"),
         "desk": resp(7, 8, tod="day", visible="a person types on a laptop at a tidy office desk")},
        "desk", "party", id="office_vs_party",
    ),
    pytest.param(
        "Video world: fun, safe science experiments for kids at home with a parent\nViewer: children aged 6-10\n"
        "Implausible shots (off-world): bars; cocktails; adult nightlife",
        shot("Mix baking soda and vinegar to make a fizzy volcano.", "a bright kitchen table, a child does the experiment with a parent",
             "Put on your safety goggles.", "Watch the foam bubble over.", ["club", "volcano"]),
        {"club": resp(7, 0, reason="adult nightlife does not belong in a kids video", tod="night", visible="cocktails fizz on a nightclub bar"),
         "volcano": resp(8, 9, tod="day", visible="a child pours vinegar into a paper volcano that foams")},
        "volcano", "club", id="kids_vs_nightlife",
    ),
]


@pytest.mark.parametrize("world,line,answers,want,offworld", CASES)
def test_world_fit_picks_on_world_clip(run_job, caplog, world, line, answers, want, offworld):
    caplog.set_level(logging.INFO, logger=vs.log.name)
    results, prompts = run_job(world, [line], answers)
    chosen = results[0]["chosen"]
    assert chosen and chosen["providerId"] == want
    assert chosen["contextFit"] >= vs.CONTEXT_FIT_ACCEPT
    bad = next(e for e in results[0]["evaluated"] if e["providerId"] == offworld)
    assert bad["contextFit"] < vs.CONTEXT_FIT_MIN and bad["contextReason"]
    # World, the line's implied situation and both neighbouring lines are in every verify prompt.
    for p in prompts.values():
        assert "VIDEO WORLD (every shot" in p and world.splitlines()[0] in p
        assert line["situation"] in p
        assert f'Previous line: "{line["prevNarration"]}"' in p
        assert f'Next line: "{line["nextNarration"]}"' in p
        assert "context_fit: 0-10" in p
        assert "Setting, season and time of day are HARD context" in p
    # Per-scene log: jobId, scene, candidate, scores, verdict, reason.
    logs = [json.loads(r.getMessage().split(" ", 1)[1]) for r in caplog.records if r.getMessage().startswith("[t2v:verify:candidate]")]
    rej = next(x for x in logs if x["candidateId"] == offworld)
    assert rej["jobId"] == "job_1" and rej["sceneIndex"] == 3 and rej["verdict"] == "rejected" and rej["reason"].startswith("context:")
    scene = next(json.loads(r.getMessage().split(" ", 1)[1]) for r in caplog.records if r.getMessage().startswith("[t2v:verify:scene]"))
    assert scene["candidateId"] == want and want in [k["candidateId"] for k in scene["topK"]]


# Snowstorm regression (QA draft t2v_2a61c079..., 2026-11-14): real lines and reviewer descriptions from
# dump_raw.json, Gemini answers mocked. Sunny summer BBQ under the grill warning, pylons at sunset under
# the generator line and a lab scientist under the medicines line were all placed; none may be now.
SNOW_WORLD = (
    "Video world: preparing a home for a winter snowstorm before the first flakes arrive\nSetting: a house and its "
    "yard\nSeason: winter, snow\nImplausible shots (off-world): summer barbecue; sunny beach; laboratories; city nightlife"
)


def test_snowstorm_regression_no_off_world_or_dim_fill(run_job):
    lines = [
        shot("Keep generators outdoors, far from windows,", "outside the house before the storm, a portable generator away from windows",
             "and replace weak batteries.", "and never bring an outdoor grill inside for heat.", ["pylons"], "generator away from house windows", 15),
        shot("and never bring an outdoor grill inside for heat.", "winter at home: a grill stays outside in the snowy yard",
             "Keep generators outdoors, far from windows,", "Clear gutters and drains, secure loose outdoor items,", ["bbq", "snowgrill"], "grill outside house", 16),
        shot("where everyone can find them if travel becomes difficult.", "inside the home, supplies stored where the family can reach them",
             "Keep needed medicines close,", "Feel for drafts around windows and doors,", ["lab"], "family finding stored medicine", 5),
    ]
    answers = {
        "pylons": resp(1, 3, lighting=3, tod="dusk_dawn", reason="power lines at sunset, no generator or home",
                       visible="A silhouette of electrical pylons and power lines against a sunset sky."),
        "bbq": resp(9, 2, lighting=10, tod="day", reason="sunny summer barbecue contradicts a winter storm",
                    visible="A man is outside grilling various meats on a black kettle-style charcoal grill."),
        "snowgrill": resp(6, 8, tod="day", visible="A covered kettle grill stands on a snowy patio behind a house."),
        "lab": resp(1, 2, lighting=9, reason="a laboratory is not the home", visible="A female scientist in a lab coat and safety goggles holds a flask."),
    }
    results, prompts = run_job(SNOW_WORLD, lines, answers)
    by = {r["sceneId"]: r for r in results}
    assert by["sc_15"]["chosen"] is None  # dim, off-world pylons: never a filler
    assert by["sc_16"]["chosen"]["providerId"] == "snowgrill"  # not the sunny BBQ that scored 9
    assert by["sc_5"]["chosen"] is None  # lab scientist: off-world and 1/10
    assert "Season: winter, snow" in prompts["bbq"]
    assert 'Previous line: "Keep generators outdoors, far from windows,"' in prompts["bbq"]


def test_negated_line_gets_the_negation_flag_in_the_prompt(run_job):
    line = shot("and never bring an outdoor grill inside for heat.", "winter at home: a grill stays outside in the snowy yard",
                "Keep generators outdoors, far from windows,", "Clear gutters and drains,", ["grilling", "snowgrill"], "grill outside house", 16)
    line["negated"] = True
    answers = {
        "grilling": resp(2, 3, tod="day", reason="shows grilling, the action the line warns against", visible="A man grills meat on a kettle grill."),
        "snowgrill": resp(7, 9, tod="day", visible="A covered kettle grill on a snowy patio."),
    }
    results, prompts = run_job(SNOW_WORLD, [line], answers)
    assert all("NEGATED LINE" in p for p in prompts.values())
    assert results[0]["chosen"]["providerId"] == "snowgrill"
    _, plain = run_job(SNOW_WORLD, [{**line, "negated": False}], answers)
    assert not any("NEGATED LINE" in p for p in plain.values())


def test_subject_rule_scores_the_key_thing_not_the_hands(run_job):
    """Calibration fix: 'hand testing ceiling alarm' scored a clear smoke alarm 1/10 (hands were missing)."""
    line = shot("Test smoke and carbon monoxide alarms,", "inside the home before the storm",
                "let a small amount of water flow and follow local guidance.", "and replace weak batteries.",
                ["alarm"], "hand testing ceiling alarm", 13)
    results, prompts = run_job(SNOW_WORLD, [line], {"alarm": resp(8, 8, visible="A close-up shot of a white circular smoke alarm.")})
    assert "KEY THING" in prompts["alarm"]
    assert "power pylons are not a generator" in prompts["alarm"]
    assert "a clear smoke alarm on its own IS the subject" in prompts["alarm"]
    assert results[0]["chosen"]["providerId"] == "alarm"


def test_no_world_keeps_the_old_prompt_and_rules(run_job):
    line = shot("Drivers plug in and start the day.", "", "", "", ["a"], "charging plug")
    results, prompts = run_job(None, [line], {"a": resp(8, 1, tod="day")})
    assert "VIDEO WORLD (every shot" not in prompts["a"] and "context_fit: return 10" in prompts["a"]
    assert results[0]["chosen"]["providerId"] == "a"  # context_fit ignored without a world
    assert "contextFit" not in results[0]["chosen"]  # web keeps the old night rule for world-less runs


def test_quality_ok_world_gate_and_night_safety_net():
    base = {"style": "live_action", "lighting": 8, "timeOfDay": "night", "contextFit": 9}
    assert vs.quality_ok(base, vs.Ctx(has_world=True))  # night fits the world (sleep video)
    assert not vs.quality_ok(base, vs.Ctx())  # no world: old day/night rule
    assert not vs.quality_ok({**base, "timeOfDay": "day", "contextFit": 3}, vs.Ctx(has_world=True))  # off-world
    assert not vs.quality_ok({**base, "lighting": 4}, vs.Ctx(has_world=True))  # lighting >= 6 always
