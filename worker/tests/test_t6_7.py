"""T6.7: scene map, facecam trust, pick tiers, titles, pts-aligned audio, one shared pipeline."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker import t6_scenes as S
from clips_worker.audio_extract import PTS_ALIGN_AF, audio_extract_cmd
from clips_worker.clip_classify import CLASSIFY_SCHEMA, classify_frame_times, resolve_type_from_classification
from clips_worker.t6_pick import apply_t6_template_to_edits, eligible, pick_template
from clips_worker.t6_registry import TEMPLATES
from clips_worker.t6_signals import resolve_facecam_trust, signals_or_defaults
from clips_worker.t6_titles import pick_title_style

FACE = {"x": 0.45, "y": 0.2, "w": 0.1, "h": 0.18}
CAM_FACE = {"x": 0.05, "y": 0.65, "w": 0.1, "h": 0.18}  # inside the bottom-left webcam slot


# ---------------------------------------------------------------- audio (caption sync)
def test_audio_extract_uses_pts_aligned_resample():
    cmd = audio_extract_cmd("in.mp4", "out.wav")
    assert cmd[cmd.index("-af") + 1] == PTS_ALIGN_AF
    assert "first_pts=0" in PTS_ALIGN_AF and "async=1" in PTS_ALIGN_AF
    assert cmd[cmd.index("-ar") + 1] == "16000" and cmd[cmd.index("-ac") + 1] == "1"
    seek = audio_extract_cmd("in.mp4", "o.opus", ss_s=12.5, t_s=30, codec="libopus", bitrate="24k", rate=None, mono=False)
    assert seek.index("-ss") < seek.index("-i") and "-ar" not in seek and "-ac" not in seek


def test_clip_cut_uses_same_pts_aligned_audio(monkeypatch):
    """Clip files and exports are cut with the transcript's audio recipe (gap inside a clip)."""
    import clips_worker.stage_log as SL
    from clips_worker.render_clip import ffmpeg_cut

    seen = {}
    monkeypatch.setattr(SL, "ffmpeg_run", lambda argv, **kw: seen.setdefault("argv", argv))
    ffmpeg_cut("in.mp4", "out.mp4", 1000, 5000)
    argv = seen["argv"]
    assert argv[argv.index("-af") + 1] == PTS_ALIGN_AF and argv.index("-ss") < argv.index("-i")


# ---------------------------------------------------------------- scene map
def test_scene_schema_is_one_extra_field():
    assert "scenes" in CLASSIFY_SCHEMA["properties"] and "scenes" in CLASSIFY_SCHEMA["required"]
    lay = CLASSIFY_SCHEMA["properties"]["scenes"]["items"]["properties"]["layout"]["enum"]
    assert tuple(lay) == S.SCENE_LAYOUTS


def test_scene_boxes_accept_gemini_0_1000_grid():
    assert S.norm_box({"x": 405, "y": 88, "w": 189, "h": 272}) == {"x": 0.405, "y": 0.088, "w": 0.189, "h": 0.272}
    assert S.norm_box({"x": 0.405, "y": 0.088, "w": 0.189, "h": 0.272}) == {"x": 0.405, "y": 0.088, "w": 0.189, "h": 0.272}
    assert S.norm_box({"x": 482, "y": 259, "w": 0.22, "h": 0.35}) == {"x": 0.482, "y": 0.259, "w": 0.22, "h": 0.35}
    assert S.norm_box({"x": 5000, "y": 0, "w": 10, "h": 10}) is None


def test_frame_times_bounded():
    assert len(classify_frame_times(10)) == 4 and len(classify_frame_times(300)) == 8
    ts = classify_frame_times(40)
    assert ts == sorted(ts) and 0 < ts[0] < ts[-1] < 40


def test_normalize_merges_short_and_covers_timeline():
    raw = [
        {"start_s": 0.4, "end_s": 10, "layout": "webcam_game", "facecam_box": {"x": 0, "y": 0, "w": 0.2, "h": 0.25}, "real_person_boxes": [FACE]},
        {"start_s": 10, "end_s": 11.2, "layout": "no_person", "real_person_boxes": []},  # < 2 s -> merged
        {"start_s": 11.2, "end_s": 30, "layout": "full_cam_person", "real_person_boxes": [FACE]},
        {"start_s": 31, "end_s": 33, "layout": "bogus", "real_person_boxes": []},  # dropped
    ]
    sc = S.normalize_scene_map(raw, 32.0)
    assert [s["layout"] for s in sc] == ["webcam_game", "full_cam_person"]
    assert sc[0]["start_s"] == 0.0 and sc[-1]["end_s"] == 32.0
    assert all(b["end_s"] - b["start_s"] >= S.MIN_SCENE_S for b in sc)
    assert sc[0]["end_s"] == sc[1]["start_s"]


