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
    assert 'What this moment means in the video (context only): "The viewer prepares their bedroom for the night."' in p
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


def test_seen_is_described_first_and_stored_with_fit_reason(run_job):
    """Snow sc_3: a phone on a charger scored 8 as a 'metaphor' for flashlights and batteries. The checker now
    writes what is literally on screen (seen) first and scores from that; seen is stored beside fit_reason."""
    props = vs.VERIFY_SCHEMA["properties"]
    assert "seen" in props and "seen" in vs.VERIFY_SCHEMA["required"]
    order = vs.VERIFY_SCHEMA["propertyOrdering"]
    # line_shows -> seen -> depicts -> score -> fit_reason (the reason no longer comes before the score)
    assert order[:3] == ["line_shows", "seen", "depicts"] and order.index("depicts") < order.index("score") < order.index("fit_reason")
    assert sorted(order) == sorted(props)  # Gemini needs every property listed
    p = vs.PROMPT
    assert p.index("1. line_shows") < p.index("2. seen") < p.index("3. depicts") < p.index("4. score") < p.index("5. fit_reason")
    assert "based on seen and depicts, not on what the clip might stand for" in p and "metaphor" in p
    shots = [{"sceneId": "sc_3", "narration": "flashlights, and spare batteries.", "needS": 3, "candidates": [cand("8501")]}]
    ans = resp(3, visible="A phone placed on a wireless charging stand", reason="seen shows a phone charging, not flashlights or batteries")
    ans["seen"] = "A hand puts a smartphone on a wireless charging stand next to a plant."
    results, prompts = run_job(shots, {"8501": ans})
    ev = results[0]["evaluated"][0]
    assert ev["seen"] == "A hand puts a smartphone on a wireless charging stand next to a plant."
    assert ev["fitReason"].startswith("seen shows a phone")
    assert results[0]["chosen"] is None or results[0]["chosen"]["verdict"] == "best_available"
    assert "seen:" in prompts["8501"]


def test_seen_falls_back_to_visible_for_old_answers(run_job):
    shots = [{"sceneId": "sc_1", "narration": "A line.", "needS": 3, "candidates": [cand("1")]}]
    results, _ = run_job(shots, {"1": resp(8, visible="A kettle boiling", reason="fits")})
    ev = results[0]["evaluated"][0]
    assert ev["seen"] == "A kettle boiling" and ev["visible"] == "A kettle boiling"


def test_split_scene_fragment_is_judged_with_its_full_sentence_and_neighbours(run_job):
    """Sleep 'and adjust bedding…' was judged alone. The checker now reads the whole sentence and both
    neighbouring lines. (VQ's 'hands smoothing a duvet in a softly lit room' is a test expectation only.)"""
    sentence = "Draw curtains, reduce noise, and adjust bedding so the space feels restful."
    shots = [{
        "sceneId": "sc_15", "narration": "and adjust bedding so the space feels restful.", "sentence": sentence, "needS": 3, "lineNo": 16,
        "prevNarration": "Draw curtains, reduce noise,", "nextNarration": "Keep the bed ready for sleep, with fewer bright lights and interruptions nearby.",
        "candidates": [cand("duvet")],
    }]
    _, prompts = run_job(shots, {"duvet": resp(8, visible="Hands smooth a duvet in a softly lit room")}, SLEEP_SCRIPT, SLEEP_UNDERSTANDING)
    p = prompts["duvet"]
    assert f'This line is part of the sentence: "{sentence}"' in p
    assert 'Previous line: "Draw curtains, reduce noise,"' in p and 'Next line: "Keep the bed ready' in p
    # A whole-sentence line gets no extra sentence line.
    assert "part of the sentence" not in vs.script_block("", {"narration": "A line.", "sentence": "A line."})


def test_prompt_judges_as_a_viewer_and_treats_metaphor_as_a_miss():
    p = vs.PROMPT
    assert "a viewer watching THIS video\nwould immediately get this clip as THIS line" in p
    assert "a symbol, a mood, a\n     metaphor" in p and "0-4 = depicts no" in p
    # The whole script is context, never a reason a clip fits THIS line.
    assert "They never make a clip fit THIS line" in p
    # Setting is the viewer's reaction, not an optional rule handed to the model.
    assert "tells you whether the place" not in p


