"""MC batch 3: audio angle segments in normalize + source_windows."""
from clips_worker.media_sources import normalize_media_sources, normalize_source_segments, segment_audio, source_windows


def test_audio_angle_segment_normalize_and_windows():
    sources = normalize_media_sources(
        [{"id": "vo", "ref": "upload", "refId": "vo", "mediaType": "audio", "label": "VO"}]
    )
    segs = normalize_source_segments(
        [{"id": "s1", "sourceId": "vo", "startMs": 1000, "endMs": 4000, "inMs": 0}],
        sources,
    )
    assert segs and segs[0]["audio"] == "source"
    src = sources[0]
    assert segment_audio(segs[0], src) == "source"
    wins = source_windows({"sources": sources, "sourceSegments": segs}, 0, 10_000)
    assert len(wins) == 1
    assert wins[0]["mediaType"] == "audio"