def test_normalize_whole_frame_scene_drops_boxes():
    sc = S.normalize_scene_map([{"start_s": 0, "end_s": 20, "layout": "no_person", "real_person_boxes": [FACE],
                                 "facecam_box": {"x": 0, "y": 0, "w": 0.3, "h": 0.3}}], 20)
    assert sc[0]["real_person_boxes"] == [] and sc[0]["facecam_box"] is None
    assert S.normalize_scene_map(None, 20) == [] and S.normalize_scene_map([], 20) == []


def test_yunet_only_refines_inside_ai_box():
    ai = {"x": 0.4, "y": 0.15, "w": 0.2, "h": 0.3}
    pumpkin = [(i, 0.75, 0.3, 0.06, 0.1, 0.9) for i in range(6)]  # outside the AI box
    f = S.refine_person_box(ai, pumpkin, 6)
    assert f["source"] == "ai" and f["x"] == ai["x"]  # ignored outside, AI box kept
    real = [(i, 0.46 + 0.01 * (i % 3), 0.2 + 0.008 * i, 0.08 + 0.004 * (i % 2), 0.14, 0.9) for i in range(6)]
    g = S.refine_person_box(ai, real, 6)
    assert g["source"] == "ai+yunet" and 0.45 <= g["x"] <= 0.49


def test_static_face_backstop_drops_picture_inside_ai_box():
    ai = {"x": 0.4, "y": 0.15, "w": 0.2, "h": 0.3}
    statue = [(i, 0.45, 0.2, 0.08, 0.14, 0.9) for i in range(6)]  # never moves
    assert S.refine_person_box(ai, statue, 6) is None


def _sig(ct="gaming", **kw):
    s = signals_or_defaults({"clipType": ct})
    s.update({"type_conf": 0.9, "faces": [], "background_action": False, **kw})
    return s


def test_whole_frame_scenes_render_whole_frame():
    for ct in ("gaming", "irl", "just_chatting", "podcast"):
        for lay in S.WHOLE_FRAME_LAYOUTS:
            sc = {"start_s": 0, "end_s": 10, "layout": lay, "n_cams": 0, "real_person_boxes": [], "faces": [FACE],
                  "facecam_box": None, "content_box": None}
            tid, _ = S.pick_scene_template(_sig(ct), sc, "seed", [])
            panels = TEMPLATES[tid]["panels"]
            assert len(panels) == 1 and panels[0]["src"] == "full", (ct, lay, tid)


def test_webcam_game_scene_gets_facecam_template():
    sc = {"start_s": 0, "end_s": 30, "layout": "webcam_game", "n_cams": 0, "real_person_boxes": [FACE],
          "faces": [dict(FACE, persist=1.0)], "facecam_box": {"x": 0.0, "y": 0.6, "w": 0.25, "h": 0.4}, "content_box": None}
    for seed in ("a", "b", "c", "d"):
        tid, why = S.pick_scene_template(_sig("gaming"), sc, seed, [])
        assert tid in ("G1", "G2", "G3", "G6"), (tid, why)


def test_multi_cam_template_follows_located_people():
    f2 = {"x": 0.75, "y": 0.2, "w": 0.1, "h": 0.18}
    f3 = {"x": 0.1, "y": 0.6, "w": 0.1, "h": 0.18}
    want = {1: "C7", 2: "C5", 3: "C8"}
    for n, boxes in ((1, [FACE]), (2, [FACE, f2]), (3, [FACE, f2, f3])):
        sc = {"start_s": 0, "end_s": 30, "layout": "multi_cam", "n_cams": 3, "real_person_boxes": boxes,
              "faces": [dict(b, persist=1.0) for b in boxes], "facecam_box": None, "content_box": None}
        tid, why = S.pick_scene_template(_sig("podcast"), sc, "s", [])
        assert tid == want[n], (n, tid, why)


