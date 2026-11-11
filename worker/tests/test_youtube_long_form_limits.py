"""YT02: extended YouTube Story payloads preserve the legacy E5b contract."""
from clips_worker.media_sources import normalize_media_sources, referenced_media
from clips_worker.media_inserts import normalize_inserts, edits_insert_windows, build_splice_graph


def fixture():
    sources = [
        {"id": f"yt_source_{i}", "ref": "upload", "refId": f"upl_{i}",
         "mediaType": "video", "durationMs": 5000}
        for i in range(62)
    ]
    inserts = [
        {"id": f"yt_insert_{i-1}", "sourceId": f"yt_source_{i}",
         "atSrcMs": 2200, "append": True, "inMs": 1000,
         "durMs": 1200, "audio": "source", "fit": "contain"}
        for i in range(1, 62)
    ]
    return sources, inserts


def test_extended_youtube_preserves_62_sources_and_61_inserts_in_render_graph():
    sources, inserts = fixture()
    edits = {"youtubeLongFormAssembly": 1, "sources": sources, "inserts": inserts}
    assert len(normalize_media_sources(sources, True)) == 62
    assert len(normalize_inserts(inserts, normalize_media_sources(sources, True), True)) == 61
    windows = edits_insert_windows(edits, [(1000, 2200)])
    assert len(windows) == 61
    assert windows[-1]["sourceId"] == "yt_source_61"
    assert windows[-1]["endMs"] == 1200 + 61 * 1200
    assert len(referenced_media(edits)) == 61
    pieces = [
        {"kind": "insert", "input": i + 1, "still": False, "durS": 1.2,
         "audio": "source", "fit": "contain", "hasAudio": True}
        for i in range(61)
    ]
    graph, _ = build_splice_graph(True, 1280, 720, 30, 48000, pieces)
    assert any("concat=n=61:v=1:a=1" in part for part in graph)


def test_legacy_default_and_boolean_flags_keep_original_limits():
    sources, inserts = fixture()
    legacy = {"sources": sources, "inserts": inserts}
    limited = normalize_media_sources(sources)
    assert len(limited) == 50
    assert limited == normalize_media_sources(sources, False)
    assert len(normalize_inserts(inserts, limited)) == 49
    assert len(edits_insert_windows(legacy, [(1000, 2200)])) == 49
    assert len(referenced_media(legacy)) == 49
    legacy["youtubeLongFormAssembly"] = True
    assert len(edits_insert_windows(legacy, [(1000, 2200)])) == 49