# --- #1192 live rerun fixtures (actual verifier answers from the snow t2v_2a61c079 and sleep t2v_cf976bf4 runs):
# the model's own seen/fit_reason/score, plus the depicts call the new schema asks for. Test data only; none of
# these words are in any prompt (see test_prompts_and_rules_have_no_topic_words_or_time_rules).
LIVE_MISSES = [
    # (sceneId, line, sentence, providerId, model score, seen, depicts)
    ("sc_5", "where everyone can find them if travel becomes difficult.", "Keep needed medicines close, where everyone can find them if travel becomes difficult.",
     "5457", 7, "A row of intravenous drip bags is hanging in a medical setting with clear liquid inside them.", "no"),
    ("sc_14", "and replace weak batteries.", "Test smoke and carbon monoxide alarms, and replace weak batteries.",
     "8501", 6, "A hand places a smartphone onto a wireless charging stand. The phone screen displays a battery charging icon.", "no"),
    ("sc_7", "and seal gaps before temperatures drop.", "Feel for drafts around windows and doors, and seal gaps before temperatures drop.",
     "7954", 9, "A hand uses a cloth to wipe down a dark, dusty glass or window pane, creating streaks.", "no"),
    ("sc_10", "may need insulation before freezing weather arrives.", "Exposed pipes in cold spaces may need insulation before freezing weather arrives.",
     "43629", 9, "A close-up of a grey industrial metal wheel valve attached to a large pipe outdoors.", "no"),
    ("sc_20", "and backup batteries, and plan to check on neighbors who may need help.", "",
     "47743", 9, "A close-up shot shows a person's hands holding and using a smartphone, scrolling on the screen.", "partly"),
    ("sc_2", "Start with the forecast, then gather drinking water, shelf-stable food,", "",
     "5629", 9, "A person uses a sponge to scrub the inside of a glass jar under a running kitchen faucet.", "partly"),
    ("sc_13", "Make the bedroom dark, quiet, and comfortably cool.", "",
     "111281", 8, "Hands turn the pages of an old book on a wooden table in a dimly lit room, beside a lit candle.", "no"),
]


@pytest.mark.parametrize("scene,line,sentence,pid,model_score,seen,depicts", LIVE_MISSES, ids=[f"{x[0]}-{x[3]}" for x in LIVE_MISSES])
def test_live_rerun_misses_are_capped_by_the_depiction_call(run_job, scene, line, sentence, pid, model_score, seen, depicts):
    """The model kept scoring these 6-9 on theme or category; its own depicts call now caps the score."""
    shot = {"sceneId": scene, "narration": line, "needS": 3, "candidates": [cand(pid)]}
    if sentence:
        shot["sentence"] = sentence
    ans = resp(model_score, visible=seen, reason="relates to the line")
    ans.update({"seen": seen, "line_shows": "what the line is about", "depicts": depicts, "matches": True})
    results, _ = run_job([shot], {pid: ans})
    ev = results[0]["evaluated"][0]
    assert ev["rawScore"] == model_score and ev["depicts"] == depicts
    assert ev["score"] == min(model_score, vs.DEPICTS_CAP[depicts]) and ev["score"] <= 6
    assert ev["matches"] is False
    chosen = results[0]["chosen"]
    assert chosen is None or chosen["verdict"] != "accepted"
    if depicts == "no":
        assert ev["score"] < vs.USABLE_SCORE  # a miss: the web never places it, reimagine fires


def test_depicts_yes_keeps_the_model_score_and_old_answers_are_uncapped(run_job):
    shots = [{"sceneId": "sc_1", "narration": "A line.", "needS": 3, "candidates": [cand("a"), cand("b")]}]
    yes = resp(9, visible="It plainly shows the line")
    yes.update({"depicts": "yes", "line_shows": "the line", "seen": "It plainly shows the line"})
    old = resp(8, visible="An old answer without depicts")
    results, _ = run_job(shots, {"a": yes, "b": old})
    by = {e["providerId"]: e for e in results[0]["evaluated"]}
    assert by["a"]["score"] == 9 and by["a"]["matches"] is True and by["a"]["lineShows"] == "the line"
    assert by["b"]["score"] == 8 and by["b"]["depicts"] is None
    assert results[0]["chosen"]["providerId"] == "a"


def test_capped_score_handles_bad_values():
    assert vs.capped_score({"score": "12", "depicts": "No"}) == (4, 10, "no")
    assert vs.capped_score({"score": None, "depicts": "maybe"}) == (0, 0, None)
    assert vs.capped_score({"score": 7.6, "depicts": "partly"}) == (6, 8, "partly")