def test_group_in_one_camera_gets_whole_frame():
    f2 = {"x": 0.7, "y": 0.2, "w": 0.1, "h": 0.18}
    sc = {"start_s": 0, "end_s": 30, "layout": "full_cam_person", "n_cams": 1, "real_person_boxes": [FACE, f2],
          "faces": [dict(FACE, persist=1.0), dict(f2, persist=1.0)], "facecam_box": None, "content_box": None}
    for lane in ("podcast", "just_chatting", "irl"):
        tid, why = S.pick_scene_template(_sig(lane), sc, "s", [])
        assert tid not in ("C1", "C2", "C4", "I5", "C5", "C7", "C8"), (lane, tid, why)
        assert tid in S.WHOLE_FRAME_TEMPLATES.get(S.scene_signals(_sig(lane), sc)["clip_type"], ()), (lane, tid)


def test_empty_webcam_slot_is_not_a_facecam():
    slot = {"x": 0.75, "y": 0.4, "w": 0.25, "h": 0.25}
    dark = S.normalize_scene_map([{"start_s": 0, "end_s": 30, "layout": "webcam_game", "real_person_boxes": [], "facecam_box": slot}], 30)
    assert dark[0]["layout"] == "no_person" and dark[0]["facecam_box"] is None
    off = S.normalize_scene_map([{"start_s": 0, "end_s": 30, "layout": "webcam_game", "real_person_boxes": [FACE], "facecam_box": slot}], 30)
    assert off[0]["layout"] == "webcam_game" and off[0]["facecam_box"] is None   # person not inside the slot
    live = S.normalize_scene_map([{"start_s": 0, "end_s": 30, "layout": "webcam_game",
                                   "real_person_boxes": [{"x": 0.8, "y": 0.45, "w": 0.08, "h": 0.12}], "facecam_box": slot}], 30)
    assert live[0]["facecam_box"] == slot


def test_prompt_states_johns_layout_rules():
    from clips_worker.clip_classify import CLASSIFY_PROMPT as P
    assert "SEPARATE camera feeds" in P and "NEVER a group filmed by one camera" in P
    assert "live person is visible" in P and "podcast cues" in P


def test_full_cam_scene_crops_ai_face_not_cv_face():
    from clips_worker.t6_geometry import resolve_template_geometry

    real = dict(FACE, persist=1.0)
    sig = _sig("just_chatting", faces=[{"x": 0.75, "y": 0.3, "w": 0.06, "h": 0.1, "persist": 1.0}])  # CV: pumpkin
    sig["scenes"] = [{"start_s": 0, "end_s": 30, "layout": "full_cam_person", "n_cams": 1, "real_person_boxes": [FACE],
                      "faces": [real], "facecam_box": None, "content_box": None}]
    sc_sig = S.scene_signals(sig, sig["scenes"][0])
    tid, _ = S.pick_scene_template(sig, sig["scenes"][0], "x", [])
    spec = resolve_template_geometry(TEMPLATES[tid], sc_sig, {"layout": {"template": {"id": tid}}})
    src = spec["panels"][0]["src"]
    cx = src["x"] + src["w"] / 2
    assert abs(cx - (FACE["x"] + FACE["w"] / 2)) < 0.12, (tid, src)


def test_segments_written_and_dominant_is_clip_template():
    sig = _sig("gaming")
    sig["scenes"] = [
        {"start_s": 0, "end_s": 8, "layout": "no_person", "n_cams": 0, "real_person_boxes": [], "faces": [], "facecam_box": None, "content_box": None},
        {"start_s": 8, "end_s": 40, "layout": "webcam_game", "n_cams": 0, "real_person_boxes": [FACE], "faces": [dict(FACE, persist=1.0)],
         "facecam_box": {"x": 0.0, "y": 0.6, "w": 0.25, "h": 0.4}, "content_box": None},
    ]
    out = apply_t6_template_to_edits({"layout": {"mode": "fit_blur"}}, signals=sig, clip={"start_ms": 120000}, history=[],
                                     batch_counts={}, batch_size=1, seed="clip_x")
    tpl = out["layout"]["template"]
    assert tpl["id"] in ("G1", "G2", "G3", "G6")
    assert [s["id"] for s in tpl["segments"]][0] == "G4" and tpl["segmentsBaseMs"] == 120000
    assert tpl["segments"][1]["id"] == tpl["id"]


