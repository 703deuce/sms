import pytest

from clips_worker.streamer.timeline import compute_cut, media_ms_to_vod_ms, vod_ms_to_media_s


def test_round_trip():
    anchor = 4670000
    media = 117875
    assert media_ms_to_vod_ms(media, anchor) == 4787875
    assert vod_ms_to_media_s(4787875, anchor) == pytest.approx(117.875)


def test_regression_clip_ac005d5c():
    seg_anchor = 4750000
    clip_abs = 4787875
    rel_start_ms, _ = compute_cut(clip_abs, clip_abs + 30000, seg_anchor)
    assert rel_start_ms / 1000.0 == pytest.approx(37.875)


def test_regression_clip_5ba55001():
    seg_anchor = 4660000
    clip_abs = 4670000
    rel_start_ms, _ = compute_cut(clip_abs, clip_abs + 30000, seg_anchor)
    assert rel_start_ms / 1000.0 == pytest.approx(10.0)
