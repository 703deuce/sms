from clips_worker.streamer.fusion import fuse_moments


def test_clip_cue_guaranteed_pick():
    duration_s = 120
    signals = {
        "audio": [0.1] * duration_s,
        "transcript": [0.0] * duration_s,
        "clipCues": [0.0] * 50 + [1.0] + [0.0] * 69,
        "chat": None,
        "viewerClips": None,
    }
    cues = [{"kind": "streamer_call", "sec": 50, "weight": 1.0}]
    picks, _ = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=[],
        settings={"streamer": {"clipCount": 2, "minClipS": 10, "maxClipS": 60}},
        cue_events=cues,
    )
    assert any(p.score >= 90 for p in picks)
    assert any(
        any(r.get("label") == "Streamer called it" for r in (p.ai_meta.get("streamer") or {}).get("reasons", []))
        for p in picks
    )
