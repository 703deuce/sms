from clips_worker.streamer.montage_plan import plan_montage_clips


def test_montage_plan_score_order_and_trim():
    clips = [
        {"id": "a", "startMs": 0, "endMs": 60_000, "score": 90},
        {"id": "b", "startMs": 60_000, "endMs": 120_000, "score": 50},
        {"id": "c", "startMs": 120_000, "endMs": 180_000, "score": 80},
    ]
    out = plan_montage_clips(clips, clip_ids=None, top_n=2, max_duration_s=200, order="score")
    assert [c["id"] for c in out] == ["a", "c"]


def test_montage_chronological():
    clips = [
        {"id": "a", "startMs": 100, "endMs": 2000, "score": 1},
        {"id": "b", "startMs": 0, "endMs": 900, "score": 99},
    ]
    out = plan_montage_clips(clips, clip_ids=["a", "b"], top_n=5, max_duration_s=999, order="chronological")
    assert out[0]["id"] == "b"
