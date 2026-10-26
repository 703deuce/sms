from clips_worker.streamer.metadata import chapter_at_ms, twitch_vod_timestamp_url, enrich_streamer_meta


def test_chapter_at():
    chapters = [{"startMs": 0, "endMs": 60_000, "title": "Apex"}]
    assert chapter_at_ms(chapters, 30_000) == "Apex"


def test_twitch_timestamp_url():
    url = twitch_vod_timestamp_url("https://www.twitch.tv/videos/1", 3661_000)
    assert "t=" in url


def test_enrich_meta():
    meta = enrich_streamer_meta(
        {"streamer": {"reasons": []}},
        vod={"title": "Grind", "category": "Fortnite", "platform": "twitch", "url": "https://twitch.tv/videos/9"},
        peak_ms=1000,
        clip_start_ms=5000,
    )
    assert meta["streamer"]["meta"]["game"] == "Fortnite"
