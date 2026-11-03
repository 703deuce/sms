from __future__ import annotations

from clips_worker.picker.snap_bounds import _preroll_start_ms, _snap_ms_out_of_words
from clips_worker.t6_scenes import normalize_scene_map


def _w(w, s, e):
    return {"w": w, "s": s, "e": e}


def test_preroll_capped_by_previous_word():
    words = [_w("we", 0.0, 0.3), _w("went", 0.3, 0.75), _w("Then", 0.9, 1.1)]
    assert _preroll_start_ms(words, 2, 0, 250) == 770


def test_preroll_full_pad_when_room():
    words = [_w("we", 0.0, 0.3), _w("went", 0.3, 0.55), _w("Then", 0.8, 1.0)]
    assert _preroll_start_ms(words, 2, 0, 250) == 570


def test_preroll_dead_air_stays_on_onset():
    words = [_w("so", 0.0, 0.3), _w("Next", 2.0, 2.3)]
    assert _preroll_start_ms(words, 1, 0, 250) == 2000


def test_preroll_first_word_respects_range_start():
    words = [_w("Hello", 0.5, 0.8)]
    assert _preroll_start_ms(words, 0, 400, 250) == 400


def test_end_in_word_does_not_run_into_next_word():
    words = [_w("alpha", 0.0, 1.0), _w("beta", 1.05, 1.5)]
    _s, e = _snap_ms_out_of_words(words, 0, 900, 0, 10_000)
    assert e == 1030


def test_end_in_word_keeps_tail_when_room():
    words = [_w("alpha", 0.0, 1.0), _w("beta", 2.0, 2.5)]
    _s, e = _snap_ms_out_of_words(words, 0, 900, 0, 10_000)
    assert e == 1120


def _row(a, b, layout):
    return {"start_s": a, "end_s": b, "layout": layout, "real_person_boxes": []}


def test_short_tail_scene_merges_into_previous():
    sc = normalize_scene_map([_row(0, 20, "no_person"), _row(20, 23.5, "irl_world")], 23.5)
    assert len(sc) == 1
    assert sc[0]["layout"] == "no_person"
    assert abs(sc[0]["end_s"] - 23.5) < 1e-6


def test_short_head_scene_merges_into_next():
    sc = normalize_scene_map([_row(0, 3, "irl_world"), _row(3, 30, "no_person")], 30.0)
    assert len(sc) == 1
    assert sc[0]["layout"] == "no_person"
    assert abs(sc[0]["start_s"]) < 1e-6


def test_long_edges_keep_middle_switch():
    sc = normalize_scene_map(
        [_row(0, 10, "no_person"), _row(10, 20, "irl_world"), _row(20, 30, "no_person")], 30.0
    )
    assert [s["layout"] for s in sc] == ["no_person", "irl_world", "no_person"]
