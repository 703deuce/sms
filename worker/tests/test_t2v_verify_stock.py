from clips_worker.t2v.feature_gate import T2V_JOB_TYPES
from clips_worker.t2v.job import _pipeline_canvas
from clips_worker.t2v.verify_stock import _clamp_window, _host_allowed


def test_verify_job_is_gated_t2v_type():
    assert "T2V_VERIFY_STOCK" in T2V_JOB_TYPES


def test_window_grows_to_needed_length_inside_clip():
    assert _clamp_window({"in_s": 2, "out_s": 3}, 10, 5) == (0.0, 5.0)
    assert _clamp_window({"in_s": 8, "out_s": 9.5}, 10, 4) == (6, 10)


def test_window_clamped_to_clip_bounds():
    a, b = _clamp_window({"in_s": -3, "out_s": 99}, 12, 4)
    assert a == 0.0 and b == 12


def test_preview_hosts_allowlisted():
    assert _host_allowed("https://cdn.pixabay.com/video/x.mp4")
    assert not _host_allowed("http://cdn.pixabay.com/video/x.mp4")
    assert not _host_allowed("https://evil.example.com/x.mp4")


def test_pipeline_canvas_only_when_requested():
    assert _pipeline_canvas({"autobuild": {"assembleResolution": "480p"}}, "16:9", 1920, 1080) == (854, 480)
    # Export resolution alone must not shrink the assembled source.
    assert _pipeline_canvas({"autobuild": {"renderResolution": "480p"}}, "16:9", 1920, 1080) == (1920, 1080)
    assert _pipeline_canvas({}, "16:9", 1920, 1080) == (1920, 1080)


def test_near_duplicate_hash_threshold():
    from clips_worker.t2v.verify_stock import near_duplicate

    assert near_duplicate(["ffffffffffffffff"], ["fffffffffffffff0"])  # 4 bits
    assert not near_duplicate(["ffffffffffffffff"], ["0000000000000000"])
    assert not near_duplicate([], ["0000000000000000"])


def test_realistic_style_rejects_animation_and_dark():
    from clips_worker.t2v.verify_stock import Ctx, passes

    base = {"providerId": "1", "matches": True, "score": 8, "inS": 0, "outS": 5, "clipS": 10, "style": "live_action", "lighting": 7}
    assert passes(base, 5, Ctx(realistic=True))
    assert not passes({**base, "style": "3d_render"}, 5, Ctx(realistic=True))
    assert passes({**base, "style": "3d_render"}, 5, Ctx(realistic=False))
    assert not passes({**base, "lighting": 5}, 5, Ctx())  # minimum lighting is 6


def test_night_and_dark_only_for_night_lines():
    from clips_worker.t2v.verify_stock import Ctx, night_line, passes

    base = {"providerId": "1", "matches": True, "score": 8, "inS": 0, "outS": 5, "clipS": 10, "style": "live_action", "lighting": 7}
    assert not passes({**base, "timeOfDay": "night"}, 5, Ctx())
    assert not passes({**base, "luma": 0.07}, 5, Ctx())
    assert passes({**base, "timeOfDay": "night", "luma": 0.07}, 5, Ctx(night_ok=True))
    assert night_line("City lights glow at night as drivers head home.")
    assert not night_line("Drivers plug in and start the day with a full battery.")


def test_black_and_white_rejected_unless_requested():
    from clips_worker.t2v.verify_stock import Ctx, passes

    base = {"providerId": "1", "matches": True, "score": 8, "inS": 0, "outS": 5, "clipS": 10, "style": "live_action", "lighting": 7}
    assert not passes({**base, "saturation": 0.005}, 5, Ctx())
    assert passes({**base, "saturation": 0.135}, 5, Ctx())  # snowy scene, still colour
    assert passes({**base, "saturation": 0.005}, 5, Ctx(mono_ok=True))


