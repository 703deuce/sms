from clips_worker.media_sources import fit_filter


def test_cover_filter_centers_crop_and_even_dimensions():
    vf = fit_filter("cover", 720, 1280)
    assert "force_divisible_by=2" in vf
    assert "crop=720:1280:(iw-ow)/2:(ih-oh)/2" in vf
    assert "increase" in vf
