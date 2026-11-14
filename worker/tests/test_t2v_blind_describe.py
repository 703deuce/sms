"""T2V blind describe-then-score (NEW 1) and the verified playback window (NEW 2).

Gemini, downloads and ffmpeg are mocked; no network, no paid calls. The observations are shaped like the describe
test's LOW answers for the real cases (t2v/describe_test/results.md): cafe 2339 (phone held up ~3-7 s, put down by
~9 s, then eating) and flashlight 144635 (near-black for the first ~2 s, then a silhouette with a flashlight).
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

import clips_worker.gemini as gemini_mod
import clips_worker.internal_callback as cb_mod
from clips_worker.t2v import assemble as asm
from clips_worker.t2v import verify_stock as vs


def ev(t0, t1, visible, action="", lighting="bright"):
    return {"t_start": t0, "t_end": t1, "visible": visible, "action": action, "motion": "none", "lighting": lighting}


CAFE_2339 = {"events": [
    ev(0, 3, "two people at a cafe table, the left one holding a smartphone up", "looks at the phone"),
    ev(3, 7, "the left person holds the smartphone up in front of her face", "scrolls on the phone"),
    ev(7, 9, "the left person lowers the smartphone and puts it on the table", "puts the phone down"),
    ev(9, 35, "both people eat from plates", "eating and talking"),
], "style": "live-action camera footage", "notes": ""}

FLASHLIGHT_144635 = {"events": [
    ev(0, 2, "a dusk treeline, almost black; a tiny point of light far away", "nothing readable", "near-black, too dark to see"),
    ev(2, 7, "a silhouette walks toward the camera holding a flashlight", "walking forward", "dusk blue, flashlight beam visible"),
    ev(7, 13, "the person with the flashlight comes close and fills the frame", "walking forward", "flashlight bright"),
], "style": "live-action camera footage", "notes": ""}


class _Cur:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        self.conn.sql.append(sql)
        if "UPDATE clip_jobs" in sql:
            self.conn.sink["payload"] = json.loads(params[0])
        if "INSERT INTO t2v_clip_descriptions" in sql:
            self.conn.cache[tuple(params[:3])] = params[4]
        self._rows = []
        if "FROM t2v_clip_descriptions" in sql:
            keys = [tuple(params[k:k + 3]) for k in range(0, len(params), 3)]
            self._rows = [(*k, self.conn.cache[k]) for k in keys if k in self.conn.cache]

    def fetchall(self):
        return self._rows


class _Conn:
    def __init__(self, cache=None):
        self.sink: dict = {}
        self.sql: list[str] = []
        self.cache: dict = dict(cache or {})

    def cursor(self):
        return _Cur(self)

    def commit(self):
        pass

    def rollback(self):
        pass


@pytest.fixture
def blind_job(monkeypatch):
    """Run the verify job in blind mode. observations: providerId -> pass-1 JSON; judge(pid, prompt) -> pass-2 JSON."""

    def _run(shots, observations, judge, conn=None, alpha=0.0):
        calls = {"describe": [], "score": []}

        def fake_describe(model, video: Path, mime="video/mp4"):
            pid = video.name.split("_", 1)[1].rsplit("_m.", 1)[0]
            calls["describe"].append(pid)
            return json.dumps(observations[pid]), 900, 300

        def fake_score(model, prompt):
            pid = next(p for p in observations if f"<<{p}>>" in prompt) if "<<" in prompt else None
            calls["score"].append(prompt)
            return judge(pid, prompt), 1700, 250

        monkeypatch.setattr(vs, "BLIND_DESCRIBE", True)
        monkeypatch.setattr(vs, "_download", lambda url, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_mute_and_shrink", lambda src, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_shrink_photo", lambda src, dest: dest.write_bytes(b"x"))
        monkeypatch.setattr(vs, "_alpha_fraction", lambda *a: alpha)
        monkeypatch.setattr(vs, "_color_stats", lambda *a: (0.4, 0.5))
        monkeypatch.setattr(vs, "_dhash_frames", lambda *a: [])
        monkeypatch.setattr(vs, "_motion", lambda *a: 5.0)
        monkeypatch.setattr(vs, "_frozen_spans", lambda *a: [])
        monkeypatch.setattr(vs, "_model", lambda: "gemini-test")
        monkeypatch.setattr(vs, "_gemini_describe", fake_describe)
        monkeypatch.setattr(vs, "_gemini_score", fake_score)
        monkeypatch.setattr(vs, "_gemini_watch", lambda *a, **k: pytest.fail("the combined video call must not run"))
        monkeypatch.setattr(gemini_mod, "_log_usage", lambda *a, **k: None)
        monkeypatch.setattr(cb_mod, "post_internal", lambda *a, **k: None)
        conn = conn or _Conn()
        payload = {"draftId": "d1", "workspaceId": "w1", "projectId": "p1", "topic": "t", "realistic": True,
                   "shots": shots, "script": "1. a line\n2. another line", "videoUnderstanding": "a guide"}
        vs.run_t2v_verify_stock_job(conn, {"id": "job_1", "payload": payload})
        return conn.sink["payload"], calls, conn

    return _run


def cand(pid, dur):
    return {"provider": "pixabay", "providerId": pid, "previewUrl": f"https://cdn.pixabay.com/v/{pid}_tiny.mp4",
            "durationS": dur, "query": "q", "author": "a"}


def shot(sid, narration, line_shows, need, cands):
    return {"sceneId": sid, "narration": narration, "lineShows": line_shows, "needS": need, "lineNo": 1,
            "intent": line_shows, "candidates": cands}


def answer(in_s, out_s, depicts="yes", score=8, artifacts="none"):
    return {"in_s": in_s, "out_s": out_s, "seen": "what the events in the window show", "depicts": depicts,
            "artifacts": artifacts, "score": score, "fit_reason": "r", "visible": "v", "main_subject": "s",
            "action": "a", "matches": score >= 7, "subject_visible": True, "issues": "", "style": "live_action",
            "lighting": 7, "framing": "medium", "time_of_day": "indoor"}


def test_pass1_is_blind_no_line_script_or_search_terms():
    p = vs.DESCRIBE_PROMPT + vs.DESCRIBE_EXTRA
    assert p.startswith("Describe exactly what happens in this clip, second by second: who/what is visible, what they do, "
                        "the direction of any motion, colours, lighting, indoor/outdoor, time of day.")
    for word in ("{", "line", "script", "narration", "search", "query"):
        assert word not in p.lower().replace("the line", "")
    assert set(vs.OBSERVE_SCHEMA["properties"]["events"]["items"]["required"]) == {"t_start", "t_end", "visible", "action", "motion", "lighting"}


def test_pass1_request_has_only_the_clip_and_the_blind_prompt(monkeypatch, tmp_path):
    sent = []
    monkeypatch.setattr(vs, "_gemini_post", lambda model, parts, gen: sent.append((parts, gen)) or (json.dumps(CAFE_2339), 1, 1))
    clip = tmp_path / "c.mp4"
    clip.write_bytes(b"x")
    vs._gemini_describe("gemini-test", clip)
    parts, gen = sent[0]
    assert parts[0]["videoMetadata"] == {"fps": 1} and gen["mediaResolution"] == "MEDIA_RESOLUTION_LOW"
    assert parts[1]["text"] == vs.DESCRIBE_PROMPT + vs.DESCRIBE_EXTRA
    assert gen["responseSchema"] is vs.OBSERVE_SCHEMA


def test_pass2_is_text_only(monkeypatch):
    sent = []
    monkeypatch.setattr(vs, "_gemini_post", lambda model, parts, gen: sent.append(parts) or (json.dumps(answer(0, 3)), 1, 1))
    vs._gemini_score("gemini-test", "prompt")
    assert sent[0] == [{"text": "prompt"}]


def test_cafe_2339_window_comes_from_the_events_and_plays_unchanged(blind_job):
    """Old: the model's 0-35 s window played from 0 (the phone held up), VQ saw 'raises a phone'. Now pass 2 picks
    the put-down event, and the verified slice is the one judged."""
    def judge(pid, prompt):
        assert "LOCKED" in prompt and "[7.0-9.0 s]" in prompt and "puts the phone down" in prompt
        if "window is FIXED" in prompt:
            return answer(6.0, 9.6, depicts="yes", score=8)
        return answer(7, 9)

    sh = shot("sc_10", "and set bright screens aside before bed.", "a person putting a phone away", 3.0, [cand("2339", 35)])
    out, calls, _ = blind_job([sh], {"2339": CAFE_2339}, judge)
    e = out["results"][0]["evaluated"][0]
    assert (e["judgedInS"], e["judgedOutS"]) == (7.0, 9.0)
    # 3.0 s need -> 3.6 s slice centred on the 7-9 s event; it reaches into the neighbouring events, so pass 2
    # re-judged exactly that slice (text only) and the stored judgement is on it.
    assert (e["inS"], e["outS"]) == (6.2, 9.8)
    assert e["rejudged"]["window"] == [7.0, 9.0]
    assert any("window is FIXED: in_s = 6.2, out_s = 9.8" in p for p in calls["score"])
    assert e["depicts"] == "yes" and e["score"] == 8 and e["blind"] is True
    assert any("puts the phone down" in w for w in e["windowEvents"])
    assert e["observation"].startswith("[0.0-3.0 s]")
    assert calls["describe"] == ["2339"] and len(calls["score"]) == 2
    s = out["summary"]
    assert (s["describeCalls"], s["scoreCalls"], s["geminiCalls"]) == (1, 2, 3)


def test_flashlight_144635_skips_the_near_black_start_without_a_rejudge(blind_job):
    def judge(pid, prompt):
        assert "window is FIXED" not in prompt
        return answer(2, 13)

    sh = shot("sc_3", "Keep a flashlight within reach.", "a person holding a lit flashlight", 2.0, [cand("144635", 13)])
    out, calls, _ = blind_job([sh], {"144635": FLASHLIGHT_144635}, judge)
    e = out["results"][0]["evaluated"][0]
    # The 2.5 s slice sits inside the judged 2-13 s window (centred), never in the near-black first 2 s.
    assert e["inS"] >= 2.0 and e["outS"] <= 13.0 and e["outS"] - e["inS"] == pytest.approx(2.5)
    assert "rejudged" not in e and len(calls["score"]) == 1
    assert all("near-black" not in w for w in e["windowEvents"])


def test_one_describe_per_unique_clip_across_lines_and_reruns(blind_job):
    judge = lambda pid, prompt: answer(3, 7)  # noqa: E731
    shots = [shot("a", "line a", "a phone held up", 3.0, [cand("2339", 35)]),
             shot("b", "line b", "people eating", 3.0, [cand("2339", 35)])]
    out, calls, conn = blind_job(shots, {"2339": CAFE_2339}, judge)
    assert calls["describe"] == ["2339"] and len(calls["score"]) == 2
    assert out["summary"]["describeCacheHits"] == 1
    key = ("pixabay", "2339", f"video:tiny:{vs.DESCRIBE_FEED}:{vs.DESCRIBE_VERSION}")
    assert key in conn.cache
    # Rerun: the table already has it -> no describe call at all.
    out2, calls2, _ = blind_job(shots, {"2339": CAFE_2339}, judge, conn=_Conn(conn.cache))
    assert calls2["describe"] == [] and out2["summary"]["describeCalls"] == 0 and out2["summary"]["describeCacheHits"] == 2


def test_ai_clips_are_never_cached():
    assert vs.describe_key({"provider": "replicate", "providerId": "x", "kind": "ai"}) is None
    assert vs.describe_key({"provider": "pixabay", "providerId": "1", "previewUrl": "https://cdn.pixabay.com/a_small.mp4"})[2].startswith("video:small:")


def test_production_artifact_in_the_observation_caps_the_score(blind_job):
    obs = {"events": [ev(0, 8, "a person in front of a green screen holds a mug", "drinks")],
           "style": "live action", "notes": "green screen and studio lights visible"}
    out, _, _ = blind_job([shot("s", "Drink something warm.", "a person drinking a warm drink", 3.0, [cand("9", 8)])],
                          {"9": obs}, lambda pid, p: answer(0, 8, score=9))
    e = out["results"][0]["evaluated"][0]
    assert e["artifacts"] == "production" and e["score"] == 3 and e["matches"] is False


def test_norm_artifacts_backstop_is_generic():
    assert vs.norm_artifacts("none", "a chroma key backdrop") == "production"
    assert vs.norm_artifacts("none", "a person stretching on a mat") == "none"
    assert vs.norm_artifacts("weird") == "none"
    assert vs.norm_artifacts("dark") == "dark"


def test_observation_is_cleaned_and_snapped():
    obs = vs.norm_observation({"events": [ev(3, 7, "b"), ev(0, 3, "a"), ev(7, 99, "c")]}, 12.0)
    assert [(e["t_start"], e["t_end"]) for e in obs["events"]] == [(0, 3), (3, 7), (7, 12)]
    assert vs.snap_to_events(obs, 3.5, 6.0, 12.0) == (3, 7)
    assert vs.needs_rejudge(obs, (3, 7), (4, 6)) is False
    assert vs.needs_rejudge(obs, (3, 7), (2.5, 6.5)) is True
    assert vs.needs_rejudge(obs, (3, 7), (3.0, 7.3)) is False  # a 0.3 s sliver of the next event


def test_play_window_is_centred_and_never_snaps_to_zero():
    assert vs.play_window(7, 9, 35, 3.6) == (6.2, 9.8)
    assert vs.play_window(2, 13, 13, 2.5) == (6.25, 8.75)
    assert vs.play_window(11, 13, 13, 4) == (9.0, 13.0)
    assert vs.play_window(0, 5, 3, 4) == (0.0, 3.0)
    assert vs.play_need(3.0) == 3.6


def test_frozen_segments_from_frame_diffs():
    diffs = [3, 3] + [0.02] * 6 + [3] * 4 + [0.05] * 2
    assert vs.frozen_spans_from_diffs(diffs) == [(0.5, 2.0)]
    assert vs.frozen_overlap([(0.5, 2.0)], 1.0, 4.0) == 1.0


# --- assembly: the rendered window is the verified window ---------------------------------------------------

def test_rendered_window_matches_the_verified_window():
    m = asm.SceneMedia(kind="video", src_in_s=6.2, window_in_s=6.2, window_out_s=9.8, label="sc_10:2339")
    start, loop = asm.render_start(m.src_in_s, 35.0, 3.4)
    r = asm.window_report(m, start, 3.4, loop)
    assert r["startMatches"] and r["outsideS"] == 0 and r["rendered"] == [6.2, 9.6] and not loop


def test_long_line_extends_around_the_window_instead_of_looping_to_zero():
    # Old: src_len - src_in < length -> -stream_loop: the shot jumped back to second 0 mid-line.
    start, loop = asm.render_start(10.0, 13.0, 4.0)
    assert (start, loop) == (9.0, False)
    assert asm.render_start(0.0, 3.0, 4.0) == (0.0, True)


def test_transparent_photo_is_flattened(tmp_path):
    from PIL import Image

    im = Image.new("RGBA", (64, 36), (255, 0, 0, 0))
    for x in range(16, 48):
        for y in range(8, 28):
            im.putpixel((x, y), (0, 0, 255, 255))
    src = tmp_path / "cut.png"
    im.save(src)
    out = asm.flatten_alpha(src)
    assert out != src
    px = subprocess.run(["ffmpeg", "-v", "error", "-i", str(out), "-vf", "crop=1:1:0:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                        capture_output=True).stdout
    assert tuple(px[:3]) == (255, 255, 255)  # white, not the hidden red edge colour
    jpg = tmp_path / "x.jpg"
    Image.new("RGB", (8, 8)).save(jpg)
    assert asm.flatten_alpha(jpg) == jpg


def test_cutout_photo_is_flagged_and_capped(blind_job):
    # snow #1194 L5 img_966334: a cut-out PNG, 35 % transparent.
    obs = {"events": [ev(0, 0, "a weekly pill organizer", "nothing")], "style": "photo", "notes": ""}
    c = {**cand("img_966334", 0), "kind": "photo", "previewUrl": "https://cdn.pixabay.com/p/x_640.png"}

    def run():
        return blind_job([shot("s5", "where everyone can find them", "medicines kept in one easy-to-find place", 3.0, [c])],
                         {"img_966334": obs}, lambda pid, p: answer(0, 3, score=9), alpha=0.35)

    out, _, _ = run()
    e = out["results"][0]["evaluated"][0]
    assert e["artifacts"] == "cutout" and e["score"] == 4 and e["matches"] is False


# --- V5 fixtures: "Stop X" and night lines are judged on the blind observation against the FIXED lineShows -----
# (mocked model answers: these pin the plumbing - pass 1 never sees the line, pass 2 gets the fixed lineShows, the
# warn rule and the locked events, and a "no" on the window is capped below the floor.)

def test_stop_x_line_judges_the_observed_act_against_the_advised_result(blind_job):
    obs = {"events": [ev(0, 6, "a person lying in bed scrolling a smartphone", "scrolling", "dark room lit by the screen")],
           "style": "live action", "notes": ""}

    def judge(pid, prompt):
        assert 'line_shows - what a viewer should SEE for this line (fixed for every clip of this line): "a phone set face-down away from the bed"' in prompt
        assert "If the line warns against doing something, a clip that shows that act" in prompt
        assert "scrolling a smartphone" in prompt
        return answer(0, 6, depicts="no", score=7)

    out, calls, _ = blind_job([shot("s12", "Stop scrolling once you are in bed.", "a phone set face-down away from the bed", 3.0,
                                    [cand("501", 6)])], {"501": obs}, judge)
    e = out["results"][0]["evaluated"][0]
    assert e["score"] == 4 and e["matches"] is False and out["results"][0]["chosen"]["verdict"] == "best_available"


def test_night_line_reads_the_observed_lighting(blind_job):
    obs = {"events": [ev(0, 5, "a bedroom with a made bed", "nothing", "bright midday sunlight through the window")],
           "style": "live action", "notes": ""}

    def judge(pid, prompt):
        assert "bright midday sunlight" in prompt and '"a dark bedroom at night' in prompt
        return answer(0, 5, depicts="partly", score=8)

    out, _, _ = blind_job([shot("s3", "Make the bedroom dark.", "a dark bedroom at night with lights off", 3.0, [cand("502", 5)])],
                          {"502": obs}, judge)
    e = out["results"][0]["evaluated"][0]
    assert e["score"] == 6 and e["depicts"] == "partly" and not e["matches"]