def test_color_stats_on_synthetic_frames(tmp_path=None):
    import subprocess
    import tempfile
    from pathlib import Path

    from clips_worker.t2v.verify_stock import _color_stats

    d = Path(tempfile.mkdtemp())
    for name, src in (("gray", "color=c=gray:s=64x36:d=2"), ("red", "color=c=red:s=64x36:d=2"), ("black", "color=c=0x101010:s=64x36:d=2")):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", src, "-pix_fmt", "yuv420p", str(d / f"{name}.mp4")], check=True)
    sat_gray, _ = _color_stats(d / "gray.mp4", 0, 2)
    sat_red, _ = _color_stats(d / "red.mp4", 0, 2)
    _, luma_black = _color_stats(d / "black.mp4", 0, 2)
    assert sat_gray < 0.06 < sat_red
    assert luma_black < 0.12


def test_prompt_formats_with_style_rule():
    from clips_worker.t2v.verify_stock import PROMPT

    out = PROMPT.format(narration="n", intent="i", subject="s", topic="t", clip_s=10.0, need_s=4.0, style_rule="RULE")
    assert "RULE" in out


def test_usable_tier_is_score_five_lit_live_action():
    from clips_worker.t2v.verify_stock import Ctx, usable

    base = {"providerId": "1", "matches": False, "score": 5, "inS": 0, "outS": 5, "clipS": 10, "style": "live_action", "lighting": 6}
    assert usable(base, 5, Ctx())
    assert not usable({**base, "score": 4}, 5, Ctx())
    assert not usable({**base, "lighting": 5}, 5, Ctx())
    assert not usable({**base, "style": "animation"}, 5, Ctx())


def _alignment(text: str, wps: float = 2.5, gap: float = 0.2):
    chars, starts, ends = [], [], []
    t = 0.0
    for wi, word in enumerate(text.split()):
        if wi:
            chars.append(" "); starts.append(t); ends.append(t + gap); t += gap
        per = (1 / wps) / len(word)
        for ch in word:
            chars.append(ch); starts.append(t); ends.append(t + per); t += per
    return {"characters": chars, "character_start_times_seconds": starts, "character_end_times_seconds": ends}


def test_cut_offsets_land_in_pauses_between_words():
    from clips_worker.t2v.job import cut_offsets_from_alignment
    from clips_worker.t2v.tts_alignment import words_from_alignment

    al = _alignment("workers move along the rows picking ripe cherries by hand every single morning")
    words = words_from_alignment(al, offset_s=0, scene_slot=0)
    vo_s = words[-1]["e"]
    (off,) = cut_offsets_from_alignment(al, [6], vo_s)
    assert words[5]["e"] <= off <= words[6]["s"]
    # out of range / too close to the start -> no cut
    assert cut_offsets_from_alignment(al, [0, 99, 1], vo_s) == [None, None, None]


def test_cut_lengths_sum_exactly():
    from clips_worker.t2v.assemble import cut_lengths

    assert cut_lengths(6.0, [2.0, 4.1], 30) == [60, 63, 57]
    assert sum(cut_lengths(5.017, [1.3], 30)) == round(5.017 * 30)


def test_scene_with_cuts_renders_exact_length():
    import subprocess
    import tempfile
    from pathlib import Path

    from clips_worker.t2v.assemble import Scene, SceneMedia, normalize_scene, probe_duration

    d = Path(tempfile.mkdtemp())
    sc = Scene(id="a", dur_s=4.0, media=SceneMedia(kind="color", color="0xff0000"),
               cuts=[(1.5, SceneMedia(kind="color", color="0x00ff00")), (3.0, SceneMedia(kind="color", color="0x0000ff"))])
    out = normalize_scene(sc, d / "s.mp4", w=64, h=36, fps=30, length_s=4.0)
    assert abs(probe_duration(out) - 4.0) < 0.05
    px = subprocess.run(["ffmpeg", "-v", "error", "-ss", "2.0", "-i", str(out), "-frames:v", "1", "-vf", "scale=1:1,format=rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
    assert px[1] > 150 and px[0] < 100  # green section between the cuts
