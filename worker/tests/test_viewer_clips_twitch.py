from clips_worker.streamer.viewer_clips.twitch import fetch_clips_for_vod


def test_fetch_clips_filters_video_and_null_offset(monkeypatch):
    calls = []

    def fake_helix(path, params, token, client_id):
        calls.append(params)
        return {
            "data": [
                {"video_id": "99", "vod_offset": 120, "duration": 30, "view_count": 10, "id": "a"},
                {"video_id": "99", "vod_offset": None, "duration": 30, "view_count": 5, "id": "b"},
                {"video_id": "other", "vod_offset": 1, "duration": 10, "view_count": 1, "id": "c"},
            ],
            "pagination": {},
        }

    monkeypatch.setenv("TWITCH_CLIENT_ID", "cid")
    monkeypatch.setenv("TWITCH_CLIENT_SECRET", "sec")
    monkeypatch.setattr(
        "clips_worker.streamer.viewer_clips.twitch._app_token",
        lambda: "tok",
    )
    monkeypatch.setattr(
        "clips_worker.streamer.viewer_clips.twitch._helix_get",
        fake_helix,
    )
    out = fetch_clips_for_vod(
        broadcaster_id="1",
        video_id="99",
        started_at="2026-01-01T00:00:00Z",
        ended_at="2026-01-02T00:00:00Z",
    )
    assert len(out) == 1
    assert out[0]["vod_offset_s"] == 120
