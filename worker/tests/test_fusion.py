from clips_worker.streamer.fusion import fuse_moments


def test_fusion_renorm_without_chat():
    duration_s = 120
    audio = [0.1] * 60 + [0.9] + [0.1] * 59
    signals = {"audio": audio, "transcript": [0.0] * duration_s, "chat": None, "viewerClips": None}
    picks, _ = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=[],
        settings={"streamer": {"clipCount": 3, "minClipS": 10, "maxClipS": 60}},
    )
    assert picks
    assert picks[0].score >= picks[-1].score


def test_fusion_dedupe_iou():
    duration_s = 300
    curve = [0.0] * 100 + [0.95] + [0.0] * 199
    signals = {"audio": curve, "transcript": None, "chat": None, "viewerClips": None}
    picks, _ = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=[],
        settings={"streamer": {"clipCount": 5, "minClipS": 15, "maxClipS": 60}},
    )
    assert len(picks) <= 5