# --- #1194 round 2: watched-review fixtures (VQ t2v-1192-clip-review.md, sleep t2v_cf976bf4) -----------------
HABIT_AND_WEAK = [
    # Lines that ask to stop a habit got a clip of the habit; a 5 'usable' pick that shows something else.
    ("sc_10", "and set bright screens aside before bed.", "61298", 9,
     "A bearded man in a dark room stares into a glowing smartphone.", "no"),
    ("sc_16", "Keep the bed ready for sleep, with fewer bright lights and interruptions nearby.", "34473", 10,
     "A person lies on a bed reading a thick book in bright daylight.", "partly"),
    ("sc_15", "and adjust bedding until the space feels restful.", "262181", 5,
     "A pair of hands is gently petting a dog that is lying down on a soft, patterned blanket.", "no"),
]


@pytest.mark.parametrize("scene,line,pid,model_score,seen,depicts", HABIT_AND_WEAK, ids=[f"{x[0]}-{x[2]}" for x in HABIT_AND_WEAK])
def test_habit_lines_and_the_exact_5_pick_are_capped(run_job, scene, line, pid, model_score, seen, depicts):
    ans = resp(model_score, visible=seen, reason="calm")
    ans.update({"seen": seen, "depicts": depicts, "line_shows": "the advised action", "matches": True})
    results, _ = run_job([{"sceneId": scene, "narration": line, "needS": 3, "candidates": [cand(pid)]}], {pid: ans})
    ev = results[0]["evaluated"][0]
    assert ev["score"] <= vs.DEPICTS_CAP[depicts] and ev["matches"] is False
    if scene == "sc_15":
        assert ev["score"] == 4 and ev["score"] < vs.USABLE_SCORE  # the exact-5 pick falls below the floor


def test_line_shows_is_what_a_viewer_should_see_for_the_meaning():
    p = " ".join(vs.PROMPT.split())
    assert "what a viewer should SEE on screen for what THIS line means" in p
    assert "the advised action or its result, not the thing to stop" in p
    assert "the habit or act the line advises against" in p


def test_reimagine_candidates_carry_their_intended_shot(run_job):
    """sleep sh18: the 'slippers beside the bed' idea placed flip-flops on a marble floor."""
    shot = {"sceneId": "sc_18~i2", "narration": "step out of bed for a little while.", "needS": 3,
            "idea": "Show slippers set beside the bed as a person rises in the dim room", "candidates": [cand("42806")]}
    ans = resp(9, visible="Feet in flip-flops walk across a marble floor.")
    ans.update({"depicts": "partly", "line_shows": "a person getting out of bed"})
    results, prompts = run_job([shot], {"42806": ans})
    assert 'Intended shot (this clip was found for it): "Show slippers set beside the bed' in prompts["42806"]
    assert results[0]["evaluated"][0]["score"] == 6
    assert '"yes" also needs the clip to show that intended shot' in vs.PROMPT
    assert "Intended shot" not in vs.script_block("", {"narration": "A line."})


def test_depicts_ranks_before_score_in_the_worker_pick(run_job):
    """sleep sh13: a literal 8 (depicts yes) beats a stretched 10 the model still called 'partly'... and a
    not-judged older answer sits between."""
    shots = [{"sceneId": "sc_13", "narration": "Make the bedroom dark, quiet, and comfortably cool.", "needS": 3,
              "candidates": [cand("old"), cand("fan")]}]
    old = resp(9, visible="Book pages by a candle")  # no depicts (older answer)
    fan = resp(8, visible="A fan turning in a dim bedroom")
    fan.update({"depicts": "yes"})
    results, _ = run_job(shots, {"old": old, "fan": fan})
    assert results[0]["chosen"]["providerId"] == "fan"


def test_motion_check_flags_a_frozen_frame(tmp_path):
    import shutil
    import subprocess as sp

    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    still = tmp_path / "still.mp4"
    moving = tmp_path / "moving.mp4"
    sp.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=4", "-vf", "trim=end_frame=1,loop=40:1:0",
            "-t", "4", "-pix_fmt", "yuv420p", str(still)], check=True)
    sp.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=4", "-t", "4", "-pix_fmt", "yuv420p", str(moving)], check=True)
    assert vs._motion(still, 0.0, 3.5) < vs.STATIC_DIFF
    assert vs._motion(moving, 0.0, 3.5) > vs.STATIC_DIFF


def test_static_clip_is_capped_and_logged(run_job, monkeypatch):
    monkeypatch.setattr(vs, "_motion", lambda *a: 0.3)
    shots = [{"sceneId": "sc_3", "narration": "Let your morning alarm", "needS": 3, "candidates": [cand("1000")]}]
    ans = resp(9, visible="A curtain at an open window")
    ans.update({"depicts": "yes"})
    results, _ = run_job(shots, {"1000": ans})
    ev = results[0]["evaluated"][0]
    assert ev["static"] is True and ev["motion"] == 0.3 and ev["score"] == vs.STATIC_MAX_SCORE and ev["matches"] is False
