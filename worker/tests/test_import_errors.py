from clips_worker.streamer.import_errors import classify_metadata, classify_ytdlp_import_error


def test_classify_vod_disabled():
    err = classify_ytdlp_import_error("VOD archives are disabled on this channel")
    assert err and "VOD storage disabled" in err


def test_classify_muted_vod():
    err = classify_ytdlp_import_error("Video muted due to copyright on this vod")
    assert err and "no usable audio" in err


def test_classify_kick_live_metadata():
    err = classify_metadata({"is_live": True}, platform="kick")
    assert err and "after the stream ends" in err