def test_export_scene_parts_respect_user_choice_and_offset():
    from clips_worker.edits_render import _t6_scene_parts

    sig = _sig("gaming")
    sig["scenes"] = [
        {"start_s": 0, "end_s": 8, "layout": "no_person", "n_cams": 0, "real_person_boxes": [], "faces": [], "facecam_box": None, "content_box": None},
        {"start_s": 8, "end_s": 40, "layout": "irl_world", "n_cams": 0, "real_person_boxes": [], "faces": [], "facecam_box": None, "content_box": None},
    ]
    tmpl = {"id": "G4", "auto": True, "segmentsBaseMs": 10000,
            "segments": [{"startS": 0, "endS": 8, "id": "G4", "lane": "gaming", "scene": 0},
                         {"startS": 8, "endS": 40, "id": "I2", "lane": "irl", "scene": 1}]}
    parts = _t6_scene_parts(tmpl, sig, {"layout": {"template": tmpl}}, play_w=720, play_h=1280, clip_start_ms=8000)
    assert len(parts) == 2 and parts[0][0] == 0.0 and abs(parts[1][0] - 10.0) < 1e-6  # +2 s export pre-roll
    assert _t6_scene_parts({**tmpl, "boxes": {"facecam": FACE}}, sig, {}, play_w=720, play_h=1280) == []
    assert _t6_scene_parts({**tmpl, "auto": False}, sig, {}, play_w=720, play_h=1280) == []


# ---------------------------------------------------------------- classify / facecam / pick / titles
def test_scene_map_studio_show_is_not_irl():
    cls = {"confidence": 0.9, "main_picture": "real_camera", "seated_talking_to_camera": False, "people_on_camera": 3,
           "clip_type": "podcast", "scenes": [{"start_s": 0, "end_s": 30, "layout": "multi_cam", "n_cams": 3}]}
    assert resolve_type_from_classification(cls, facecam_conf=0.0, picker_moment=None, fallback="irl")[0] == "podcast"
    cls["scenes"] = [{"start_s": 0, "end_s": 30, "layout": "irl_world"}]
    assert resolve_type_from_classification(cls, facecam_conf=0.0, picker_moment=None, fallback="irl")[0] == "irl"


def test_unconfirmed_face_box_is_not_a_facecam():
    s = _sig("just_chatting", facecam_box={"x": 0.71, "y": 0.31, "w": 0.1, "h": 0.2}, facecam_conf=0.5)
    out = resolve_facecam_trust(s, {"facecam": s["facecam_box"], "confidence": 0.5, "method": "face_box"}, {})
    assert out["facecam_box"] is None and out["facecam_box_unconfirmed"]


def test_unstable_face_blocks_face_crop():
    s = _sig("just_chatting", faces=[dict(FACE, persist=0.6)])
    assert not eligible(TEMPLATES["C1"], s, {}, "just_chatting")
    s["faces"] = [dict(FACE, persist=0.95)]
    assert eligible(TEMPLATES["C1"], s, {}, "just_chatting")


def test_structure_beats_tie_noise():
    s = _sig("gaming", facecam_box={"x": 0, "y": 0.6, "w": 0.25, "h": 0.4}, facecam_conf=0.9)
    picks = {pick_template(s, {}, [], {}, 1, f"seed{i}")[0] for i in range(20)}
    assert picks <= {"G1", "G2", "G3", "G6"} and len(picks) >= 2


def test_titles_follow_backdrop():
    blur_spec = {"bands": [{"fill": "blur"}]}
    dark = {"bands": {"top": {"luma": 0.2, "busy": 0.9}, "bottom": {"luma": 0.2, "busy": 0.9}, "caption": {"luma": 0.2, "busy": 0.9}}}
    light = {"bands": {k: {"luma": 0.8, "busy": 0.2} for k in ("top", "bottom", "caption")}}
    assert pick_title_style(blur_spec, dark, [])[0] == "white_on_dark_blur"
    assert pick_title_style(blur_spec, light, [])[0] == "black_on_light_blur"
    cover = {"playH": 1920, "panels": [{"dest": {"x": 0, "y": 0, "w": 1080, "h": 1920}, "src": {"x": 0.2, "y": 0, "w": 0.3, "h": 1}, "fit": "cover"}]}
    assert pick_title_style(cover, dark, [])[0] == "white_box_black"  # busy live video
    calm = {"bands": {k: {"luma": 0.2, "busy": 0.3} for k in ("top", "bottom", "caption")}}
    assert pick_title_style(cover, calm, [])[0] == "white_on_black"
    assert pick_title_style(blur_spec, dark, [], allowed=["white_box_black"])[0] == "white_box_black"


