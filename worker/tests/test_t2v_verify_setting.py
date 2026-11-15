"""T2V implied-setting check: a clip whose visible setting contradicts the moment's implied setting (from the
video's topic and the lines around it) is capped below the 5/10 filler floor even when the literal subject
matches. Gemini, downloads and ffmpeg are mocked; no network, no paid calls."""
from __future__ import annotations

import json

from clips_worker.t2v import verify_stock as vs
from test_t2v_blind_describe import _Conn, answer, blind_job, cand, ev  # noqa: F401  (fixture re-export)

SLEEP_SETTING = "time of day: night; place: indoor (bedroom); mood: calm, quiet, dim"

WOODS_WALK = {"events": [
    ev(0, 4, "a person in a jacket walking on a forest trail between tall trees", "walking forward", "bright daylight, sunny"),
    ev(4, 9, "the person keeps walking deeper into the woods", "walking", "bright daylight"),
], "setting": "outdoor forest trail, daytime", "style": "live-action camera footage", "notes": ""}

READING_LAMP = {"events": [
    ev(0, 5, "a woman sitting in an armchair reading a book next to a small lamp", "turns a page", "dim warm lamp light"),
    ev(5, 9, "close-up of the open book and her hands", "reading", "dim warm light"),
], "setting": "indoor living room at night", "style": "live-action camera footage", "notes": ""}


def sleep_shot(cands, setting=SLEEP_SETTING):
    return {"sceneId": "sc_14", "narration": "If you can't sleep, get out of bed and do a quiet activity.",
            "lineShows": "a person doing a calm activity like reading in dim light at night", "needS": 3.5, "lineNo": 14,
            "intent": "quiet activity", "prevNarration": "Lying awake makes it worse.",
            "nextNarration": "Go back to bed when you feel sleepy.", "candidates": cands,
            **({"setting": setting} if setting else {})}


def test_script_block_carries_the_implied_setting_and_topic():
    b = vs.script_block("1. a\n2. b", sleep_shot([]), "A calm guide to sleeping better.", "5 habits for better sleep")
    assert f'Implied setting of this moment (from the video and the lines around it): "{SLEEP_SETTING}"' in b
    assert b.startswith("What this video is about: 5 habits for better sleep. A calm guide")
    assert "Implied setting" not in vs.script_block("", sleep_shot([], setting=None))


def test_prompts_ask_for_setting_fit_before_the_score():
    for p in (vs.PROMPT, vs.SCORE_PROMPT):
        assert p.index("setting_fit:") < p.index("score: 0-10")
        assert "even when the literal subject or action matches line_shows" in p
        assert "setting_fit contradicts" in p
    for schema in (vs.VERIFY_SCHEMA, vs.VERIFY_SCHEMA_FIXED, vs.SCORE_SCHEMA):
        assert "setting_fit" in schema["required"] and "setting_fit" in schema["propertyOrdering"]
        assert schema["properties"]["setting_fit"]["enum"] == ["fits", "neutral", "contradicts"]


def test_observation_records_the_clip_setting_blind():
    assert "setting" in vs.OBSERVE_SCHEMA["required"]
    assert vs.DESCRIBE_VERSION == "events-v2"  # v1 cached descriptions have no setting: re-described once
    for word in ("line", "script", "narration", "search", "query"):
        assert word not in (vs.DESCRIBE_EXTRA + vs.DESCRIBE_PHOTO_PROMPT).lower()
    obs = vs.norm_observation(WOODS_WALK, 9)
    assert "setting: outdoor forest trail, daytime" in vs.observation_text(obs)


def test_norm_setting_fit():
    assert vs.norm_setting_fit("Contradicts.") == "contradicts"
    assert vs.norm_setting_fit("fits") == "fits"
    assert vs.norm_setting_fit("") == "neutral" and vs.norm_setting_fit("maybe") == "neutral"


def test_daytime_woods_walk_is_rejected_for_a_night_indoor_quiet_activity(blind_job):
    """Sleep video: "get out of bed and do a quiet activity" literally matches a walk (an activity), but a daytime
    woods walk contradicts the night/indoor/calm setting: capped at 4, never placed; the lamp-lit reader wins."""
    def judge(pid, prompt):
        assert SLEEP_SETTING in prompt and "Lying awake makes it worse." in prompt
        if pid == "111":
            assert "setting: outdoor forest trail, daytime" in prompt
            return {**answer(0, 9, depicts="yes", score=8), "setting_fit": "contradicts",
                    "setting_reason": "outdoor daytime woods, the moment is indoors at night"}
        return {**answer(0, 9, depicts="yes", score=7), "setting_fit": "fits", "setting_reason": "indoor, lamp light"}

    obs = {"111": WOODS_WALK, "222": READING_LAMP}
    # The fake scorer finds the clip by a <<pid>> tag in the observation text.
    obs = {k: {**v, "notes": f"<<{k}>>"} for k, v in obs.items()}
    out, calls, _ = blind_job([sleep_shot([cand("111", 9), cand("222", 9)])], obs, judge)
    by = {e["providerId"]: e for e in out["results"][0]["evaluated"]}
    woods = by["111"]
    assert woods["settingFit"] == "contradicts" and woods["score"] == vs.SETTING_CAP and woods["rawScore"] == 8
    assert woods["matches"] is False and woods["clipSetting"] == "outdoor forest trail, daytime"
    assert by["222"]["settingFit"] == "fits" and by["222"]["score"] == 7
    assert out["results"][0]["chosen"]["providerId"] == "222"


def test_contradicting_clip_is_not_even_a_fallback(blind_job):
    def judge(pid, prompt):
        return {**answer(0, 9, depicts="yes", score=9), "setting_fit": "contradicts", "setting_reason": "daylight"}

    obs = {"111": {**WOODS_WALK, "notes": "<<111>>"}}
    out, _, _ = blind_job([sleep_shot([cand("111", 9)])], obs, judge)
    # Capped at 4 (below the web's 5/10 floor) and excluded from the worker's best-available tier too.
    assert out["results"][0]["chosen"] is None
    e = out["results"][0]["evaluated"][0]
    assert e["score"] == 4 and e["settingFit"] == "contradicts"


def test_no_implied_setting_means_no_setting_cap(blind_job):
    def judge(pid, prompt):
        assert "Implied setting" not in prompt
        return {**answer(0, 9, depicts="yes", score=8), "setting_fit": "contradicts", "setting_reason": "?"}

    obs = {"111": {**WOODS_WALK, "notes": "<<111>>"}}
    out, _, _ = blind_job([sleep_shot([cand("111", 9)], setting=None)], obs, judge)
    e = out["results"][0]["evaluated"][0]
    assert e["settingFit"] == "neutral" and e["score"] == 8