# ---------------------------------------------------------------- ONE pipeline: upload == stream
def test_upload_and_stream_entry_points_are_identical(monkeypatch, tmp_path):
    """Both entry points on the same source -> identical clip_type, template, layout, captions."""
    import clips_worker.clip_classify as cc
    import clips_worker.streamer.layout.detect_facecam as dfc
    from clips_worker import pipeline
    from clips_worker.clip_finalize import ClipInputs, finalize_clip_edits

    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"\0" * 2048)
    cls = {"confidence": 0.9, "main_picture": "video_game", "game_graphics_visible": True, "people_on_camera": 1,
           "seated_talking_to_camera": False, "clip_type": "gaming", "_duration_s": 30.0,
           "scenes": S.normalize_scene_map([{"start_s": 0, "end_s": 30, "layout": "webcam_game", "real_person_boxes": [CAM_FACE],
                                             "facecam_box": {"x": 0.0, "y": 0.6, "w": 0.25, "h": 0.4}}], 30.0)}
    monkeypatch.setattr(cc, "classify_clip", lambda *a, **k: json.loads(json.dumps(cls)))
    monkeypatch.setattr(dfc, "detect_facecam_layout", lambda *a, **k: {"facecam": {"x": 0.7, "y": 0.3, "w": 0.1, "h": 0.2}, "confidence": 0.5, "method": "face_box"})
    monkeypatch.setattr(S, "sample_face_dets", lambda *a, **k: None)
    import clips_worker.t6_signals as ts

    monkeypatch.setattr("clips_worker.t6_cv.enrich_signals_cv", lambda base, *a, **k: base)
    monkeypatch.setattr("clips_worker.t6_render.probe_duration_s", lambda p: 30.0)
    monkeypatch.setattr("clips_worker.regular_auto_layout.apply_regular_auto_layout", lambda e, *a, **k: e)
    for f in ("T6_TEMPLATES", "T6_SIGNALS", "T6_CAPTION_PRESETS", "T6_TITLE_AUTO", "CLIP_CLASSIFY"):
        monkeypatch.setenv(f, "1")
    settings = {"captions": {"presetId": "bold_pop"}}
    words = [{"w": "hey", "s": 0.5, "e": 0.8}, {"w": "chat", "s": 0.9, "e": 1.3}]
    meta = {"videoMoment": {"game_ui_visible": True, "real_camera_footage": False}, "videoMomentMatchIou": 0.8,
            "uploadProjectMajorityType": "gaming"}
    pick = {"start_ms": 60000, "end_ms": 90000, "aiMeta": meta}
    base_edits = {"layout": {"mode": "fit_blur"}, "captions": {"enabled": True}, "exportTemplate": {}}

    up_edits, up_type, _ = pipeline._finalize_regular_clip_edits(
        json.loads(json.dumps(base_edits)), clip, words, settings, "talking", pick=pick, work_dir=tmp_path, clip_id="clip_same"
    )
    st_edits, st_type, _ = finalize_clip_edits(
        ClipInputs(edits=json.loads(json.dumps(base_edits)), clip_file=clip, clip_words=words, settings=settings,
                   work_dir=tmp_path, clip_id="clip_same", clip_start_ms=60000, moment=meta["videoMoment"],
                   moment_iou=0.8, majority="gaming", known_facecam_layout=None, extra_meta=dict(meta))
    )
    assert up_type["clipType"] == st_type["clipType"] == "gaming"
    assert up_edits["layout"] == st_edits["layout"]
    assert up_edits["layout"]["template"]["id"] in ("G1", "G2", "G3", "G6")
    assert up_edits["captions"] == st_edits["captions"]
    assert up_edits.get("silenceTrim") == st_edits.get("silenceTrim")
    assert up_type["signals"]["scenes"] == st_type["signals"]["scenes"]
    _ = ts
